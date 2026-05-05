import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const ACCESS_TOKEN_KEY = 'token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const authStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(ACCESS_TOKEN_KEY),
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const shouldSkipRefresh = (url?: string) => {
  if (!url) return false;
  return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/register');
};

const refreshAccessToken = async (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const newToken = res.data.access_token;
        authStorage.setAccessToken(newToken);
        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || shouldSkipRefresh(originalRequest.url)) {
      return Promise.reject(error);
    }

    try {
      originalRequest._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
      }
      const newToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      authStorage.clear();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export const clearClientSession = () => {
  authStorage.clear();
};

export const setClientAccessToken = (token: string) => {
  authStorage.setAccessToken(token);
};

export const getClientAccessToken = () => {
  return authStorage.getAccessToken();
};

export default api;
