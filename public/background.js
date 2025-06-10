// Open the side panel when the extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  console.log("Tab Url: ", tab.url);
});

let isCapturing = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startCapture") {
    console.log("Starting capture...");
    isCapturing = true;
  } else if (message.action === "stopCapture") {
    isCapturing = false;
  } else if (message.action === "capture_screenshot" && isCapturing) {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      chrome.storage.local.get({ screenshots: [], info: [] }, (data) => {
        const updatedScreenshots = [...data.screenshots, dataUrl];
        const updatedInfo = [...data.info, message.data];
        chrome.storage.local.set({
          screenshots: updatedScreenshots,
          info: updatedInfo,
        });
      });
    });
  } else {
    console.warn("Unknown action received: ", message.action);
  }
});
