import bcrypt from "bcryptjs";

/**
 * Hash a plain text password using bcryptjs.
 * @param password Plain text password
 * @returns Hashed password string
 */
export function hashPassword(password: string): string {
  if (!password) {
    throw new Error("Password to hash cannot be empty");
  }
  const salt = bcrypt.genSaltSync(12);
  return bcrypt.hashSync(password, salt);
}

/**
 * Check if a plain text password matches a hashed password.
 * @param password Plain text password
 * @param hash Encrypted bcrypt hash
 * @returns True if password matches, false otherwise
 */
export function comparePassword(password: string, hash: string): boolean {
  if (!password || !hash) return false;
  try {
    // Elegant check to support transition from legacy cleartext passwords (like default "123456")
    if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$") && !hash.startsWith("$2y$")) {
      return password === hash;
    }
    return bcrypt.compareSync(password, hash);
  } catch (error) {
    console.error("❌ Bcrypt compare exception:", error);
    return false;
  }
}
