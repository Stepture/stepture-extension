let isCapturing = false;

// This will track the currently active tab ID
// My idea is to remove the content script from the previously active tab
// when the user switches to a new tab, and then inject it into the newly active tab
// This way, we can ensure that the content script is only active in the currently focused tab.
let activeTabId;
let activeTabisRecorded = false;
let activeTabUrl;

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
  if (!isCapturing) {
    return false;
  }
  if (
    !tabId ||
    !tabUrl ||
    tabUrl.startsWith("chrome://") ||
    tabUrl.startsWith("chrome-extension://") ||
    tabUrl.startsWith("edge://") ||
    tabUrl.startsWith("about:") ||
    tabUrl.startsWith("moz-extension://") ||
    tabUrl.startsWith("file://")
  ) {
    console.log(`Skipping injection for restricted URL: ${tabUrl}`);
    return false;
  }

  try {
    // Always inject, even if it's the same tab (handles page reloads)
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });

    // Send capture status to the newly injected script
    if (isCapturing) {
      await chrome.tabs.sendMessage(tabId, {
        action: "capture_status_changed",
        isCapturing: true,
      });
    }

    console.log(`Content script injected into tab ${tabId}`);
    return true;
  } catch (error) {
    console.error(`Failed to inject content script into tab ${tabId}:`, error);
    return false;
  }
};

const disableContentScript = async (tabId) => {
  if (!tabId) return false;

  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "capture_status_changed",
      isCapturing: false,
    });
    console.log(`Content script disabled in tab ${tabId}`);
    return true;
  } catch (error) {
    // Tab might be closed or script not injected - this is normal
    console.log(
      `Could not disable content script in tab ${tabId}: ${error.message}`
    );
    return false;
  }
};

// API : chrome.runtime.onInstalled
// Purpose : The onInstalled event is fired when the extension is installed or updated
// Permission : "runtime" permission
chrome.runtime.onInstalled.addListener(async () => {
  // Check auth status on install
  await checkAuthStatus();

  // Inject content script into the currently active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    const activeTab = tabs[0];
    activeTabId = activeTab.id; // Update the active tab ID
    activeTabUrl = activeTab.url; // Store the active tab URL
    injectContentScript(activeTab.id, activeTab.url);
  } else {
    console.warn("No active tab found to inject content script.");
  }
});

// API : chrome.tabs.onUpdated
// Purpose : The onUpdated event is fired when a tab is updated (e.g., URL change)
// Permission : "tabs" permission
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check auth status when returning from login or when URL contains auth-related paths
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.includes("localhost:3000/auth/success") ||
      tab.url.includes("localhost:3000/login") ||
      tab.url.includes("localhost:3000/logout"))
  ) {
    await checkAuthStatus();
  }
});

