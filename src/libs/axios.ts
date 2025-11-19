import axios from "axios";

type CreateDocument = {
  title: string;
  description: string;
  steps: Array<{
    stepDescription: string;
    type: string;
    stepNumber: number;
    screenshot?: {
      googleImageId: string;
      url: string;
      viewportX: number;
      viewportY: number;
      viewportWidth: number;
      viewportHeight: number;
      devicePixelRatio: number;
    };
  }>;
};

const BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "https://stepture.app/api/";

const refreshApi = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const privateApi = axios.create({
  baseURL: BASE_URL,
  timeout: 50000, // to solve the issues with transaction request timeouts
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

async function refreshToken() {
  await refreshApi.post("/auth/refresh-token");
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: unknown = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
  failedQueue = [];
};

privateApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!isRefreshing) {
      isRefreshing = true;

      try {
        await refreshToken();
        processQueue();
        return privateApi(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    } else {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: () => resolve(privateApi(originalRequest)),
          reject,
        });
      });
    }
  }
);

export const api = {
  public: {},
  protected: {
    getMe: async (options = {}) => {
      try {
        const response = await privateApi.get("/auth/me", options);
        return response.data;
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return { user: null };
        }
        throw error;
      }
    },
    createDocument: async (data: CreateDocument) => {
      const response = await privateApi.post("/documents", data);
      return response.data;
    },
    logout: async () => {
      await privateApi.post("/auth/logout");
    },
  },
};
