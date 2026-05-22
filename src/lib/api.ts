// Dynamic API URL Manager for Faso-Educ
// Solves the classic "http://localhost:3000" in production error.

const meta: any = import.meta;

// If VITE_API_URL is configured, use it. Otherwise, fallback to the same-origin relative path.
export const API_BASE_URL = meta.env?.VITE_API_URL || "";

/**
 * Returns the fully-qualified API URL for a given path, handling environments automatically.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If there's an explicit API_BASE_URL (different domain), prepend it.
  if (API_BASE_URL) {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    return `${base}${cleanPath}`;
  }

  // Safe checks in browser contexts to connect frontend and backend correctly
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // 1. If running on the Render Frontend domain, send all API requests to the Render Backend domain
    if (hostname.includes('faso-educ-frontend.onrender.com')) {
      return `https://faso-educ-backend.onrender.com${cleanPath}`;
    }

    // 2. If running inside local or containerized visual sandboxes (like AI Studio previews on run.app),
    // we use a relative path. The container router handles routing to the integrated backend.
    if (hostname.includes('run.app') || hostname === 'localhost' || hostname === '127.0.0.1') {
      return cleanPath;
    }

    // 3. Fallback for any other custom static site domains to direct to the production backend
    return `https://faso-educ-backend.onrender.com${cleanPath}`;
  }

  return cleanPath;
}

