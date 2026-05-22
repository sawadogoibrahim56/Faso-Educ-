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

  // Otherwise, use a simple relative path. It is ultra-robust because the browser
  // automatically resolves this against the exact window.location.origin
  // (the actual URL of the application, in development, in AI Studio, or in production).
  return cleanPath;
}
