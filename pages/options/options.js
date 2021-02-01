document.addEventListener("DOMContentLoaded", load);
document.getElementById("save").addEventListener("click", save);
document.getElementById("reset").addEventListener("click", reset);

async function save() {
  // Save settings to chrome storage
  const sites = document.getElementById("sites").value;
  let accountId = document.getElementById("accountId").value.replace(/\s/g, "");
  accountId = accountId.replace(/\s/g, "");
  let accountInfo = null;

  if (accountId.length > 0) {
    accountInfo = await getAccountInfo(accountId);
  }

  chrome.storage.sync.set(
    {
      sites,
      countDaily,
      accountId,
      accountInfo,
    },
    () => displayStatus("Preferences saved.")
  );
}

function load() {
  // Load settings from chrome storage and display
  chrome.storage.sync.get(
    {
      sites: "https://stackoverflow.com/",
      countDaily: false,
      accountId: "",
      accountInfo: null,
    },
    (items) => {
      document.getElementById("sites").value = items.sites;
      document.getElementById("accountId").value = items.accountId;
    }
  );
}

function reset() {
  // Clear chrome storage and show defaults to user
  chrome.storage.sync.clear(() => displayStatus("Preferences reset."));
  document.getElementById("sites").value = "https://stackoverflow.com/";
  document.getElementById("accountId").value = "";
}

function displayStatus(message) {
  // Show status message
  const status = document.getElementById("status");
  status.textContent = message;
  setTimeout(() => (status.textContent = ""), 2000);
}

async function getAccountInfo(id) {
  const res = await fetch(
    `https://api.stackexchange.com/2.2/users/${id}?order=desc&sort=reputation&site=stackoverflow`
  );
  const data = await res.json();
  return data.items[0];
}
