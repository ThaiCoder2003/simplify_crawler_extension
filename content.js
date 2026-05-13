let isCrawling = false;
let currentPage = 1;
let allJobs = [];
let maxJobs = 1; // crawl tối đa 5 trang
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
  console.log("[Indeed Crawler]", ...args);
}

function createPanel() {
  if (document.querySelector("#indeed-crawler-panel")) return;

  const panel = document.createElement("div");
  panel.id = "indeed-crawler-panel";
  panel.innerHTML = `
    <div id="indeed-crawler-controls">
      <button id="indeed-start-btn">Bắt Đầu Thu Thập</button>
      <button id="indeed-stop-btn">Tạm Dừng & Xuất File</button>
      <button id="indeed-reset-btn">Xóa Dữ Liệu</button>
      <label style="margin-left: 10px;">
        Số job tối đa:
        <input type="number" id="max-jobs-input" value="${maxJobs}" min="1" style="width: 50px;"/>
      </label>
    </div>
    <div id="indeed-crawler-status">Chưa bắt đầu.</div>
    <div id="indeed-crawler-table-wrapper">
      <table id="indeed-crawler-table">
        <thead>
          <tr>
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

  document.getElementById("indeed-start-btn").onclick = () => {
    const inputVal = parseInt(document.getElementById("max-pages-input").value);
    if (!isNaN(inputVal) && inputVal > 0) {
      maxPages = inputVal;
      chrome.storage.local.set({ maxPages });
    }
    startCrawl();
  };

  document.getElementById("indeed-stop-btn").onclick = async () => {
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

  document.getElementById("indeed-reset-btn").onclick = () => {
    chrome.storage.local.clear();
    allJobs = [];
    currentPage = 1;
    isCrawling = false;
    hasExported = false;
    document.querySelector("#indeed-crawler-table tbody").innerHTML = "";
    updateStatus("Đã xóa dữ liệu.");
    document.getElementById("indeed-start-btn").disabled = false;
  };
}