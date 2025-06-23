import Button from "./Button";
import { stepture } from "../constants/images";
import { useEffect, useState, useCallback, useRef } from "react";

interface ElementInfo {
  textContent: string;
  coordinates: {
    viewport: { x: number; y: number };
    page: { x: number; y: number };
    elementRect: {
      top: number;
      left: number;
      width: number;
      height: number;
    };
  };

  // for future use
  // tagName: string;
  // className: string;
  // id: string;
  // href?: string;
  // type?: string;
  // value?: string;
  // placeholder?: string;
  // timestamp?: string;
  // url?: string;
  // xpath?: string;
}

const Home = ({ name }: { name: string }) => {
  const [isCaptured, setIsCaptured] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [info, setInfo] = useState<ElementInfo[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newScreenshotLoading, setNewScreenshotLoading] = useState(false);

  // Ref to prevent multiple simultaneous loads
  const loadingRef = useRef(false);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "capture_start") {
      setNewScreenshotLoading(true);
      console.log("Capture started");
    }

    if (message.action === "capture_finish") {
      setTimeout(() => {
        setNewScreenshotLoading(false);
        console.log("Capture completed");
      }, 2000); // Simulate delay for UI update
    }
  });

  console.log("Info:", info);

  // Load data from storage
  const loadData = useCallback(async (forceRefresh = false) => {
    if (loadingRef.current && !forceRefresh) return; // Prevent multiple loads

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    setTimeout(() => {}, 1000); // Allow UI to update before loading

    try {
      const response = await chrome.runtime.sendMessage({ action: "get_data" });
      if (response && response.success) {
        setScreenshots(response.data.screenshots || []);
        setInfo(response.data.info || []);
        setIsCaptured(response.isCapturing || false);
        // setBufferSize(response.bufferSize || 0);
      } else {
        throw new Error(response?.error || "Failed to load data");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load data. Please try again.");

      // Fallback to storage AP
      try {
        chrome.storage.local.get(["screenshots", "info"], (data) => {
          if (chrome.runtime.lastError) {
            console.error("Storage error:", chrome.runtime.lastError);
            return;
          }
          setScreenshots(data.screenshots || []);
          setInfo(data.info || []);
        });
      } catch (storageError) {
        console.error("Storage fallback failed:", storageError);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Handle start capture
  const handleStartCapture = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "startCapture",
      });

      if (response && response.success) {
        setIsCaptured(true);
      } else {
        throw new Error(response?.error || "Failed to start capture");
      }
    } catch (error) {
      console.error("Error starting capture:", error);
      setError("Failed to start capture. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleResumeCapture = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "resumeCapture",
      });

      if (response && response.success) {
        setIsPaused(false);
      } else {
        throw new Error(response?.error || "Failed to resume capture");
      }
    } catch (error) {
      console.error("Error resuming capture:", error);
      setError("Failed to resume capture. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePauseCapture = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "pauseCapture",
      });

      if (response && response.success) {
        setIsPaused(true);
      } else {
        throw new Error(response?.error || "Failed to pause capture");
      }
    } catch (error) {
      console.error("Error pausing capture:", error);
      setError("Failed to pause capture. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  // Handle stop capture
  const handleStopCapture = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "stopCapture",
      });

      if (response && response.success) {
        setIsCaptured(false);
        // Refresh data to get any final buffered items
        setTimeout(() => loadData(true), 500);
      } else {
        throw new Error(response?.error || "Failed to stop capture");
      }
    } catch (error) {
      console.error("Error stopping capture:", error);
      setError("Failed to stop capture. Please try again.");
    } finally {
      setLoading(false);
    }

    handleClearData();
  }, [loadData]);

  // Handle clear data
  const handleClearData = useCallback(async () => {
    if (!confirm("Are you sure you want to clear all captured data?")) return;

    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: "clear_data",
      });

      if (response && response.success) {
        setScreenshots([]);
        setInfo([]);
        // setBufferSize(0);
      } else {
        throw new Error("Failed to clear data");
      }
    } catch (error) {
      console.error("Error clearing data:", error);
      setError("Failed to clear data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen for real-time updates from background script
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.action === "data_updated") {
        console.log(
          `New data: ${message.newItemsCount} items, ${message.totalItems} total`
        );
        loadData(true); // Force refresh when new data arrives
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [loadData]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh data every 10 seconds when capturing
  // useEffect(() => {
  //   if (!isCaptured) return;

  //   const interval = setInterval(() => {
  //     loadData();
  //   }, 10000);

  //   return () => clearInterval(interval);
  // }, [isCaptured, loadData]);

  return (
    <div className="flex items-center justify-center flex-col w-full px-4 py-2">
      {/* Error display */}
      {error && (
        <div className="w-full mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {!isCaptured ? (
        <div className="flex flex-col items-center justify-center w-full h-100vh">
          <img src={stepture} alt="Stepture Logo" className="w-18 h-18" />
          <p className="font-semibold mt-2 text-lg">Hey There, {name}</p>
          <p className="text-gray text-xs mb-8 mt-2">
            You can start by capturing your steps.
          </p>
          <Button
            onClick={handleStartCapture}
            color="primary"
            text={loading ? "Starting..." : "Start Capture"}
            disabled={loading}
          />

          {/* Show existing screenshots count */}
          {screenshots.length > 0 && (
            <p className="text-sm text-gray-600 mt-4">
              {screenshots.length} screenshots saved
            </p>
          )}
        </div>
      ) : (
        <div className="relative w-full">
          {/* Status bar */}
          {/* <div className="w-full mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-center">
            <p className="text-sm text-blue-700">
              Stepture is Capturing... ({screenshots.length} steps)
              {bufferSize > 0 && ` | ${bufferSize} pending`}
            </p>
          </div> */}

          <div className="mt-6 w-full bg-background p-4 rounded-md overflow-y-scroll no-scrollbar mb-40">
            <div className="screenshots grid gap-4">
              {loading && screenshots.length === 0 ? (
                <p className="text-center text-gray-500">Loading...</p>
              ) : screenshots.length > 0 ? (
                screenshots.map((img, index) => (
                  <div
                    key={`${index}-${img.substring(0, 20)}`} // Better key
                    className="screenshot-item border-1 border-corner rounded-md p-2.5 bg-white flex flex-col items-start gap-1"
                  >
                    <div className="rounded-sm bg-background font-semibold color-blue px-2 py-1">
                      <p className="text-xs text-blue">Step {index + 1}</p>
                    </div>
                    <div className="text-start p-2 text-base text-slate-800">
                      {info[index] && (
                        <div className="space-y-1">
                          <p>
                            <span className="font-medium">Click:</span>{" "}
                            <span className="text-slate-600">
                              {info[index].textContent && (
                                <span className="text-slate-800">
                                  "{info[index].textContent}"
                                </span>
                              )}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="relative w-full">
                      <img
                        src={img}
                        alt={`Screenshot ${index}`}
                        className="screenshot-img w-full rounded-md"
                        loading="lazy"
                      />
                      {info[index]?.coordinates && (
                        <div
                          className="absolute w-6 h-6 rounded-full border-2 border-red-500 bg-red-500 bg-opacity-30 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                          style={{
                            // top: `${
                            //   (info[index].coordinates.elementRect.top +
                            //     info[index].coordinates.elementRect.height /
                            //       2) /
                            //   5
                            // }px`,
                            // left: `${
                            //   (info[index].coordinates.elementRect.left +
                            //     info[index].coordinates.elementRect.width / 2) /
                            //   5
                            // }px`,
                            //Alternative approach using click coordinates:
                            top: `${info[index].coordinates.page.y / 5}px`,
                            left: `${info[index].coordinates.page.x / 5}px`,
                          }}
                        >
                          <div className="absolute inset-0 animate-ping bg-red-400 rounded-full opacity-75"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500">
                  No screenshots captured yet. Click on elements to start
                  capturing!
                </p>
              )}
              {newScreenshotLoading && (
                // show the loading skeleton
                <div className="screenshot-item border-1 border-corner rounded-md p-2.5 bg-white flex flex-col items-start gap-1">
                  <div className="rounded-sm bg-background font-semibold color-blue px-2 py-1">
                    <p className="text-xs text-blue">Loading new step...</p>
                  </div>
                  <div className="text-start p-2 text-base text-slate-800">
                    <p className="text-gray-500">
                      New step is being captured...
                    </p>
                  </div>
                  <div className="w-full h-48 bg-gray-200 animate-pulse rounded-md"></div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="fixed bottom-0 left-0 right-0 flex justify-center items-center gap-2 flex-col border-t border-corner bg-white p-4 rounded-md shadow-md">
            {isPaused && (
              <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-center">
                <p className="text-sm text-yellow-700">
                  Capture is paused. Click "Resume" to continue.
                </p>
              </div>
            )}
            <div className="mt-4 flex justify-between items-center">
              <Button
                onClick={handleClearData}
                color="secondary"
                text="Delete"
                disabled={loading}
              />
              {!isPaused ? (
                <Button
                  onClick={handlePauseCapture}
                  color="secondary"
                  text="Pause"
                  disabled={loading}
                />
              ) : (
                <Button
                  onClick={handleResumeCapture}
                  color="secondary"
                  text="Resume"
                  disabled={loading}
                />
              )}
            </div>
            <div className="w-full flex justify-center items-center gap-2">
              <Button
                onClick={handleStopCapture}
                color="primary"
                text={loading ? "Stopping..." : "Stop Capture"}
                disabled={loading}
              />
            </div>
          </div>
        </div>
      )}

      {!isCaptured && (
        <>
          <hr className="border-gray-300 w-full my-8" />
          <Button color="secondary" text="View your docs" />
          {screenshots.length > 0 && (
            <Button
              onClick={handleClearData}
              color="secondary"
              text="Clear All Data"
              disabled={loading}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Home;
