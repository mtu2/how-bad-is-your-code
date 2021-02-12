$(document).ready(() => buildDom());

const NUMBER_MONTHS_SHOWN = 8;
const NUMBER_DAYS_SHOWN = calcNumberDaysToShow(NUMBER_MONTHS_SHOWN);
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

async function buildDom() {
  // Get settings
  const settings = await getSettings();

  // Build content description related DOM
  const urls = settings.sites.split(/\r?\n/);
  buildContentDescriptionDom(urls);

  // Get and build bookmark related DOM
  const bookmarks = await getBookmarks(urls);
  setSavedBookmarkText(bookmarks.length > 0);
  buildBookmarkListDom(bookmarks);

  // Build user profile DOM
  if (settings.accountId && settings.accountInfo)
    buildUserDom(settings.accountId, settings.accountInfo);

  // Build info icon/missing history
  buildInfoIcon();

  // Get and build visit time related DOM
  const {
    lastActive,
    firstActive,
    totalVisits,
    urlVisitTimes,
  } = await getVisitTimeData(urls);

  setFirstActive(firstActive);
  setLastActive(lastActive);
  setTotalVisits(totalVisits);

  const urlTimeSummary = processVisitTimes(urlVisitTimes);
  buildGridSquaresDom(urlTimeSummary);
  buildGridMonthDom();
  buildGridDayDom();
  $("#grid-loading-container").remove();
}

/* SETTINGS FUNCTIONS */
function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(
      { sites: "https://stackoverflow.com/", accountId: "", accountInfo: null },
      (items) => resolve(items)
    );
  });
}

/* CONTENT DESCRIPTION DOM FUNCTIONS */
function buildContentDescriptionDom(urls) {
  const prefix = "http://";
  const prefix2 = "https://";
  let tracking = "";

  if (urls.length == 0) tracking = "no websites";
  else if (urls.length == 1) tracking = `<code>${urls[0]}</code>`;
  else {
    urls.forEach((url, index) => {
      let clickableUrl = url;
      if (
        url.substr(0, prefix.length) !== prefix &&
        url.substr(0, prefix2.length) !== prefix2
      ) {
        clickableUrl = prefix + url;
      }

      const add =
        index == urls.length - 1
          ? `and <a href=${clickableUrl} target="_blank" title=${clickableUrl}><code>${url}</code></a>`
          : `<a href=${clickableUrl} target="_blank" title=${clickableUrl}><code>${url}</code></a>, `;

      tracking += add;
    });
  }

  const optionsPage = $("<code />")
    .html("options page")
    .attr("title", "How bad is your code? - options page")
    .click(() => chrome.runtime.openOptionsPage());

  $("#content-description")
    .append(
      `Currently tracking the number of visits and bookmarks to ${tracking}. Websites tracked and other settings can be edited in the `
    )
    .append(optionsPage)
    .append(". Link your stack overflow account for more details.");
}

/* BOOKMARK + BOOKMARK DOM FUNCTIONS */
function getBookmarks(urls) {
  let checkedUrls = 0;
  const bookmarks = [];

  return new Promise((resolve, reject) => {
    for (const url of urls) {
      chrome.bookmarks.search(url, (bookmarkTreeNodes) => {
        bookmarks.push(...bookmarkTreeNodes);
        checkedUrls++;

        // if all urls checked then process
        if (checkedUrls == urls.length) {
          resolve(bookmarks);
        }
      });
    }
  });
}
function setSavedBookmarkText(bool) {
  const savedBookmarkText = $("#saved-bookmarks");
  if (bool) savedBookmarkText.text("Saved bookmarks:");
  else savedBookmarkText.text("");
}
function buildBookmarkListDom(bookmarkList) {
  const bookmarks = $("#bookmarks");
  bookmarkList.forEach((ele) => {
    bookmarks.append(
      `<li><a href=${ele.url} target="_blank" title=${ele.url}>${ele.title}</a></li>`
    );
  });
}

/* USER DOM FUNCTIONS */
function buildUserDom(accountId, accountInfo) {
  const contentUserBottom = $("#content-user-bottom");
  contentUserBottom.addClass("content-user-bottom");

  contentUserBottom
    .append(
      `<p class="user-action-time" title=${new Date(
        accountInfo.last_access_date * 1000
      ).toUTCString()}>last seen ${formatDateForUserAccess(
        accountInfo.last_access_date * 1000
      )}</p>`
    )
    .append(
      `<a class="user-profile-image" href="https://stackoverflow.com/users/${accountId}" target="_blank"><img class="user-profile-image-icon" alt="Profile image" src=${accountInfo.profile_image}></a>`
    )
    .append(
      `<a class="user-display-name" href="https://stackoverflow.com/users/${accountId}" target="_blank">${accountInfo.display_name}</a>`
    );

  let badges = "";

  ["gold", "silver", "bronze"].forEach((type) => {
    const count = accountInfo.badge_counts[type];
    if (count > 0) {
      badges += `<span class="badge" title="${count} ${type} badges">
      <span class="badge-icon ${type}-badge-icon"></span>
      <span class="badge-count">${count}</span>
      </span>`;
    }
  });

  contentUserBottom.append(
    `<p class="user-flair"><span class="reputation-score" title="reputation score ${
      accountInfo.reputation
    }">${formatUserReputation(accountInfo.reputation)}</span>${badges}</p>`
  );
}

