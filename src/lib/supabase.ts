import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-loaded Supabase client to prevent startup crashes when keys are missing
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  // Read Vite-prefixed configuration keys
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    console.info(
      "🔧 INFO: Supabase credentials (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) are missing. Operating in high-performance simulated Mode on LocalStorage."
    );
    return null;
  }

  try {
    supabaseInstance = createClient(url, key);
    console.info("⚡ Supabase Client initialized successfully for backend synchronization!");
    return supabaseInstance;
  } catch (error) {
    console.error("❌ Failed to initialize Supabase client:", error);
    return null;
  }
}
