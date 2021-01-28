document.addEventListener("DOMContentLoaded", buildPopupDom);

function buildPopupDom() {
  chrome.storage.sync.get(
    { sites: "https://stackoverflow.com/", countDaily: false },
    (items) => {
      console.log(items);
    }
  );
}

// Search history to find number of vists to specified url
async function getVisitTimes(url) {
  const microsecondsForFiveYears = 1000 * 60 * 60 * 24 * 365 * 5;
  const fiveYearsAgo = new Date().getTime() - microsecondsForFiveYears;

  chrome.history.search(
    {
      text: url,
      startTime: fiveYearsAgo,
      maxResults: 1000000000,
    },
    (historyItems) => {
      const visitTimes = historyItems.map((item) => item.lastVisitTime);
      processVisitTimes(visitTimes);
      setLastActive(visitTimes[0]);
      setTotalVisits(visitTimes.length);
    }
  );
}

// Sort visits into map with key: date and value: number of visits
function processVisitTimes(visitTimes) {
  const timeSummary = new Map();
  visitTimes.forEach((visitTime) => {
    const dateObj = new Date(visitTime);
    const dateStr = `${dateObj.getDate()}${
      dateObj.getMonth() < 10 ? "0" + dateObj.getMonth() : dateObj.getMonth()
    }${dateObj.getFullYear()}`;

    if (timeSummary.has(dateStr)) {
      timeSummary.set(dateStr, timeSummary.get(dateStr) + 1);
    } else {
      timeSummary.set(dateStr, 1);
    }
  });

  console.log(timeSummary);
  return timeSummary;
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
