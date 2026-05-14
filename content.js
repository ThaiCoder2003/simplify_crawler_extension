let isCrawling = false;
let currentJob = 0;
let allJobs = [];
let maxJobs = 1; // số lượng job tối đa
let hasExported = false;

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
        <input type="number" id="max-jobs-input" value="${maxJobs}" min="1" style="width: 50px;"/>
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
    currentJob = 1;
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
    <td>${job.id || "N/A"}</td>
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

    // Scroll further down
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth"
    });

    await randomDelay(2000, 4000);
  }

  if (allJobs.length) {
    exportCSV()
  }
}

async function crawlJobs(timeout = 15000) {
  const cards = document.querySelectorAll('[data-testid="job-card"]')

  log(`Tìm thấy ${cards.length} cards`);

  for (const card of cards) {
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
      ].map(el => el.innerHTML.trim());

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

      const salary =
        tags.find(t =>
          t.includes("$")
        ) || "";

      const location =
        tags.find(t =>
          !employmentTypes.includes(t) &&
          !workplaceTypes.includes(t) &&
          !t.includes("$")
        ) || "";

      card.click();

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

      allJobs(job);

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

  const jobCount = allJobs.length;
  const pageTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 30);
  const filename = `${jobCount}_jobs_${pageTitle}.csv`;

  chrome.runtime.sendMessage({ action: "saveToCSV", url, filename });
}
