// Token storage — see NOTES.md for the localStorage-vs-alternatives trade-off discussion.
const TOKEN_KEY = 'timeline_dashboard_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
