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
const injectContentScript = async (tabId, tabUrl, action) => {
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
        actionType: action || "startCapture",
      });
    }
    return true;
  } catch (error) {
    console.error(`Failed to inject content script into tab ${tabId}:`, error);
    return false;
  }
};

const disableContentScript = async (tabId, actionType) => {
  if (!tabId) return false;

  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "capture_status_changed",
      isCapturing: false,
      actionType: actionType,
    });
    return true;
  } catch (error) {
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
    (tab.url.includes("https://stepture.app/auth/success") ||
      tab.url.includes("https://stepture.app/login") ||
      tab.url.includes("https://stepture.app/logout"))
  ) {
    await checkAuthStatus();
  }

  // Handle URL changes and page loads for the active tab
  if (changeInfo.status === "complete" && tabId === activeTabId) {
    // Reset the recorded flag for the active tab when URL changes
    activeTabisRecorded = false;

    // Update the stored URL
    activeTabUrl = tab.url;

    // Re-inject content script if capturing (for URL changes, redirects, etc.)
    if (isCapturing) {
      await injectContentScript(tabId, tab.url, "navigation");
    }
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
    await disableContentScript(previousTabId, "tabSwitch");
  }

  // Update active tab ID
  activeTabId = activeInfo.tabId;

  try {
    const activeTab = await chrome.tabs.get(activeInfo.tabId);

    activeTabUrl = activeTab.url; // Store the active tab URL

    // Inject content script into the newly activated tab if capturing
    if (isCapturing && activeTab.status === "complete") {
      const injected = await injectContentScript(
        activeTab.id,
        activeTab.url,
        "tabActivated"
      );
    }
  } catch (error) {
    console.error(`Failed to get tab info for ${activeInfo.tabId}:`, error);
    activeTabUrl = null;
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
          injectContentScript(activeTab.id, activeTab.url, "startCapture");
        } else {
          console.warn("No active tab found to inject content script.");
        }
      });

      sendResponse({ success: true, isCapturing: true });
      break;

    case "stopCapture":
      isCapturing = false;

      if (activeTabId) {
        disableContentScript(activeTabId, "stopCapture");
        activeTabId = null;
      }

      sendResponse({ success: true, isCapturing: false });
      break;

    case "pauseCapture":
      isCapturing = false;

      if (activeTabId) {
        disableContentScript(activeTabId, "pauseCapture");
        activeTabId = null;
      }

      sendResponse({ success: true, isCapturing: false });
      break;

    case "resumeCapture":
      isCapturing = true;

      if (activeTabId) {
        try {
          chrome.tabs.get(activeTabId).then(async (tab) => {
            await injectContentScript(activeTabId, tab.url, "resumeCapture");
          });
        } catch (error) {
          console.error("Failed to resume capture:", error);
          // Fallback: query current active tab
          chrome.tabs.query(
            { active: true, currentWindow: true },
            async (tabs) => {
              if (tabs.length > 0) {
                const activeTab = tabs[0];
                await injectContentScript(
                  activeTab.id,
                  activeTab.url,
                  "resumeCapture"
                );
                activeTabId = activeTab.id;
                activeTabUrl = activeTab.url;
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
              await injectContentScript(
                activeTab.id,
                activeTab.url,
                "resumeCapture"
              );
              activeTabId = activeTab.id;
              activeTabUrl = activeTab.url;
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
    const response = await fetch("https://stepture.app/api/auth/me", {
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
  return new Promise((resolve) => {
    const checkPending = async () => {
      const storageData = await chrome.storage.local.get({ captures: [] });
      const pendingCaptures = storageData.captures.filter(
        (capture) => capture.uploadStatus === "pending"
      );

      if (pendingCaptures.length === 0) {
        resolve();
      } else {
        // Wait 1 second before checking again
        setTimeout(checkPending, 1000);
      }
    };
    checkPending();
  });
}

async function uploadInBackground(captureData) {
  try {
    const formData = new FormData();
    const blob = await dataURLtoBlob(captureData.screenshot);

    const time = new Date(captureData.timestamp);
    const year = time.getFullYear();
    const month = String(time.getMonth() + 1).padStart(2, "0");
    const day = String(time.getDate()).padStart(2, "0");
    const minute = String(time.getMinutes()).padStart(2, "0");
    const hour = String(time.getHours()).padStart(2, "0");
    const name = `screenshot-${year}${month}${day}-${hour}${minute}.png`;

    formData.append("file", blob, name);

    const response = await fetch(
      "https://stepture.app/api/google-drive/upload-image",
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
        textContent: `Navigate to: ${tab?.tab}`,
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
