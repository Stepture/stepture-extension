export const LoadingSkeleton = () => (
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

// Document Creation Loading Component
export const DocumentCreationLoading = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Creating Document
      </h3>
      <p className="text-gray-600 text-sm">
        Please wait while we process your captured steps and create your
        document...
      </p>
      <div className="mt-4 bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full animate-pulse"
          style={{ width: "70%" }}
        ></div>
      </div>
    </div>
  </div>
);
