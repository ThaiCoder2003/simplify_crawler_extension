let isCrawling = false;
let currentJob = 0;
let allJobs = [];
let maxJobs = 1; // số lượng job tối đa
let hasExported = false;

let existingKeys = new Set();

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  return new URL(location.href)
    .searchParams
    .get("jobId");
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
    await sendToGoogleSheets(allJobs);
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

function updateStatus(text) {
  document.getElementById("indeed-crawler-status").textContent = text;
  log(text);
}

function appendToTable(job) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${job.id || "N/A"}</td>
    <td>${job.company || "N/A"}</td>
    <td>${job.title || "N/A"}</td>
    <td>${job.salary || "N/A"}</td>
    <td>${job.location || "N/A"}</td>
    <td>${job.employmentType || "N/A"}</td>
    <td>${job.workplaceType || "N/A"}</td>
  `;
  document.querySelector("#indeed-crawler-table tbody").appendChild(row);
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

  let stagnatRounds = 0
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
}

async function crawlJobs(timeout = 15000) {
  const cards = document.querySelectorAll()

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


    } catch (err) {
      console.error(err)
    }
  }
}
