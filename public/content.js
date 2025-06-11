// Optimized content.js
console.log("Content script is running...");

let isCapturing = false;
let lastClickTime = 0;
const CLICK_DEBOUNCE = 500; // Prevent rapid clicks

// Check capture status on load
chrome.runtime.sendMessage({ action: "get_status" }, (response) => {
  if (response && response.isCapturing) {
    isCapturing = true;
    console.log("Capture is already active");
  }
});

// Listen for capture status changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "capture_status_changed") {
    isCapturing = message.isCapturing;
    console.log(`Capture status changed: ${isCapturing}`);
  }
});

document.addEventListener("click", async (event) => {
  // Only process clicks when capturing
  if (!isCapturing) return;

  // Debounce rapid clicks
  const now = Date.now();
  if (now - lastClickTime < CLICK_DEBOUNCE) {
    console.log("Click ignored - too rapid");
    return;
  }
  lastClickTime = now;

  const element = event.target;

  // Get more detailed element info
  const elementInfo = {
    tagName: element.tagName,
    id: element.id || "None",
    className: element.className || "None",
    textContent: element.textContent
      ? element.textContent.trim().substring(0, 100)
      : "None",
    href: element.href || "None",
    type: element.type || "None",
    value: element.value || "None",
    placeholder: element.placeholder || "None",
    timestamp: new Date().toISOString(),
    url: window.location.href,
    xpath: getXPath(element),
  };

  try {
    const response = await chrome.runtime.sendMessage({
      action: "capture_screenshot",
      data: elementInfo,
    });

    if (response && response.success) {
      console.log("Screenshot captured successfully");
      // Optional: Visual feedback - green circle at click position
      showClickFeedback(element);
    } else {
      console.warn("Screenshot capture failed:", response?.error);
    }
  } catch (error) {
    console.error("Error sending screenshot message:", error);
  }
});

// Helper function to get XPath of element
function getXPath(element) {
  if (!element) return "";

  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  if (element === document.body) {
    return "/html/body";
  }

  let path = "";
  let current = element;

  while (current && current !== document.body) {
    const tagName = current.tagName.toLowerCase();
    const siblings = Array.from(current.parentNode?.children || []).filter(
      (sibling) => sibling.tagName === current.tagName
    );

    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      path = `/${tagName}[${index}]${path}`;
    } else {
      path = `/${tagName}${path}`;
    }

    current = current.parentNode;
  }

  return `/html/body${path}`;
}

// Optional: Visual feedback for clicks
function showClickFeedback(element) {
  const feedback = document.createElement("div");
  feedback.style.cssText = `
    position: absolute;
    width: 20px;
    height: 20px;
    background: #4CAF50;
    border-radius: 50%;
    pointer-events: none;
    z-index: 10000;
    animation: clickFeedback 0.6s ease-out forwards;
  `;

  // Add animation keyframes if not already added
  if (!document.getElementById("click-feedback-styles")) {
    const styles = document.createElement("style");
    styles.id = "click-feedback-styles";
    styles.textContent = `
      @keyframes clickFeedback {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
    `;
    document.head.appendChild(styles);
  }

  const rect = element.getBoundingClientRect();
  feedback.style.left = rect.left + rect.width / 2 - 10 + window.scrollX + "px";
  feedback.style.top = rect.top + rect.height / 2 - 10 + window.scrollY + "px";

  document.body.appendChild(feedback);

  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.parentNode.removeChild(feedback);
    }
  }, 600);
}
