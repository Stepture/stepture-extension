const GOOGLE_ORIGIN = "https://www.google.com";

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);

  if (url.origin === GOOGLE_ORIGIN) {
    await chrome.sidePanel;
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error))
      .setOptions({
        tabId,
        path: "index.html",
        enabled: true,
      });
  } else {
    // Disables the side panel on all other sites
    await chrome.sidePanel.chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error))
      .setOptions({
        tabId,
        enabled: false,
      });
  }
});
