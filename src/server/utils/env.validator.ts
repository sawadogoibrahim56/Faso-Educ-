const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "FRONTEND_URL",
];

export function validateEnvironment() {
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Variable manquante: ${key}`);
    }
  }

  console.info("✅ Variables environnement validées");
}
