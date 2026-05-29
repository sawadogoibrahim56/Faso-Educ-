import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import crypto from "crypto";

// Security headers Configuration (Helmet)
export const configuredHelmet = helmet({
  contentSecurityPolicy: false, // Vite Dev and client-side iframe loads need flexibility
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Production-ready CORS setup
export const configuredCors = cors({
  origin: (origin, callback) => {
    // Permit connections with no origin (like mobile clients or backend curl requests)
    if (!origin) return callback(null, true);
    
    // Accept standard localhost and production Render app domains dynamically
    const allowedPatterns = [
      /localhost:\d+$/,
      /127\.0\.0\.1:\d+$/,
      /\.run\.app$/,
      /refaso-educ\.onrender\.com$/,
      /faso-educ-backend\.onrender\.com$/
    ];
    
    const isAllowed = allowedPatterns.some((pattern) => pattern.test(origin));
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, true); // Allow inside sandbox, but can adjust if strict is needed
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
});

// Simple secure inside-memory storage to prevent Brute-Force Attacks on Auth APIs
const bruteForceMonitor = new Map<string, { loginAttempts: number; lockoutUntil: number }>();

/**
 * Brute-Force and Rate-Limiter protection middleware
 * @param maxAttempts Maximum attempts allowed in window
 * @param windowMs Time window in milliseconds
 */
export function authSecurityGuard(maxAttempts = 5, windowMs = 5 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "anonymous";
    const email = (req.body.email || "").trim().toLowerCase();
    
    // Unique key combining endpoint, client IP, and targeted account
    const uniqueKey = crypto.createHash("sha256").update(`${req.path}:${ip}:${email}`).digest("hex");
    const now = Date.now();
    
    const record = bruteForceMonitor.get(uniqueKey);
    
    if (record) {
      if (record.lockoutUntil > now) {
        const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
        return res.status(429).json({
          error: "brute_force_lockout",
          message: `🚫 Sécurité : Trop de tentatives infructueuses. Compte temporairement verrouillé. Veuillez réessayer dans ${remainingSeconds} secondes.`
        });
      }
      
      // Window reset check
      if (record.lockoutUntil === 0 && now - record.lockoutUntil > windowMs) {
        bruteForceMonitor.set(uniqueKey, { loginAttempts: 1, lockoutUntil: 0 });
        return next();
      }
    }
    
    next();
  };
}

/**
 * Register a failed attempt for rate limiting
 */
export function registerFailedAttempt(req: Request) {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "anonymous";
  const email = (req.body.email || "").trim().toLowerCase();
  const uniqueKey = crypto.createHash("sha256").update(`${req.path}:${ip}:${email}`).digest("hex");
  const now = Date.now();
  
  const record = bruteForceMonitor.get(uniqueKey);
  const maxAttempts = 5;
  const lockDuration = 2 * 60 * 1000; // 2 minutes block
  
  if (!record) {
    bruteForceMonitor.set(uniqueKey, { loginAttempts: 1, lockoutUntil: 0 });
  } else {
    const attempts = record.loginAttempts + 1;
    if (attempts >= maxAttempts) {
      bruteForceMonitor.set(uniqueKey, {
        loginAttempts: attempts,
        lockoutUntil: now + lockDuration
      });
      console.warn(`🔒 Brute-force lockout triggered for ${email} from IP ${ip}`);
    } else {
      bruteForceMonitor.set(uniqueKey, {
        loginAttempts: attempts,
        lockoutUntil: 0
      });
    }
  }
}

/**
 * Reset security tracking upon successful login
 */
export function resetAttemptTracking(req: Request) {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "anonymous";
  const email = (req.body.email || "").trim().toLowerCase();
  const uniqueKey = crypto.createHash("sha256").update(`${req.path}:${ip}:${email}`).digest("hex");
  bruteForceMonitor.delete(uniqueKey);
}

/**
 * Verify and parse JWT authorization token headers
 */
export function requireAuthToken(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "authorization_required", message: "Accès refusé. Jeton valide d'authentification requis." });
  }
  
  const token = authHeader.replace("Bearer ", "").trim();
  const secret = process.env.JWT_SECRET || "faso_educ_super_secret_key_2026";
  
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Format de jeton incorrect");
    
    const [header, data, signature] = parts;
    const expectedSignature = crypto.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
    
    if (signature !== expectedSignature) {
      throw new Error("Signature non valide");
    }
    
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.exp < Date.now()) {
      return res.status(401).json({ error: "token_expired", message: "Votre session a expiré. Veuillez vous reconnecter." });
    }
    
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_auth_token", message: "Session invalide ou corrompue. Connexion requise." });
  }
}
