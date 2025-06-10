import Button from "./Button";
import { stepture } from "../constants/images";
import { useEffect, useState } from "react";

interface ElementInfo {
  textContent: string;
  tagName: string;
  className: string;
  id: string;
}

const Home = () => {
  const [capture, setCapture] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [info, setInfo] = useState<ElementInfo[]>([]);

  const handleStartCapture = () => {
    setCapture(true);
    chrome.runtime.sendMessage({ action: "startCapture" });
  };

  const handleStopCapture = () => {
    setCapture(false);
    chrome.runtime.sendMessage({ action: "stopCapture" });
  };

  useEffect(() => {
    chrome.storage.local.get(["screenshots", "info"], (data) => {
      if (data.screenshots) {
        setScreenshots(data.screenshots);
      }
      if (data.info) {
        setInfo(data.info);
      }
    });
  }, []);

  return (
    <div className="flex items-center justify-center flex-col w-full px-4 py-2">
      {!capture ? (
        <>
          {" "}
          <img src={stepture} alt="Stepture Logo" className="w-18 h-18" />
          <p className="font-semibold mt-2 text-lg">Hey there, MB Triad!</p>
          <p className="text-gray text-xs mb-8 mt-2">
            You can start by capturing your steps.
          </p>
          <Button
            onClick={handleStartCapture}
            color="primary"
            text="Start Capture"
          />
        </>
      ) : (
        <>
          <div className="mt-6 w-full bg-background p-4 rounded-md">
            <div className="screenshots grid gap-4">
              {screenshots.length > 0 ? (
                screenshots.map((img, index) => (
                  <div
                    key={index}
                    className="screenshot-item border-1 border-corner rounded-md p-2.5 bg-white flex flex-col items-start gap-1"
                  >
                    <div className="rounded-sm bg-background font-semibold color-blue px-2 py-1 ">
                      <p className="text-xs text-blue">Step {index + 1}</p>
                    </div>
                    <div className="text-start p-2 text-base text-slate-800">
                      {info[index] && (
                        <>
                          <p>
                            Click:{" "}
                            {info[index].textContent && (
                              <span className="text-slate-600">
                                {info[index].textContent}
                              </span>
                            )}
                          </p>
                        </>
                      )}
                    </div>
                    <img
                      src={img}
                      alt={`Screenshot ${index}`}
                      className="screenshot-img w-full rounded-md"
                    />
                  </div>
                ))
              ) : (
                <p>No screenshots captured yet.</p>
              )}
            </div>
          </div>
          <div className="fixed bottom-2 left-0 right-0 flex justify-center items-center z-10">
            <Button
              onClick={handleStopCapture}
              color="primary"
              text="Stop Capture"
            />
          </div>
        </>
      )}

      {!capture && (
        <>
          <hr className="border-gray-300 w-full my-8" />
          <Button color="secondary" text="View your docs" />
        </>
      )}
    </div>
  );
};

export default Home;
