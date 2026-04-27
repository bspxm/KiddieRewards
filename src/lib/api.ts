export function getToken(): string | null {
  return localStorage.getItem('kiddie_token');
}

export function setToken(token: string): void {
  localStorage.setItem('kiddie_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('kiddie_token');
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers }).then(async (response) => {
    if (response.status === 401) {
      localStorage.removeItem('kiddie_token');
      localStorage.removeItem('kiddie_user');
      window.location.href = window.location.pathname;
    }
    return response;
  });
}
