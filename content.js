let isCrawling = false;
let allJobs = [];
let maxJobs = 1; // số lượng job tối đa
let hasExported = false;
let processedCardCount = 0;

let existingKeys = new Set();

/**
 * Waits for a number of milliseconds.
 * @param {number} ms Time to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Delays for a random number of time
 * @param {number} min Minimum time to wait
 * @param {number} max Maximum time to wait
 * @returns {Promise<void>}
 */
function randomDelay(min = 1200, max = 3500) {
  return new Promise(resolve => {
    const time = min + Math.random() * (max - min);
    setTimeout(resolve, time);
  });
}

function log(...args) {
  console.log("[simplify Crawler]", ...args);
}

function getDocumentName() {
  const original =
    "Simplify Jobs";
    return `${original} (${allJobs.length} crawled)`;
}

function getCurrentJobId() {
  const urlJobId =
    new URL(location.href)
      .searchParams
      .get("jobId");

  if (urlJobId) {
    return urlJobId;
  }

  const detailsCard =
    document.querySelector(
      '[id^="details-card-"]'
    );

  if (!detailsCard) {
    return null;
  }

  return detailsCard.id.replace(
    "details-card-",
    ""
  );
}

function createPanel() {
  if (document.querySelector("#simplify-crawler-panel")) return;

  const panel = document.createElement("div");
  panel.id = "simplify-crawler-panel";
  panel.innerHTML = `
    <div id="simplify-crawler-controls">
      <button id="simplify-start-btn">Bắt Đầu Thu Thập</button>
      <button id="simplify-stop-btn">Tạm Dừng & Xuất File</button>
      <button id="simplify-reset-btn">Xóa Dữ Liệu</button>
      <label style="margin-left: 10px;">
        Số job tối đa:
        <input type="number" id="max-jobs-input" value="${maxJobs}" min="1" class="simplify-number-input"/>
      </label>
    </div>
    <div id="simplify-crawler-status">Chưa bắt đầu.</div>
    <div id="simplify-crawler-table-wrapper">
      <table id="simplify-crawler-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Job Link</th>
            <th>Company</th>
            <th>Job Title</th>
            <th>Salary</th>
            <th>Location</th>
            <th>Employment Type</th>
            <th>Workplace Type</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById("simplify-start-btn").onclick = () => {
    hasExported = false;
    const inputVal = parseInt(document.getElementById("max-jobs-input").value);
    if (!isNaN(inputVal) && inputVal > 0) {
      maxJobs = inputVal;
      chrome.storage.local.set({ maxJobs });
    }
    startCrawl();
  };

  document.getElementById("simplify-stop-btn").onclick = async () => {
    if (!isCrawling && allJobs.length === 0) {
      updateStatus("Chưa có dữ liệu để xuất.");
      return;
    }
    isCrawling = false;
    chrome.storage.local.set({ isCrawling: false });
    updateStatus("Đã tạm dừng crawl và xuất file.");
    exportCSV();
  };

  document.getElementById("simplify-reset-btn").onclick = () => {
    chrome.storage.local.clear();
    allJobs = [];
    isCrawling = false;
    hasExported = false;
    existingKeys.clear();
    document.querySelector("#simplify-crawler-table tbody").innerHTML = "";
    updateStatus("Đã xóa dữ liệu.");
    document.getElementById("simplify-start-btn").disabled = false;
  };
}

function updateStatus(text) {
  document.getElementById("simplify-crawler-status").textContent = text;
  log(text);
}


function appendToTable(job) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${job.jobId || "N/A"}</td>
    <td>${job.jobUrl || "N/A"}</td>
    <td>${job.company || "N/A"}</td>
    <td>${job.title || "N/A"}</td>
    <td>${job.salary || "N/A"}</td>
    <td>${job.location || "N/A"}</td>
    <td>${job.employmentType || "N/A"}</td>
    <td>${job.workplaceType || "N/A"}</td>
  `;
  document.querySelector("#simplify-crawler-table tbody").appendChild(row);
}

async function humanScroll() {
  const jobList = document.querySelector(
    '.flex.flex-col.gap-4.overflow-y-auto.p-4.sm\\:h-screen'
  );

  let stagnant = 0;

  while (stagnant < 3) {
    const before =
      document.querySelectorAll(
        '[data-testid="job-card"]'
      ).length;

    // Scroll near bottom gently
    jobList.scrollTo({
      top: jobList.scrollHeight - 150,
      behavior: 'smooth'
    });

    console.log("Scrolled near bottom");

    let loaded = false;

    // Wait up to 15 sec for new cards
    for (let i = 0; i < 15; i++) {
      await wait(2000);

      const after =
        document.querySelectorAll(
          '[data-testid="job-card"]'
        ).length;

      if (after > before) {
        console.log(
          `Loaded more cards: ${before} -> ${after}`
        );

        loaded = true;
        stagnant = 0;

        break;
      }
    }

    if (!loaded) {
      stagnant++;
      console.log(
        `No new cards (${stagnant}/3)`
      );
    }

    else {
      // It's already loaded more. Stop now until new cards are finished crawling for the next batch
      break;
    }
  }

  console.log("Reached end");
}

