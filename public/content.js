console.log("Content script is running...");

document.addEventListener("click", (event) => {
  const element = event.target;

  const elementInfo = {
    tagName: element.tagName,
    id: element.id || "None",
    className: element.className || "None",
    textContent: element.textContent.trim().substring(0, 100), // Trim content to 100 characters
    href: element.href || "None",
  };

  // Optional: Send the information to the background script
  // chrome.runtime.sendMessage({ type: "elementClick", data: elementInfo });
  console.log("Element information: ", elementInfo);
  chrome.runtime.sendMessage(
    { action: "capture_screenshot", data: elementInfo }
    // (response) => {
    //   if (chrome.runtime.lastError) {
    //     console.warn("Background script is not ready yet.");
    //   }
    // }
  );
});
