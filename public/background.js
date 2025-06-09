const GOOGLE_ORIGIN = "https://www.google.com";

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);

  if (url.origin === GOOGLE_ORIGIN) {
    await chrome.sidePanel;
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error))
      .setOptions({
        tabId,
        path: "index.html",
        enabled: true,
      });
  } else {
    // Disables the side panel on all other sites
    await chrome.sidePanel.chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error))
      .setOptions({
        tabId,
        enabled: false,
      });
  }
});

let isCapturing = false;
console.log("Background script loaded!");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background script: ", message.action);
  console.log("Message data: ", message.data);
  if (message.action === "start_capture") {
    console.log("Starting capture...");
    isCapturing = true;
  } else if (message.action === "stop_capture") {
    isCapturing = false;
  } else if (message.action === "capture_screenshot" && isCapturing) {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      chrome.storage.local.get({ screenshots: [], info: [] }, (data) => {
        const updatedScreenshots = [...data.screenshots, dataUrl];
        const updatedInfo = [...data.info, message.data]; // Store multiple info
        console.log("Updated Info: ", updatedInfo);
        chrome.storage.local.set({
          screenshots: updatedScreenshots,
          info: updatedInfo,
        });
      });
    });
  }
});
