let isCapturing = false;
let captureBuffer = [];
let infoBuffer = [];
const BATCH_SIZE = 3; // Save every 3 screenshots
const BATCH_TIMEOUT = 2000; // Or after 2 seconds
const MAX_STORAGE_ITEMS = 100; // Prevent memory issues
let batchTimeout;

// API : chrome.sidePanel
// Purpose : The Side Panel API allows extensions to display their own UI in the side panel
// Permission : "sidePanel" permission
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true }) // Open the side panel on clicking the icon.
  .catch((error) => console.error(error));

// API : chrome.scripting
// Purpose : The Scripting API allows extensions to inject scripts into web pages
// Permission : "scripting" permission
const injectContentScript = async (tabId, tabUrl) => {
  if (
    !tabId ||
    !tabUrl ||
    tabUrl.startsWith("chrome://") ||
    tabUrl.startsWith("chrome-extension://") ||
    tabUrl.startsWith("edge://") ||
    tabUrl.startsWith("about:")
  ) {
    console.warn(
      `Skipping content script injection for tab ${tabId} with URL ${tabUrl}`
    );
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });
    console.log(`Content script injected into tab ${tabId}`);
  } catch (error) {
    console.error(`Failed to inject content script into tab ${tabId}:`, error);
  }
};

// API : chrome.runtime.onInstalled
// Purpose : The onInstalled event is fired when the extension is installed or updated
// Permission : "runtime" permission
chrome.runtime.onInstalled.addListener(async () => {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab) {
    console.log("No active tab found");
    return;
  }

  try {
    injectContentScript(activeTab.id, activeTab.url); // Inject content script into the tab where the extension is started
  } catch (error) {
    console.log(
      `Failed to inject into active tab ${activeTab.id}:`,
      error.message
    );
  }
});

// API : chrome.tabs.onUpdated
// Purpose : The onUpdated event is fired when a tab is updated (e.g., URL change)
// Permission : "tabs" permission
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check auth status when returning from login or when URL contains auth-related paths
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.includes("localhost:3000/auth/success") ||
      tab.url.includes("localhost:3000/login") ||
      tab.url.includes("localhost:3000/logout"))
  ) {
    checkAuthStatus();
  }
});

// API : chrome.tabs.onActivated
// Purpose : The onActivated event is fired when a tab is activated or changed
// Permission : "tabs" permission
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (isCapturing) {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    injectContentScript(tab.id, tab.url); // inject content script into the newly activated or changed tab
  }
});

// API : chrome.runtime.onMessage
// Purpose : The onMessage event is fired when a message is sent from another part of the extension
// Permission : "runtime" permission
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "startCapture":
      isCapturing = true;

      // inject content script current active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          const activeTab = tabs[0];
          injectContentScript(activeTab.id, activeTab.url);
        } else {
          console.warn("No active tab found to inject content script.");
        }
      });
      sendResponse({ success: true, isCapturing: true });
      break;

    case "stopCapture":
      isCapturing = false;
      if (captureBuffer.length > 0) {
        saveBatch();
      }
      sendResponse({ success: true, isCapturing: false });
      break;
    case "pauseCapture":
      isCapturing = false;
      // Save any remaining items
      if (captureBuffer.length > 0) {
        saveBatch();
      }
      sendResponse({ success: true, isCapturing: false });
      break;
    case "resumeCapture":
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

      // chrome.runtime.sendMessage({
      //   action: "capture_start",
      //   data: message.data,
      // });

      // API : chrome.tabs.captureVisibleTab
      // Purpose : Capture a screenshot of the visible area of the currently active tab
      // Permission : "tabs" permission
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

          // chrome.runtime
          //   .sendMessage({
          //     action: "capture_finish",
          //     data: {
          //       success: true,
          //       screenshot: dataUrl,
          //       elementInfo: message.data,
          //       buffered: captureBuffer.length,
          //     },
          //   })
          //   .catch(() => {
          //     // Ignore if frontend is not listening
          //   });

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

    case "capture_start":
      break;

    case "capture_finish":
      break;

    default:
      console.warn("Unknown action received: ", message.action);
      sendResponse({ success: false, error: "Unknown action" });
  }
});

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

// Schedule batch save after a timeout
function scheduleBatchSave() {
  clearTimeout(batchTimeout);
  batchTimeout = setTimeout(saveBatch, BATCH_TIMEOUT);
}

// API : chrome.runtime.onSuspend
// Purpose : The onSuspend event is fired when the extension is about to be unloaded
// Permission : "runtime" permission
chrome.runtime.onSuspend.addListener(() => {
  if (captureBuffer.length > 0) {
    saveBatch();
  }
});

// Helper function to check authentication status
async function checkAuthStatus() {
  try {
    const response = await fetch("http://localhost:8000/auth/session", {
      method: "GET",
      credentials: "include",
    });
    const data = await response.json();
    chrome.runtime.sendMessage({
      type: "CHECK_AUTH_STATUS",
      isLoggedIn: data.isLoggedIn,
    });
  } catch (error) {
    console.error("Auth status check error:", error);
  }
}
