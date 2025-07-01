import Button from "./Button";
import { stepture } from "../constants/images";
import { useEffect, useState, useCallback, useRef } from "react";

interface CaptureData {
  tab: any; // or specify the type if you use it
  screenshot: string;
  info: ElementInfo;
}

interface ElementInfo {
  textContent: string;
  coordinates: {
    viewport: { x: number; y: number };
  };
  captureContext?: {
    devicePixelRatio: number;
    viewportWidth: number;
    viewportHeight: number;
    screenWidth: number;
    screenHeight: number;
  };
}

interface ChromeMessage {
  action: string;
  newItemsCount?: number;
  totalItems?: number;
  success?: boolean;
  error?: string;
  data?: CaptureData[]; // Now an array of capture objects
  isCapturing?: boolean;
  message?: CaptureData;
}

// Responsive Screenshot Item Component
const ResponsiveScreenshotItem = ({
  img,
  index,
  info,
}: {
  img: string;
  index: number;
  info: ElementInfo;
}) => {
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [containerWidth, setContainerWidth] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle image load to get original dimensions
  const handleImageLoad = useCallback(() => {
    const imgElement = imgRef.current;
    if (imgElement) {
      setImageDimensions({
        width: imgElement.naturalWidth,
        height: imgElement.naturalHeight,
      });
    }
  }, []);

  // Calculate responsive position based on current container width
  // Updated getResponsivePosition function with proper coordinate handling
  const getResponsivePosition = useCallback(() => {
    if (
      !info?.coordinates ||
      imageDimensions.width === 0 ||
      containerWidth === 0
    ) {
      return { left: "50%", top: "50%" };
    }

    // Get the capture context if available
    const captureContext = info.captureContext;

    // Method 1: Use capture context for accurate positioning
    if (captureContext) {
      const {
        devicePixelRatio = 1,
        viewportWidth,
        viewportHeight,
      } = captureContext;

      // Screenshots are typically captured at actual device pixels
      // So we need to account for device pixel ratio
      const actualScreenshotWidth = imageDimensions.width;
      const actualScreenshotHeight = imageDimensions.height;

      // The viewport coordinates from the content script are in CSS pixels
      // Convert to percentage of the actual screenshot
      let xPercent, yPercent;

      if (viewportWidth && viewportHeight) {
        // Method A: Use viewport dimensions from capture context
        // Account for device pixel ratio scaling
        // const scaledViewportWidth = viewportWidth * devicePixelRatio;
        // const scaledViewportHeight = viewportHeight * devicePixelRatio;

        // Calculate position as percentage
        xPercent =
          ((info.coordinates.viewport.x * devicePixelRatio) /
            actualScreenshotWidth) *
          100;
        yPercent =
          ((info.coordinates.viewport.y * devicePixelRatio) /
            actualScreenshotHeight) *
          100;
      } else {
        // Method B: Fallback - assume screenshot dimensions match viewport
        xPercent =
          ((info.coordinates.viewport.x * devicePixelRatio) /
            actualScreenshotWidth) *
          100;
        yPercent =
          ((info.coordinates.viewport.y * devicePixelRatio) /
            actualScreenshotHeight) *
          100;
      }

      // Debug logging for the first item only
      if (index === 0) {
        console.log("Enhanced Position Calculation:", {
          originalCoords: info.coordinates.viewport,
          devicePixelRatio,
          captureViewport: { width: viewportWidth, height: viewportHeight },
          screenshotDimensions: {
            width: actualScreenshotWidth,
            height: actualScreenshotHeight,
          },
          calculatedPercent: { x: xPercent, y: yPercent },
          scaledCoords: {
            x: info.coordinates.viewport.x * devicePixelRatio,
            y: info.coordinates.viewport.y * devicePixelRatio,
          },
        });
      }

      return {
        left: `${Math.min(Math.max(xPercent, 0), 100)}%`,
        top: `${Math.min(Math.max(yPercent, 0), 100)}%`,
      };
    }

    // Method 2: Fallback - Direct percentage calculation (original method)
    // This assumes the screenshot dimensions directly correspond to viewport
    const originalScreenshotWidth = imageDimensions.width;
    const originalScreenshotHeight = imageDimensions.height;

    const xPercent =
      (info.coordinates.viewport.x / originalScreenshotWidth) * 100;
    const yPercent =
      (info.coordinates.viewport.y / originalScreenshotHeight) * 100;

    // Debug logging
    if (index === 0) {
      console.log("Fallback Position Calculation:", {
        originalImageSize: {
          width: originalScreenshotWidth,
          height: originalScreenshotHeight,
        },
        viewportCoords: info.coordinates.viewport,
        calculatedPercent: { x: xPercent, y: yPercent },
      });
    }

    return {
      left: `${Math.min(Math.max(xPercent, 0), 100)}%`,
      top: `${Math.min(Math.max(yPercent, 0), 100)}%`,
    };
  }, [info, imageDimensions, containerWidth, index]);
  // Get responsive indicator size
  const getIndicatorSize = useCallback(() => {
    if (containerWidth === 0) return 32;

    // Scale indicator based on container width
    const baseSize = 32;
    const scaleFactor = Math.min(containerWidth / 400, 1.5); // Max 1.5x scaling
    return Math.max(16, Math.min(48, baseSize * scaleFactor));
  }, [containerWidth]);

  // Set up ResizeObserver to track container width changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateContainerWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    // Initial measurement
    updateContainerWidth();

    // Use ResizeObserver for efficient resize detection
    const resizeObserver = new ResizeObserver(() => {
      updateContainerWidth();
    });

    resizeObserver.observe(container);

    // Fallback: Listen to window resize (for older browsers)
    const handleResize = () => updateContainerWidth();
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Also listen for extension sidebar resize events
  useEffect(() => {
    const handleSidebarResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    // Chrome extension specific resize detection
    const observer = new MutationObserver(() => {
      handleSidebarResize();
    });

    if (containerRef.current && document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }

    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={containerRef}
      className="screenshot-item border-1 border-corner rounded-md p-2.5 bg-white flex flex-col items-start gap-1"
    >
      <div className="rounded-sm bg-background font-semibold color-blue px-2 py-1">
        <p className="text-xs text-blue">Step {index + 1}</p>
      </div>

      <div className="text-start p-2 text-base text-slate-800">
        {info && (
          <div className="space-y-1">
            <p>
              <span className="font-medium">Click:</span>{" "}
              <span className="text-slate-600">
                {info.textContent && (
                  <span className="text-slate-800">"{info.textContent}"</span>
                )}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="relative w-full">
        <img
          ref={imgRef}
          src={img}
          alt={`Screenshot ${index + 1}`}
          className="screenshot-img w-full rounded-md block"
          loading="lazy"
          onLoad={handleImageLoad}
          onError={() =>
            console.error(`Failed to load image for step ${index + 1}`)
          }
        />

        {info?.coordinates &&
          imageDimensions.width > 0 &&
          containerWidth > 0 && (
            <div
              className="absolute opacity-50 rounded-full border-4 border-blue-300 bg-blue-500 bg-opacity-30 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200"
              style={{
                ...getResponsivePosition(),
                width: `${getIndicatorSize()}px`,
                height: `${getIndicatorSize()}px`,
              }}
              aria-label={`Click indicator for step ${index + 1}`}
            >
              <div className="absolute inset-0 animate-ping bg-blue-400 rounded-full opacity-50"></div>
            </div>
          )}
      </div>
    </div>
  );
};

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="screenshot-item border-1 border-corner rounded-md p-2.5 bg-white flex flex-col items-start gap-1">
    <div className="rounded-sm bg-background font-semibold color-blue px-2 py-1">
      <p className="text-xs text-blue">Loading new step...</p>
    </div>
    <div className="text-start p-2 text-base text-slate-800">
      <p className="text-gray-500">New step is being captured...</p>
    </div>
    <div className="w-full h-48 bg-gray-200 animate-pulse rounded-md"></div>
  </div>
);

// Error display component
const ErrorDisplay = ({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss: () => void;
}) => (
  <div className="w-full mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
    {error}
    <button
      onClick={onDismiss}
      className="ml-2 text-red-500 hover:text-red-700"
      aria-label="Dismiss error"
    >
      ×
    </button>
  </div>
);

const Home = ({ name }: { name: string }) => {
  const [isCaptured, setIsCaptured] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [captures, setCaptures] = useState<CaptureData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newScreenshotLoading, setNewScreenshotLoading] = useState(false);

  const loadingRef = useRef(false);
  const lastCaptureRef = useRef<HTMLDivElement | null>(null);

  const handleChromeMessage = useCallback((message: ChromeMessage) => {
    switch (message.action) {
      case "capture_start":
        setNewScreenshotLoading(true);
        break;
      case "capture_finish":
        setNewScreenshotLoading(false);
        break;
      case "screenshot_captured":
        // When there is a new screenshot captured.
        // we only add it to the captures state
        if (message.message) {
          const newCapture: CaptureData = {
            tab: message.message?.tab,
            screenshot: message?.message?.screenshot,
            info: message.message?.info,
          };
          setCaptures((prev) => [...prev, newCapture]);
        }
        break;
    }
  }, []);

  const sendChromeMessage = useCallback(
    async (message: any): Promise<ChromeMessage> => {
      try {
        if (!chrome?.runtime?.sendMessage) {
          throw new Error("Chrome runtime not available");
        }
        const response = await chrome.runtime.sendMessage(message);
        if (!response) {
          throw new Error("No response from background script");
        }
        return response;
      } catch (error) {
        console.error("Chrome message error:", error);
        throw error;
      }
    },
    []
  );

  const loadData = useCallback(
    async (forceRefresh = false) => {
      if (loadingRef.current && !forceRefresh) return;

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const response = await sendChromeMessage({ action: "get_data" });

        if (response.success) {
          setCaptures(response.data || []);
          setIsCaptured(response.isCapturing || false);
        } else {
          throw new Error(response.error || "Failed to load data");
        }
      } catch (error) {
        setError("Failed to load data. Please try again.");
        // Fallback to storage API
        try {
          if (chrome?.storage?.local) {
            chrome.storage.local.get(["captures"], (data) => {
              if (chrome.runtime.lastError) {
                return;
              }
              setCaptures(data.captures || []);
            });
          }
        } catch (storageError) {}
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [sendChromeMessage]
  );

  // Generic handler for capture actions
  const handleCaptureAction = useCallback(
    async (
      action: string,
      successCallback?: () => void,
      errorMessage?: string
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await sendChromeMessage({ action });

        if (response.success) {
          successCallback?.();
        } else {
          throw new Error(response.error || `Failed to ${action}`);
        }
      } catch (error) {
        console.error(`Error ${action}:`, error);
        setError(errorMessage || `Failed to ${action}. Please try again.`);
      } finally {
        setLoading(false);
      }
    },
    [sendChromeMessage]
  );

  // Handle start capture
  const handleStartCapture = useCallback(() => {
    handleCaptureAction(
      "startCapture",
      () => setIsCaptured(true),
      "Failed to start capture. Please try again."
    );
  }, [handleCaptureAction]);

  // Handle resume capture
  const handleResumeCapture = useCallback(() => {
    handleCaptureAction(
      "resumeCapture",
      () => setIsPaused(false),
      "Failed to resume capture. Please try again."
    );
  }, [handleCaptureAction]);

  // Handle pause capture
  const handlePauseCapture = useCallback(() => {
    handleCaptureAction(
      "pauseCapture",
      () => setIsPaused(true),
      "Failed to pause capture. Please try again."
    );
  }, [handleCaptureAction]);

  // Handle stop capture
  const handleStopCapture = useCallback(() => {
    handleCaptureAction(
      "stopCapture",
      () => {
        setIsCaptured(false);
        setTimeout(() => loadData(true), 500);
        handleClearData();
      },
      "Failed to stop capture. Please try again."
    );
  }, [handleCaptureAction, loadData]);

  // Handle clear data
  const handleClearData = useCallback(async () => {
    if (!confirm("Are you sure you want to clear all captured data?")) return;
    setLoading(true);
    try {
      const response = await sendChromeMessage({ action: "clear_data" });
      if (response.success) {
        setCaptures([]);
      } else {
        throw new Error("Failed to clear data");
      }
    } catch (error) {
      setError("Failed to clear data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [sendChromeMessage]);

  // Set up message listeners
  useEffect(() => {
    if (!chrome?.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener(handleChromeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleChromeMessage);
    };
  }, [handleChromeMessage]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (lastCaptureRef.current) {
      lastCaptureRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      lastCaptureRef.current.scrollTop += 100; // Adjust scroll position to ensure visibility
    }
  }, [captures.length]);

  return (
    <div className="flex items-center justify-center flex-col w-full px-4 py-2">
      {/* Error display */}
      {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}

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
          {captures.length > 0 && (
            <p className="text-sm text-gray-600 mt-4">
              {captures.length} screenshots saved
            </p>
          )}
        </div>
      ) : (
        <div className="relative w-full">
          <div className="mt-6 w-full bg-background p-4 rounded-md overflow-y-scroll no-scrollbar mb-40">
            <div className="screenshots grid gap-4">
              {loading && captures.length === 0 ? (
                <p className="text-center text-gray-500">Loading...</p>
              ) : captures.length > 0 ? (
                captures.map((capture, index) => (
                  <div
                    key={`${index}-${capture.screenshot.substring(0, 20)}`}
                    ref={index === captures.length - 1 ? lastCaptureRef : null}
                  >
                    <ResponsiveScreenshotItem
                      img={capture.screenshot}
                      index={index}
                      info={capture.info}
                    />
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500">
                  No screenshots captured yet. Click on elements to start
                  capturing!
                </p>
              )}
              {newScreenshotLoading && <LoadingSkeleton />}
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
            <div className="mt-4 flex justify-between items-center w-full">
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
          {captures.length > 0 && (
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
