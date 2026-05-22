import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-loaded Supabase client to prevent startup crashes when keys are missing
let supabaseInstance: SupabaseClient | null = null;

/**
 * Initializes the Supabase client with given credentials, usually retrieved dynamically or statically.
 */
export function initSupabaseClient(url: string, key: string): SupabaseClient | null {
  if (!url || !key) return null;
  try {
    supabaseInstance = createClient(url, key);
    console.info("⚡ Supabase Dynamic Client initialized successfully for production sync!");
    return supabaseInstance;
  } catch (error) {
    console.error("❌ Failed to initialize Supabase client:", error);
    return null;
  }
}

/**
 * Gets the current Supabase Client. Falls back to static environment if not initialized dynamically.
 */
export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  // Read statically declared Vite-prefixed environment keys
  const meta: any = import.meta;
  const url = (meta.env?.VITE_SUPABASE_URL) || '';
  const key = (meta.env?.VITE_SUPABASE_ANON_KEY) || '';

  if (url && key) {
    return initSupabaseClient(url, key);
  }

  return null;
}
