document.addEventListener("DOMContentLoaded", buildPopupDom);

function buildPopupDom() {
  chrome.storage.sync.get(
    { sites: "https://stackoverflow.com/", countDaily: false },
    (items) => {
      const urls = items.sites.split(/\r?\n/);
      getVisitTimes(urls);
    }
  );
}

// Search history to find number of vists to specified url
function getVisitTimes(urls) {
  const microsecondsForFiveYears = 1000 * 60 * 60 * 24 * 365 * 5;
  const fiveYearsAgo = new Date().getTime() - microsecondsForFiveYears;
  const urlVisitTimes = {};
  let checkedUrls = 0;
  let lastActive = new Date("January 1, 1970");
  let totalVisits = 0;

  for (const url of urls) {
    chrome.history.search(
      {
        text: url,
        startTime: fiveYearsAgo,
        maxResults: 1000000000,
      },
      (historyItems) => {
        const visitTimes = historyItems.map((item) => item.lastVisitTime);
        urlVisitTimes[url] = visitTimes;

        // check and update last active and total visits and increment checked urls
        if (new Date(visitTimes[0]) > lastActive) {
          lastActive = new Date(visitTimes[0]);
        }
        totalVisits += visitTimes.length;
        checkedUrls++;

        // if all urls checked then process
        if (checkedUrls == urls.length) {
          processVisitTimes(urlVisitTimes);
          setLastActive(lastActive);
          setTotalVisits(totalVisits);
        }
      }
    );
  }
}

// Sort visits into map with key: date and value: number of visits
function processVisitTimes(urlVisitTimes) {
  const urlTimeSummary = {};

  // Enter key of url and value of time summary map
  for (const url in urlVisitTimes) {
    const timeSummary = new Map();

    urlVisitTimes[url].forEach((time) => {
      const dateObj = new Date(time);
      const dateStr = `${dateObj.getDate()}${
        dateObj.getMonth() < 10 ? "0" + dateObj.getMonth() : dateObj.getMonth()
      }${dateObj.getFullYear()}`;

      if (timeSummary.has(dateStr)) {
        timeSummary.set(dateStr, timeSummary.get(dateStr) + 1);
      } else {
        timeSummary.set(dateStr, 1);
      }
    });
    urlTimeSummary[url] = timeSummary;
  }

  console.log(urlTimeSummary);
}

// Set "Last Active" to last time url visited
function setLastActive(lastTime) {
  const diff = Date.now() - new Date(lastTime);
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
  const diffYears = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  let lastActive = "";

  // today, yesterday, x days ago, x months ago, x years ago
  if (diffDays == 0) lastActive = "today";
  else if (diffDays < 30) lastActive = `${diffDays} days ago`;
  else if (diffDays < 365) lastActive = `${diffMonths} months ago`;
  else lastActive = `${diffYears} years ago`;

  document.getElementById("last-active").textContent = lastActive;
}

// Set "Total Visits" to total number of visits to url
function setTotalVisits(num) {
  document.getElementById("total-visits").textContent = num;
}
