let isCapturing = false;
let lastClickTime = 0;
const CLICK_DEBOUNCE = 500; // Prevent rapid clicks

// Check capture status on load
chrome.runtime.sendMessage({ action: "get_status" }, (response) => {
  if (response && response.isCapturing) {
    isCapturing = true;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "capture_status_changed") {
    isCapturing = message.isCapturing;
    showCaptureIndicator();
  }
});

document.addEventListener("click", async (event) => {
  if (!isCapturing) return;

  // Debounce rapid clicks
  const now = Date.now();
  if (now - lastClickTime < CLICK_DEBOUNCE) {
    console.log("Click ignored - too rapid");
    return;
  }
  lastClickTime = now;

  const element = event.target;

  // Capture both viewport coordinates and absolute page coordinates
  // View port coordinates are relative to the visible part of the page
  // Page coordinates are relative to the entire document
  const viewportX = event.clientX;
  const viewportY = event.clientY;
  const pageX = event.pageX;
  const pageY = event.pageY;

  // Get more detailed element info
  const elementInfo = {
    tagName: element.tagName,
    id: element.id || "None",
    className: element.className || "None",
    textContent: element.textContent
      ? element.textContent.trim().substring(0, 100)
      : "",
    href: element.href || "None",
    type: element.type || "None",
    value: element.value || "None",
    placeholder: element.placeholder || "None",
    timestamp: new Date().toISOString(),
    url: window.location.href,
    // Coordinates information
    coordinates: {
      viewport: { x: viewportX, y: viewportY },
    },
    captureContext: {
      devicePixelRatio: window.devicePixelRatio,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    },
  };

  try {
    if (isCapturing) {
      showClickFeedback(element, pageX, pageY);
    }

    // to frontend for skeleton loading
    await chrome.runtime.sendMessage({
      action: "capture_start",
    });

    // to background script to capture screenshot
    const response = await chrome.runtime.sendMessage({
      action: "capture_screenshot",
      data: elementInfo,
    });

    // to frontend for skeleton loading
    await chrome.runtime.sendMessage({
      action: "capture_finish",
    });

    if (response && response.success) {
      chrome.runtime.sendMessage({
        action: "screenshot_captured",
        message: response.data,
      });
    } else {
      console.warn("Screenshot capture failed:", response?.error);
    }
  } catch (error) {
    console.error("Error sending screenshot message:", error);
  }
});

// Visual feedback for clicks
function showClickFeedback(element, x, y) {
  const feedback = document.createElement("div");
  feedback.style.cssText = `
    position: absolute;
    width: 20px;
    height: 20px;
    background: #6495ED;
    border-radius: 50%;
    pointer-events: none;
    z-index: 10000;
    opacity: 1;
    left: ${x - 10}px;
    top: ${y - 10}px;
    transform: scale(0.5);
    transition: transform 0.6s ease-out, opacity 0.6s ease-out;
  `;

  document.body.appendChild(feedback);

  // Force a reflow to ensure the initial state is applied
  feedback.offsetWidth;

  // Apply the end state using transition instead of animation
  feedback.style.transform = "scale(2)";
  feedback.style.opacity = "0";

  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.parentNode.removeChild(feedback);
    }
  }, 600);
}
