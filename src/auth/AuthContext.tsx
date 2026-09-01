import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCurrentUser, login as apiLogin, logout as apiLogout } from '../api/endpoints';
import { setUnauthorizedHandler } from '../api/client';
import { clearToken, getToken, setToken } from './tokenStorage';
import type { CurrentUser } from '../types/api';

interface AuthContextValue {
  user: CurrentUser | null;
  status: 'checking' | 'authenticated' | 'unauthenticated';
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  const handleUnauthenticated = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Restore session on app load: if a token exists, validate it via /auth/me
  // before showing the dashboard. An invalid/expired token clears itself (401 -> handleUnauthenticated).
  useEffect(() => {
    setUnauthorizedHandler(handleUnauthenticated);

    const token = getToken();
    if (!token) {
      setStatus('unauthenticated');
      return;
    }

    getCurrentUser()
      .then((profile) => {
        setUser(profile);
        setStatus('authenticated');
      })
      .catch(() => {
        // client.ts already clears the token and fires handleUnauthenticated on 401
        setStatus('unauthenticated');
      });
  }, [handleUnauthenticated]);

  const login = useCallback(async (username: string, password: string) => {
    const { access_token } = await apiLogin(username, password);
    setToken(access_token);
    const profile = await getCurrentUser();
    setUser(profile);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      handleUnauthenticated();
    }
  }, [handleUnauthenticated]);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
