import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { MesEnvelope } from '../types/api';
import { getToken, clearToken } from '../auth/tokenStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('VITE_API_BASE_URL is not set — API calls will fail. See .env.example.');
}

export class ApiError extends Error {
  status: number;
  fieldErrors?: unknown;

  constructor(message: string, status: number, fieldErrors?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Set by AuthProvider so the client can react to session expiry without a circular import.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

const http = axios.create({ baseURL: BASE_URL });

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const RETRYABLE_STATUS = 500;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(config: AxiosRequestConfig, isLoginCall = false): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await http.request<MesEnvelope<T>>(config);
      const envelope = response.data;
      if (envelope.status_code >= 400) {
        throw new ApiError(envelope.message, envelope.status_code);
      }
      return envelope.data;
    } catch (err) {
      lastError = err;
      const axiosErr = err as AxiosError<MesEnvelope<unknown>>;
      const status = axiosErr.response?.status ?? (err instanceof ApiError ? err.status : 0);
      const message =
        axiosErr.response?.data?.message ?? (err instanceof ApiError ? err.message : (err as Error).message);

      if (status === 401) {
        if (!isLoginCall) {
          clearToken();
          onUnauthorized?.();
        }
        throw new ApiError(message ?? 'Unauthorized', 401);
      }

      if (status === RETRYABLE_STATUS && attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }

      if (status === 403) throw new ApiError(message ?? 'Access denied', 403);
      if (status === 422) throw new ApiError(message ?? 'Validation error', 422, axiosErr.response?.data);

      throw new ApiError(message ?? 'Request failed', status || 0);
    }
  }

  throw lastError;
}

export function apiGet<T>(url: string): Promise<T> {
  return request<T>({ method: 'GET', url });
}

export function apiPost<T>(url: string, body: unknown, isLoginCall = false): Promise<T> {
  return request<T>({ method: 'POST', url, data: body }, isLoginCall);
}
