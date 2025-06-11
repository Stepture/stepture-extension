// Open the side panel when the extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

let isCapturing = false;
let captureBuffer = [];
let infoBuffer = [];
const BATCH_SIZE = 3; // Save every 3 screenshots
const BATCH_TIMEOUT = 2000; // Or after 2 seconds
const MAX_STORAGE_ITEMS = 100; // Prevent memory issues

let batchTimeout;

// Batch save function
async function saveBatch() {
  if (captureBuffer.length === 0) return;

  try {
    const data = await chrome.storage.local.get({ screenshots: [], info: [] });

    // Limit total items to prevent memory issues
    const totalItems = data.screenshots.length + captureBuffer.length;
    let screenshots = data.screenshots;
    let info = data.info;

    if (totalItems > MAX_STORAGE_ITEMS) {
      const itemsToRemove = totalItems - MAX_STORAGE_ITEMS;
      screenshots = screenshots.slice(itemsToRemove);
      info = info.slice(itemsToRemove);
    }

    const updatedScreenshots = [...screenshots, ...captureBuffer];
    const updatedInfo = [...info, ...infoBuffer];

    await chrome.storage.local.set({
      screenshots: updatedScreenshots,
      info: updatedInfo,
    });

    // Notify frontend about new data
    try {
      await chrome.runtime.sendMessage({
        action: "data_updated",
        newItemsCount: captureBuffer.length,
        totalItems: updatedScreenshots.length,
      });
    } catch (e) {
      // Ignore if frontend is not listening
    }

    console.log(
      `Batch saved: ${captureBuffer.length} new items, ${updatedScreenshots.length} total`
    );

    // Clear buffers
    captureBuffer = [];
    infoBuffer = [];
  } catch (error) {
    console.error("Error saving batch:", error);
  }
}

function scheduleBatchSave() {
  clearTimeout(batchTimeout);
  batchTimeout = setTimeout(saveBatch, BATCH_TIMEOUT);
}

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (isCapturing && info.status === "complete") {
    console.log("Tab Url: ", tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "startCapture":
      console.log("Starting capture...");
      isCapturing = true;
      sendResponse({ success: true, isCapturing: true });
      break;

    case "stopCapture":
      console.log("Stopping capture...");
      isCapturing = false;
      // Save any remaining items
      if (captureBuffer.length > 0) {
        saveBatch();
      }
      sendResponse({ success: true, isCapturing: false });
      break;
    case "pauseCapture":
      console.log("Pausing capture...");
      isCapturing = false;
      // Save any remaining items
      if (captureBuffer.length > 0) {
        saveBatch();
      }
      sendResponse({ success: true, isCapturing: false });
      break;
    case "resumeCapture":
      console.log("Resuming capture...");
      isCapturing = true;
      // Notify frontend about capture status change
      chrome.runtime.sendMessage({
        action: "capture_status_changed", // Notify frontend
        isCapturing: true,
      });
    case "capture_screenshot":
      if (!isCapturing) {
        sendResponse({ success: false, error: "Not capturing" });
        return;
      }

      chrome.tabs.captureVisibleTab(
        null,
        { format: "png" },
        async (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error("Screenshot error:", chrome.runtime.lastError);
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }

          // Add to buffer
          captureBuffer.push(dataUrl);
          infoBuffer.push(message.data);

          // Save immediately if buffer is full, otherwise schedule
          if (captureBuffer.length >= BATCH_SIZE) {
            await saveBatch();
          } else {
            scheduleBatchSave();
          }

          sendResponse({ success: true, buffered: captureBuffer.length });
        }
      );
      return true; // Keep message channel open

    case "get_data":
      chrome.storage.local.get({ screenshots: [], info: [] }, (data) => {
        sendResponse({
          success: true,
          data: data,
          isCapturing: isCapturing,
          bufferSize: captureBuffer.length,
        });
      });
      return true;

    case "clear_data":
      chrome.storage.local.clear(() => {
        captureBuffer = [];
        infoBuffer = [];
        sendResponse({ success: true });
      });
      return true;

    case "get_status":
      sendResponse({
        isCapturing: isCapturing,
        bufferSize: captureBuffer.length,
      });
      break;

    default:
      console.warn("Unknown action received: ", message.action);
      sendResponse({ success: false, error: "Unknown action" });
  }
});

// Save remaining items when extension is shutting down
chrome.runtime.onSuspend.addListener(() => {
  if (captureBuffer.length > 0) {
    saveBatch();
  }
});
