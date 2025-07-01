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
  // if already injected, skip injection
  const [existingTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (existingTab && existingTab.id === tabId) {
    console.log(`Content script already injected into tab ${tabId}`);
    return;
  }
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
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          const activeTab = tabs[0];
          injectContentScript(activeTab.id, activeTab.url);
        } else {
          console.warn("No active tab found to inject content script.");
        }
      });

      chrome.runtime.sendMessage({
        action: "capture_status_changed",
        isCapturing: true,
      });

      sendResponse({ success: true, isCapturing: true });
      break;

    case "stopCapture":
      isCapturing = false;

      chrome.runtime.sendMessage({
        action: "capture_status_changed",
        isCapturing: false,
      });

      if (captureBuffer.length > 0) {
        saveBatch();
      }
      sendResponse({ success: true, isCapturing: false });
      break;

    case "pauseCapture":
      isCapturing = false;

      // Notify content script about capture status change
      chrome.runtime.sendMessage({
        action: "capture_status_changed",
        isCapturing: false,
      });
      // Save any remaining items
      if (captureBuffer.length > 0) {
        saveBatch();
      }
      sendResponse({ success: true, isCapturing: false });
      break;

    case "resumeCapture":
      isCapturing = true;
      // Notify content script about capture status change
      chrome.runtime.sendMessage({
        action: "capture_status_changed",
        isCapturing: true,
      });
      sendResponse({ success: true, isCapturing: true });
      break;

    case "capture_screenshot":
      if (!isCapturing) {
        sendResponse({ success: false, error: "Not capturing" });
        return;
      }

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

          // upload the screenshot to Google Drive
          const formData = new FormData();

          // Convert data URL to Blob
          const blob = await dataURLtoBlob(dataUrl);
          formData.append("file", blob, "screenshot.png");
          const response = await fetch(
            "http://localhost:8000/google-drive/upload-image",
            {
              method: "POST",
              body: formData,
              credentials: "include",
            }
          );

          if (response.ok) {
            // Parse the JSON response
            const result = await response.json();
            const uploadedScreenshotUrl = result?.publicUrl;
            const uploadedScreenshotId = result?.imgId;
            console.log(
              "Screenshot uploaded successfully:",
              uploadedScreenshotUrl,
              uploadedScreenshotId
            );
            captureBuffer.push(uploadedScreenshotUrl);
            captureBuffer.push(uploadedScreenshotId);
            infoBuffer.push(message.data);

            if (captureBuffer.length >= BATCH_SIZE) {
              await saveBatch();
            } else {
              scheduleBatchSave();
            }

            // This will be sent to the side panel - frontend
            const data = {
              tab: null,
              screenshot: uploadedScreenshotUrl,
              imgId: uploadedScreenshotId,
              info: message.data,
            };

            sendResponse({ success: true, data: data });
          } else {
            const errorText = await response.text();
            console.error("Upload failed:", response.status, errorText);
            sendResponse({
              success: false,
              error: `Upload failed: ${response.status} ${errorText}`,
            });
          }
        }
      );
      return true; // Keep message channel open

    // frontend requests data
    case "get_data":
      chrome.storage.local.get({ captures: [] }, (data) => {
        sendResponse({
          success: true,
          data: data.captures,
          isCapturing: isCapturing,
          bufferSize: captureBuffer.length,
        });
      });
      return true;

    case "clear_data":
      chrome.storage.local.set({ captures: [] }, () => {
        captureBuffer = [];
        infoBuffer = [];
        sendResponse({ success: true });
      });
      return true;

    // content script checks the status on load
    case "get_status":
      sendResponse({
        isCapturing: isCapturing,
        bufferSize: captureBuffer.length,
      });
      break;

    case "capture_start":
      break; // This is handled in the frontend, no action needed here

    case "capture_finish":
      break; // This is handled in the frontend, no action needed here

    case "screenshot_captured":
      break; // This is handled in the frontend, no action needed here

    default:
      console.warn("Unknown action received: ", message.action);
      sendResponse({ success: false, error: "Unknown action" });
  }
});

// Batch save function
async function saveBatch() {
  if (captureBuffer.length === 0) return;

  try {
    const data = await chrome.storage.local.get({ captures: [] });

    // Build new batch as array of objects
    const newCaptures = captureBuffer.map((screenshot, i) => ({
      tab: null,
      screenshot,
      info: infoBuffer[i],
    }));

    // Limit total items to prevent memory issues
    let captures = [...data.captures, ...newCaptures];
    if (captures.length > MAX_STORAGE_ITEMS) {
      captures = captures.slice(captures.length - MAX_STORAGE_ITEMS);
    }

    await chrome.storage.local.set({ captures });

    console.log(
      `Batch saved: ${newCaptures.length} new items, ${captures.length} total`
    );
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
    const response = await fetch("http://localhost:8000/auth/me", {
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

async function dataURLtoBlob(dataURL) {
  const response = await fetch(dataURL);
  return await response.blob();
}
