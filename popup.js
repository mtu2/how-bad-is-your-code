document.addEventListener("DOMContentLoaded", buildFromSettings);

const NUMBER_DAYS_SHOWN = calcNumberDaysToShow();
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_WEEKS_WIDTH = [4, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 5];

function buildFromSettings() {
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
  let firstActive = new Date();
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
        if (visitTimes[0] > lastActive) {
          lastActive = new Date(visitTimes[0]);
        }
        if (visitTimes[visitTimes.length - 1] < firstActive) {
          firstActive = new Date(visitTimes[visitTimes.length - 1]);
        }

        totalVisits += visitTimes.length;
        checkedUrls++;

        // if all urls checked then process
        if (checkedUrls == urls.length) {
          setLastActive(lastActive);
          setFirstActive(firstActive);
          setTotalVisits(totalVisits);
          const urlTimeSummary = processVisitTimes(urlVisitTimes);
          buildGridSquaresDom(urlTimeSummary);
          buildGridMonthDom();
        }
      }
    );
  }
}

// Sort visits into map with key: date and value: number of visits
function processVisitTimes(urlVisitTimes) {
  const urlTimeSummary = {};

  // Enter key of url and value of time summary map
  for (const url of Object.keys(urlVisitTimes)) {
    const timeSummary = new Map();

    urlVisitTimes[url].forEach((time) => {
      const diff = Date.now() - new Date(time);
      const daysAgo = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (timeSummary.has(daysAgo)) {
        timeSummary.set(daysAgo, timeSummary.get(daysAgo) + 1);
      } else {
        timeSummary.set(daysAgo, 1);
      }
    });
    urlTimeSummary[url] = timeSummary;
  }

  return urlTimeSummary;
}

function buildGridSquaresDom(urlTimeSummary) {
  // initialise array of 365 0s and array of 365 empty string
  const squaresTotal = [];
  const squaresTooltipText = [];
  for (let i = 0; i < NUMBER_DAYS_SHOWN; i++) {
    squaresTotal[i] = 0;
    squaresTooltipText[i] = "";
  }

  // fill in array of total views/square and tooltip text/square
  for (let i = NUMBER_DAYS_SHOWN - 1; i >= 0; i--) {
    for (let [url, timeSummary] of Object.entries(urlTimeSummary)) {
      if (timeSummary.has(i)) {
        squaresTotal[i] += timeSummary.get(i);
        squaresTooltipText[i] += `${timeSummary.get(
          i
        )} visits to ${url} <br />`;
      }
    }
  }

  // calculate 25th, 50th and 75th percentiles from non-zero views
  const percentiles = calcPercentiles(squaresTotal);

  for (let i = NUMBER_DAYS_SHOWN - 1; i >= 0; i--) {
    const finishedText = `${
      squaresTooltipText[i] == "" ? "No visits" : squaresTooltipText[i]
    } on ${formatDateFromDaysAgo(i)}`;

    document
      .getElementById("squares")
      .insertAdjacentHTML(
        "beforeend",
        `<li class="tooltip" data-level="${calcSquareLevel(
          squaresTotal[i],
          percentiles
        )}"><span class="tooltip-text">${finishedText}</span></li>`
      );
  }
}

function buildGridMonthDom() {
  const start = 1 + new Date().getMonth();
  let styling = "";

  for (let i = 0; i < 12; i++) {
    const index = start + i >= 12 ? start + i - 12 : start + i;
    styling += `calc(var(--week-width) * ${MONTHS_WEEKS_WIDTH[index]}) `;

    document
      .getElementById("months")
      .insertAdjacentHTML("beforeend", `<li>${MONTHS_SHORT[index]}</li>`);
  }

  document.getElementById("months").style.gridTemplateColumns = styling;
}

// Set "Last Active" to last time url visited
function setLastActive(lastTime) {
  document.getElementById("last-active").textContent = formatDateForActive(
    lastTime
  );
}

// Set "First Active" to first time url visited
function setFirstActive(firstTime) {
  document.getElementById("first-active").textContent = formatDateForActive(
    firstTime
  );
}

// Set "Total Visits" to total number of visits to url
function setTotalVisits(num) {
  document.getElementById("total-visits").textContent = num;
}

// HELPER FUNCTIONS
function formatDateFromDaysAgo(daysAgo) {
  // e.g. Jul 22, 2020
  const dateObj = new Date(Date.now() - 1000 * 60 * 60 * 24 * daysAgo);

  return `${
    MONTHS_SHORT[dateObj.getMonth()]
  } ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
}
function formatDateForActive(lastTime) {
  // e.g. today, yesterday, x days ago, x months ago, x years ago
  const diff = Date.now() - new Date(lastTime);
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
  const diffYears = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  let lastActive = "";

  if (diffDays == 0) lastActive = "today";
  else if (diffDays < 30) lastActive = `${diffDays} days ago`;
  else if (diffDays < 365) lastActive = `${diffMonths} months ago`;
  else lastActive = `${diffYears} years ago`;

  return lastActive;
}
function calcPercentiles(data) {
  const filteredData = data.filter((val) => val != 0);
  filteredData.sort((a, b) => a - b); // ascending order
  console.log(filteredData);

  const percentiles = [];
  const interval = Math.floor(filteredData.length / 4);

  for (let i = 1; i < 4; i++) {
    percentiles.push(filteredData[interval * i]);
  }
  return percentiles;
}
function calcSquareLevel(views, percentiles) {
  let dataLevel;

  if (views == 0) dataLevel = 0;
  else if (views < percentiles[0]) dataLevel = 1;
  else if (views < percentiles[1]) dataLevel = 2;
  else if (views < percentiles[2]) dataLevel = 3;
  else dataLevel = 4;

  return dataLevel;
}
function calcNumberDaysToShow() {
  return 365 + new Date().getDay();
}
