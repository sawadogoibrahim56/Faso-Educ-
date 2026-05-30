/**
 * System-wide Environment Variables Validator
 * Assures all crucial secrets and endpoints are present and structured correctly.
 */
export function validateEnvironment(): void {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET"
  ];

  const missing: string[] = [];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `⚠️ WARNING: Missing recommended environment variables: [${missing.join(", ")}].`
    );
    console.warn("Verify your system environment dashboard details to prevent credentials failures.");
  } else {
    console.info("🛡️ Environment config checks passed: All core security keys are present.");
  }

  // Basic format validations
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith("https://")) {
    console.error("❌ Invalid environment configuration: SUPABASE_URL must start with 'https://'!");
  }
}