// API : chrome.tabs.onActivated
// Purpose : The onActivated event is fired when a tab is activated or changed
// Permission : "tabs" permission
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabisRecorded = false; // Reset the flag when switching tabs
  const previousTabId = activeTabId;

  // Disable content script in the previously active tab
  if (previousTabId && previousTabId !== activeInfo.tabId) {
    await disableContentScript(previousTabId);
    console.log(`Content script disabled in previous tab ${previousTabId}`);
  }

  // Update active tab ID
  activeTabId = activeInfo.tabId;
  try {
    const activeTab = await chrome.tabs.get(activeInfo.tabId);
    activeTabUrl = activeTab.url; // Store the active tab URL
  } catch (error) {
    console.error(`Failed to get tab info for ${activeInfo.tabId}:`, error);
    activeTabUrl = null; // Reset URL if tab info cannot be retrieved
  }

  // Inject content script into the newly activated tab if capturing
  if (isCapturing) {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      const injected = await injectContentScript(tab.id, tab.url);
      if (injected) {
        console.log(`Content script injected into new active tab ${tab.id}`);
      }
    } catch (error) {
      console.error(`Failed to get tab info for ${activeInfo.tabId}:`, error);
    }
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
          activeTabId = activeTab.id; // Update the active tab ID
          activeTabUrl = activeTab.url; // Store the active tab URL
          injectContentScript(activeTab.id, activeTab.url);
        } else {
          console.warn("No active tab found to inject content script.");
        }
      });

      chrome.tabs.sendMessage(activeTabId, {
        action: "capture_status_changed",
        isCapturing: isCapturing,
      });

      sendResponse({ success: true, isCapturing: true });
      break;

    case "stopCapture":
      isCapturing = false;

      if (activeTabId) {
        disableContentScript(activeTabId);
        activeTabId = null;
      }

      sendResponse({ success: true, isCapturing: false });
      break;

    case "pauseCapture":
      isCapturing = false;

      if (activeTabId) {
        disableContentScript(activeTabId);
        activeTabId = null;
      }

      sendResponse({ success: true, isCapturing: false });
      break;

    case "resumeCapture":
      isCapturing = true;

      if (activeTabId) {
        try {
          const tab = chrome.tabs.get(activeTabId);
          injectContentScript(activeTabId, tab.url);
        } catch (error) {
          console.error("Failed to resume capture:", error);
          // Fallback: query current active tab
          chrome.tabs.query(
            { active: true, currentWindow: true },
            async (tabs) => {
              if (tabs.length > 0) {
                const activeTab = tabs[0];
                await injectContentScript(activeTab.id, activeTab.url);
                activeTabId = activeTab.id;
              }
            }
          );
        }
      } else {
        // If no active tab ID, query the current active tab
        chrome.tabs.query(
          { active: true, currentWindow: true },
          async (tabs) => {
            if (tabs.length > 0) {
              const activeTab = tabs[0];
              await injectContentScript(activeTab.id, activeTab.url);
              activeTabId = activeTab.id;
            } else {
              console.warn("No active tab found to inject content script.");
            }
          }
        );
      }

      sendResponse({ success: true, isCapturing: true });
      break;

    case "capture_screenshot":
      if (!isCapturing) {
        sendResponse({ success: false, error: "Not capturing" });
        return;
      }

      // Save tab URL as step if this is the first screenshot in this tab
      if (activeTabId && !activeTabisRecorded) {
        try {
          saveTabAsStep({
            tab: activeTabUrl,
          });
          activeTabisRecorded = true; // Mark this tab as recorded
        } catch (error) {
          console.error("Failed to save tab step:", error);
        }
      }

      chrome.tabs.captureVisibleTab(
        null,
        { format: "png" },
        async (dataUrl) => {
          // Save immediately with pending upload status
          const captureData = {
            tab: null,
            screenshot: dataUrl,
            imgId: null,
            info: message.data,
            uploadStatus: "pending",
            timestamp: new Date().toISOString(),
          };
          sendResponse({ success: true, data: captureData });
          // Save to storage immediately
          const storageData = await chrome.storage.local.get({ captures: [] });
          storageData.captures.push(captureData);
          await chrome.storage.local.set(storageData);
          uploadInBackground(captureData);
        }
      );
      return true;

    // frontend requests data
    case "get_data":
      checkUploadedStatus().then(() => {
        chrome.storage.local.get({ captures: [] }, (data) => {
          sendResponse({
            success: true,
            data: data.captures,
            isCapturing: isCapturing,
          });
        });
      });

      return true;

    case "clear_data":
      chrome.storage.local.set({ captures: [] }, () => {
        sendResponse({ success: true });
      });
      return true;

    // content script checks the status on load
    case "get_status":
      sendResponse({
        isCapturing: isCapturing,
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

const uploadQueue = [];

async function checkUploadedStatus() {
  const storageData = await chrome.storage.local.get({ captures: [] });
  const pendingCaptures = storageData.captures.filter(
    (capture) => capture.uploadStatus === "pending"
  );
  if (pendingCaptures.length > 0) {
    for (const capture of pendingCaptures) {
      await uploadInBackground(capture);
    }
  } else {
    console.log("No pending captures to upload.");
  }
}

async function uploadInBackground(captureData) {
  try {
    const formData = new FormData();
    const blob = await dataURLtoBlob(captureData.screenshot);
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
      const result = await response.json();
      // Update storage with uploaded URL
      const storageData = await chrome.storage.local.get({ captures: [] });
      const captureIndex = storageData.captures.findIndex(
        (c) => c.timestamp === captureData.timestamp
      );

      if (captureIndex !== -1) {
        storageData.captures[captureIndex].screenshot = result.publicUrl;
        storageData.captures[captureIndex].imgId = result.imgId;
        storageData.captures[captureIndex].uploadStatus = "completed";
        await chrome.storage.local.set(storageData);
      }
    }
  } catch (error) {
    console.error("Background upload failed:", error);
  }
}

const saveTabAsStep = async (tab) => {
  if (!isCapturing) return;

  // Save tab step only if it hasn't been recorded yet
  if (activeTabisRecorded) return;

  try {
    const tabData = {
      tab: tab?.tab,
      screenshot: null,
      imgId: null,
      info: {
        textContent: `${tab?.tab}`,
        coordinates: { viewport: { x: 0, y: 0 } },
        captureContext: {
          devicePixelRatio: 1,
          viewportWidth: 0,
          viewportHeight: 0,
          screenWidth: 0,
          screenHeight: 0,
        },
        tagName: "TAB_NAVIGATION",
        stepType: "navigation",
      },
      uploadStatus: "completed",
      timestamp: new Date().toISOString(),
    };

    // Save tab step to storage
    const storageData = await chrome.storage.local.get({ captures: [] });
    storageData.captures.push(tabData);
    await chrome.storage.local.set(storageData);

    try {
      chrome.runtime.sendMessage({
        action: "screenshot_captured",
        message: tabData,
      });
    } catch (e) {
      // Frontend might not be listening
    }
  } catch (error) {
    console.error("Failed to save tab step:", error);
  }
};
