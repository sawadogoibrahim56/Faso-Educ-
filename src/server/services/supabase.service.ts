import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseUrl = process.env.SUPABASE_URL || "";
let supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";

let supabaseAdmin: SupabaseClient | null = null;

try {
  if (supabaseUrl && supabaseSecretKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);
    console.info("⚡ Supabase Admin Service initialized successfully for security operations!");
  } else {
    console.warn("⚠️ Supabase Credentials missing. System will fallback gracefully without crash.");
  }
} catch (error) {
  console.error("❌ Failed to instantiate Supabase Admin client:", error);
}

export function getSupabaseAdmin(): SupabaseClient | null {
  return supabaseAdmin;
}

/**
 * Triggers native password recovery dispatch via Supabase Auth
 * using the configured SMTP (like Gmail App Password).
 * @param email Destination candidate address
 * @param origin Domain of web environment for redirection links
 */
export async function sendPasswordResetEmail(email: string, originUrl: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: "Database client is temporarily offline" };
  }
  
  try {
    const redirectUrl = `${originUrl}/#recovery`;
    
    // Official Supabase reset client-driven call which fires SMTP e-mails
    const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    if (error) {
      console.error(`❌ Supabase Auth resetPasswordForEmail rejected: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err: any) {
    console.error("❌ Exception during Supabase password recovery:", err);
    return { success: false, error: err.message || "Unknown auth failure" };
  }
}
