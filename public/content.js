let isCapturing = false;
let lastClickTime = 0;
const CLICK_DEBOUNCE = 500; // Prevent rapid clicks

// Check capture status on load and show indicator if needed
chrome.runtime.sendMessage({ action: "get_status" }, (response) => {
  if (response && response.isCapturing) {
    isCapturing = true;
    // Show the indicator when the script loads on a page where capturing is active
    showCaptureIndicator("navigation");
  }
});

function showCaptureIndicator(messageType) {
  if (isCapturing) {
    const overlay = document.createElement("div");
    overlay.id = "stepture-capture-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(128, 128, 128, 0.5);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      z-index: 9999;
      pointer-events: none;
    `;

    const indicator = document.createElement("div");
    indicator.id = "stepture-capture-indicator";
    indicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      z-index: 10000;
      font-size: 18px;
      font-family: Arial, sans-serif;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 20px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 10px;
      max-width: 500px;
    `;

    // Create click icon container with pulse animation
    const clickIcon = document.createElement("div");
    clickIcon.style.cssText = `
      width: 40px;
      height: 40px;
      position: relative;
      animation: pulse 1.5s infinite;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const icon = document.createElement("div");
    icon.style.cssText = `
      width: 32px;
      height: 32px;
      background: white;
      border-radius: 50%;
      position: relative;
      cursor: pointer;
      display: block;
    `;

    icon.innerHTML = `
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 8px;
        height: 8px;
        background: black;
        border-radius: 50%;
      "></div>
      <div style="
        position: absolute;
        top: 2px;
        left: 2px;
        width: 0;
        height: 0;
        border-left: 12px solid #8EACFE;
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
      "></div>
    `;

    clickIcon.appendChild(icon);

    const textElement = document.createElement("div");
    textElement.textContent =
      "Screenshot and annotation will be captured when you click anywhere on the screen";
    textElement.style.cssText = `
      line-height: 1.4;
      font-weight: 500;
    `;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    const timerCountdown = document.createElement("div");
    timerCountdown.style.cssText = `
      margin-top: 10px;
      font-size: 14px;
      color: #ccc;
    `;

    let countdown;
    let countdownText = "";
    let timeTaken;

    // Different messages based on the action type
    switch (messageType) {
      case "startCapture":
        countdown = 3;
        timeTaken = 3000;
        countdownText = `Starting in ${countdown}s ...`;

        break;
      case "resumeCapture":
        timeTaken = 1000;
        countdown = 1;
        countdownText = `Resuming in ${countdown}s ...`;
        break;
      case "navigation":
      case "tabActivated":
        timeTaken = 1000;
        countdown = 1;
        countdownText = `Capture active - Ready in ${countdown}s ...`;
        break;
      default:
        countdown = 1;
        timeTaken = 1000;
        countdownText = `Ready in ${countdown}s ...`;
    }

    timerCountdown.textContent = countdownText;

    const countdownInterval = setInterval(() => {
      countdown -= 1;
      if (countdown > 0) {
        switch (messageType) {
          case "startCapture":
            timerCountdown.textContent = `Starting in ${countdown}s ...`;
            break;
          case "resumeCapture":
            timerCountdown.textContent = `Resuming in ${countdown}s ...`;
            break;
          case "navigation":
          case "tabActivated":
          default:
            timerCountdown.textContent = `Ready in ${countdown}s ...`;
        }
      } else {
        clearInterval(countdownInterval);
        timerCountdown.textContent = "Ready to capture clicks!";
      }
    }, 1000);

    indicator.appendChild(timerCountdown);
    // indicator.appendChild(clickIcon);
    indicator.appendChild(textElement);

    document.body.appendChild(overlay);
    document.body.appendChild(indicator);

    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, timeTaken);
  } else {
    // Remove overlay and indicator if they exist
    if (messageType === "pauseCapture" || messageType === "stopCapture") {
      isCapturing = false;

      // show a brief paused message
      const pausedIndicator = document.createElement("div");
      pausedIndicator.id = "stepture-capture-indicator";
      pausedIndicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        z-index: 10000;
        font-size: 18px;
        font-family: Arial, sans-serif;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 20px;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 10px;
        max-width: 300px;
      `;
      const pausedText = document.createElement("div");
      pausedText.textContent =
        messageType === "pauseCapture" ? "Capture Paused" : "Capture Stopped";
      pausedText.style.cssText = `
        line-height: 1.4;
        font-weight: 500;
      `;
      pausedIndicator.appendChild(pausedText);
      document.body.appendChild(pausedIndicator);
      setTimeout(() => {
        const existingPausedIndicator = document.getElementById(
          "stepture-capture-indicator"
        );
        if (existingPausedIndicator) {
          existingPausedIndicator.remove();
        }
      }, 2000);
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "capture_status_changed") {
    isCapturing = message.isCapturing;
    showCaptureIndicator(message.actionType);
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