async function startCrawl() {
  if (isCrawling) return;
  isCrawling = true;
  chrome.storage.local.set({ isCrawling, maxJobs });
  document.getElementById("simplify-start-btn").disabled = true;
  updateStatus("Bắt đầu crawl...");
  await crawlLoop();
}

async function crawlLoop() {
  log("Crawl loop bắt đầu");

  let stagnantRounds = 0
  // Actually loop unlike before
  while (isCrawling && allJobs.length < maxJobs) {
    const beforeCount = allJobs.length;

    await crawlJobs();

    const afterCount = allJobs.length;

    updateStatus(
      `Đã crawl ${afterCount}/${maxJobs} jobs`
    );

        // No new jobs found
    if (afterCount === beforeCount) {
      stagnantRounds++;
    } else {
      stagnantRounds = 0;
    }

    // Stop if stuck
    if (stagnantRounds >= 5) {
      log("Không còn job mới.");
      break;
    }
    
    // If there are still jobs to crawl but we can't find new cards, try scrolling the container instead of the job list
    if (allJobs.length < maxJobs) {
      await humanScroll();
    }

    processedCardCount = afterCount;

    await randomDelay(2000, 4000);
  }

  isCrawling = false;

  chrome.storage.local.set({
    isCrawling: false
  });

  document.getElementById(
    "simplify-start-btn"
  ).disabled = false;

  if (allJobs.length) {
    hasExported = true;
    exportCSV()
  }
}

async function crawlJobs(timeout = 15000) {
  const cards = document.querySelectorAll('[data-testid="job-card"]')
    const newCards = [...cards].slice(processedCardCount);
  log(`Tìm thấy ${newCards.length} card mới`);

  for (const card of newCards) {
    if (
      !isCrawling ||
      allJobs.length >= maxJobs
    ) {
      return;
    }

    try {
      const company =
        card.querySelector("img[alt]")
          ?.alt?.trim() || "";

      const title =
        card.querySelector("h3")
          ?.innerText?.trim() || "";

      const tags = [
        ...card.querySelectorAll(
          ".rounded-full"
        )
      ].map(el => el.textContent.replace(/\s+/g, ' ').trim());

      const employmentTypes = [
        "Full-Time",
        "Part-Time",
        "Internship",
        "Contract",
        "Temporary"
      ];

      const workplaceTypes = [
        "Remote",
        "Hybrid",
        "In-Person",
        "Onsite"
      ];

      const employmentType =
        tags.find(t =>
          employmentTypes.includes(t)
        ) || "";

      const workplaceType =
        tags.find(t =>
          workplaceTypes.includes(t)
        ) || "";

const salaryRegex =
  /(\$|€|£|₫|VND|\bvnd\b|¥|￥|円|元|RMB|CNY|\brmb\b|\bcny\b|yuan|k\/yr|k\/hr|k\/mo|k\/month|per\s?(?:year|yr|month|mo|hour|hr)|\/(?:yr|mo|hr)|salary|tháng|năm)/i;

const salary =
  tags.find(t =>
    salaryRegex.test(t)
  ) || "";

const location =
  tags.find(t =>
    /,/.test(t)
  ) || "";
      card.click();

      await randomDelay(300, 700);

      const jobId = getCurrentJobId();

      if (!jobId) {
        continue;
      }

      if (existingKeys.has(jobId)) {
        continue;
      }

      existingKeys.add(jobId);

      const job = {
        jobId,
        jobUrl: `https://simplify.jobs/p/${jobId}`,
        company,
        title,
        location,
        salary,
        employmentType,
        workplaceType
      };

      allJobs.push(job);

      appendToTable(job);
      
      await randomDelay(400, 1200);
    } catch (err) {
      console.error(err)
    }
  }
}

function exportCSV() {
  log("Bắt đầu xuất file CSV với", allJobs.length, "job");
  const headers = ["ID", "Link", "Company", "Title", "Location", "Salary", "Employment Type", "Workplace Type"];
  const rows = allJobs.map(j =>
    [j.jobId, j.jobUrl, j.company, j.title, j.location, j.salary, j.employmentType, j.workplaceType].map(v => {
      const val = (typeof v === 'string' || typeof v === 'number') ? v.toString() : '';
      return `"${val.replace(/"/g, '""')}"`;
    }).join(",")
  );

  const csvContent = [headers.join(","), ...rows].join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const documentName = getDocumentName()
  .replace(/[\\/:*?"<>|]/g, "_")
  .slice(0, 50);

  const filename = `${documentName}.csv`;

  chrome.runtime.sendMessage({ action: "saveToCSV", url, filename });
}

createPanel();