import { apiGet, apiPost } from './client';
import type {
  AssetNode,
  CurrentUser,
  CycleTimeBucket,
  CycleTimeRequest,
  LoginResponse,
  MachineIntervalsRequest,
  MachineIntervalsResponse,
  Shift,
} from '../types/api';

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/login', { username, password }, true);
}

export function logout(): Promise<null> {
  return apiPost<null>('/auth/logout', {});
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiGet<CurrentUser>('/auth/me');
}

export function getAssetTree(): Promise<AssetNode[]> {
  return apiGet<AssetNode[]>('/core/assets/tree');
}

export function getShifts(): Promise<Shift[]> {
  return apiGet<Shift[]>('/core/shifts');
}

export function getMachineIntervals(body: MachineIntervalsRequest): Promise<MachineIntervalsResponse> {
  return apiPost<MachineIntervalsResponse>('/analytics-query/machine-intervals', body);
}

export function getCycleTimeMetrics(body: CycleTimeRequest): Promise<CycleTimeBucket[]> {
  return apiPost<CycleTimeBucket[]>('/analytics-query', body);
}
