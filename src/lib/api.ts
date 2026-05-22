// Dynamic API URL Manager for Faso-Educ
// Solves the classic "http://localhost:3000" in production error.

const meta: any = import.meta;

// Fallback to the production backend URL deployed on Render
export const API_BASE_URL = meta.env?.VITE_API_URL || "https://faso-educ-backend.onrender.com";

/**
 * Returns the fully-qualified API URL for a given path, handling environments automatically.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If we are in local development (localhost), we can use relative path or local port 3000
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    const devUrl = meta.env?.VITE_API_URL || "";
    if (devUrl) {
      return `${devUrl.endsWith('/') ? devUrl.slice(0, -1) : devUrl}${cleanPath}`;
    }
    return cleanPath;
  }

  // In production, we prepend the API_BASE_URL
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}${cleanPath}`;
}