/* INFO ICON/MISSING HISTORY FUNCTIONS */
function buildInfoIcon() {
  const missingHistory = $("#missing-history");
  const missingHistoryExplanation = $("#missing-history-explanation");

  missingHistory.click(() => {
    missingHistoryExplanation.css("display") === "none"
      ? missingHistoryExplanation.css("display", "block")
      : missingHistoryExplanation.css("display", "none");
  });
}

/* VISIT TIME FUNCTIONS */
// Search history to find number of vists to specified url and other data
function getVisitTimeData(urls) {
  const microsecondsForFiveYears = 1000 * 60 * 60 * 24 * 365 * 5;
  const fiveYearsAgo = new Date().getTime() - microsecondsForFiveYears;
  const urlVisitTimes = {};

  let checkedUrls = 0;
  let lastActive = new Date("January 1, 1970");
  let firstActive = new Date();
  let totalVisits = 0;

  return new Promise((resolve, reject) => {
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
            resolve({ lastActive, firstActive, totalVisits, urlVisitTimes });
          }
        }
      );
    }
  });
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

/* VISIT TIME DOM FUNCTIONS */
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

  const squares = $("#squares");

  for (let i = NUMBER_DAYS_SHOWN - 1; i >= 0; i--) {
    const finishedText = `${
      squaresTooltipText[i] == "" ? "No visits" : squaresTooltipText[i]
    } on ${formatDateFromDaysAgo(i)}`;

    squares.append(
      `<li class="tooltip" data-level="${calcSquareLevel(
        squaresTotal[i],
        percentiles
      )}"><span class="tooltip-text-top">${finishedText}</span></li>`
    );
  }
}

function buildGridMonthDom() {
  const months = $("#months");
  const start = 13 - NUMBER_MONTHS_SHOWN + new Date().getMonth();
  let styling = "";

  for (let i = 0; i < NUMBER_MONTHS_SHOWN; i++) {
    const index = start + i >= 12 ? start + i - 12 : start + i;
    styling += `calc(var(--week-width) * ${MONTHS_WEEKS_WIDTH[index]}) `;

    months.append(`<li>${MONTHS_SHORT[index]}</li>`);
  }

  months.css("grid-template-columns", styling);
}

function buildGridDayDom() {
  const days = $("#days");

  DAYS_SHORT.forEach((day) => {
    days.append(`<li>${day}</li>`);
  });
}

function setFirstActive(firstTime) {
  $("#first-active")
    .text(formatDateForActive(firstTime))
    .attr("title", new Date(firstTime).toUTCString());
}

function setLastActive(lastTime) {
  $("#last-active")
    .text(formatDateForActive(lastTime))
    .attr("title", new Date(lastTime).toUTCString());
}

function setTotalVisits(num) {
  $("#total-visits").text(num).attr("title", `${num} visits`);
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

function formatDateForUserAccess(lastAccess) {
  // e.g. Aug 12 '13 at 14:51
  const dateObj = new Date(lastAccess);
  return `${
    MONTHS_SHORT[dateObj.getMonth()]
  } ${dateObj.getDate()}, '${dateObj
    .getFullYear()
    .toString()
    .slice(-2)} at ${dateObj.getHours()}:${dateObj.getMinutes()}`;
}

function formatUserReputation(num) {
  if (num > 1000000) return (num / 1000000).toFixed(1) + "m";
  else if (num > 100000) return (num / 1000).toFixed(0) + "k";
  else if (num > 10000) return (num / 1000).toFixed(1) + "k";
  else if (num > 1000)
    return `${num.toString().slice(0, 1)}, ${num.toString().slice(1)}}`;
  else return num;
}

function calcPercentiles(data) {
  const filteredData = data.filter((val) => val != 0);
  filteredData.sort((a, b) => a - b); // ascending order

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

function calcNumberDaysToShow(numberMonths) {
  // return days in specified numberMonths - correction to current day of week
  const currentDate = new Date();

  const dateObj = new Date();
  dateObj.setMonth(dateObj.getMonth() - numberMonths);

  const diff = currentDate - dateObj;
  let daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));
  daysDiff -= daysDiff % 7; // make multiple of 7
  daysDiff -= 6 - currentDate.getDay(); // minus to current day

  return daysDiff;
}

// DUMMY ACCOUNT DATA
// const ACCOUNT_INFO = {
//   badge_counts: { bronze: 8876, gold: 784, silver: 8639 },
//   creation_date: 1222430705,
//   display_name: "Michael Jackson",
//   last_access_date: 1612161739,
//   last_modified_date: 1612019100,
//   link: "https://stackoverflow.com/users/22656/jon-skeet",
//   profile_image:
//     "https://static.wikia.nocookie.net/real-life-heroes/images/2/2c/Michael_Jackson.jpg/revision/latest?cb=20191122190551",
//   reputation: 1236915,
// };
