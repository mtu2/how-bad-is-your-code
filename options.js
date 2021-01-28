document.addEventListener("DOMContentLoaded", load);
document.getElementById("save").addEventListener("click", save);
document.getElementById("reset").addEventListener("click", reset);

function save() {
  // Save settings to chrome storage
  const sites = document.getElementById("sites").value;
  const countDaily = document.getElementById("daily").checked;
  chrome.storage.sync.set(
    {
      sites,
      countDaily,
    },
    () => displayStatus("Preferences saved.")
  );
}

function load() {
  // Load settings from chrome storage and display
  chrome.storage.sync.get(
    { sites: "https://stackoverflow.com/", countDaily: false },
    (items) => {
      document.getElementById("sites").value = items.sites;
      document.getElementById("daily").checked = items.countDaily;
    }
  );
}

function reset() {
  // Clear chrome storage and show defaults to user
  chrome.storage.sync.clear(() => displayStatus("Preferences reset."));
  document.getElementById("sites").value = "https://stackoverflow.com/";
  document.getElementById("daily").checked = false;
}

function displayStatus(message) {
  // Show status message
  const status = document.getElementById("status");
  status.textContent = message;
  setTimeout(() => (status.textContent = ""), 2000);
}
