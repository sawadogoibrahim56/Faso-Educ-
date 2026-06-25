var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express2 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_supabase_js2 = require("@supabase/supabase-js");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_crypto3 = __toESM(require("crypto"), 1);
var import_nodemailer = __toESM(require("nodemailer"), 1);
var import_fs = __toESM(require("fs"), 1);

// src/server/utils/env.validator.ts
function validateEnvironment() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET"
  ];
  const missing = [];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  if (missing.length > 0) {
    console.warn(
      `\u26A0\uFE0F WARNING: Missing recommended environment variables: [${missing.join(", ")}].`
    );
    console.warn("Verify your system environment dashboard details to prevent credentials failures.");
  } else {
    console.info("\u{1F6E1}\uFE0F Environment config checks passed: All core security keys are present.");
  }
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith("https://")) {
    console.error("\u274C Invalid environment configuration: SUPABASE_URL must start with 'https://'!");
  }
}

// src/server/utils/bcrypt.utils.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
function hashPassword(password) {
  if (!password) {
    throw new Error("Password to hash cannot be empty");
  }
  const salt = import_bcryptjs.default.genSaltSync(12);
  return import_bcryptjs.default.hashSync(password, salt);
}
function comparePassword(password, hash) {
  if (!password || !hash) return false;
  try {
    if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$") && !hash.startsWith("$2y$")) {
      return password === hash;
    }
    return import_bcryptjs.default.compareSync(password, hash);
  } catch (error) {
    console.error("\u274C Bcrypt compare exception:", error);
    return false;
  }
}

// src/server/middleware/security.middleware.ts
var import_helmet = __toESM(require("helmet"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var configuredHelmet = (0, import_helmet.default)({
  contentSecurityPolicy: false,
  // Vite Dev and client-side iframe loads need flexibility
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});
var configuredCors = (0, import_cors.default)({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
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
      callback(null, true);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
});
var bruteForceMonitor = /* @__PURE__ */ new Map();
function authSecurityGuard(maxAttempts = 5, windowMs = 5 * 60 * 1e3) {
  return (req, res, next) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous";
    const email = (req.body.email || "").trim().toLowerCase();
    const uniqueKey = import_crypto.default.createHash("sha256").update(`${req.path}:${ip}:${email}`).digest("hex");
    const now = Date.now();
    const record = bruteForceMonitor.get(uniqueKey);
    if (record) {
      if (record.lockoutUntil > now) {
        const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1e3);
        return res.status(429).json({
          error: "brute_force_lockout",
          message: `\u{1F6AB} S\xE9curit\xE9 : Trop de tentatives infructueuses. Compte temporairement verrouill\xE9. Veuillez r\xE9essayer dans ${remainingSeconds} secondes.`
        });
      }
      if (record.lockoutUntil === 0 && now - record.lockoutUntil > windowMs) {
        bruteForceMonitor.set(uniqueKey, { loginAttempts: 1, lockoutUntil: 0 });
        return next();
      }
    }
    next();
  };
}
function registerFailedAttempt(req) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous";
  const email = (req.body.email || "").trim().toLowerCase();
  const uniqueKey = import_crypto.default.createHash("sha256").update(`${req.path}:${ip}:${email}`).digest("hex");
  const now = Date.now();
  const record = bruteForceMonitor.get(uniqueKey);
  const maxAttempts = 5;
  const lockDuration = 2 * 60 * 1e3;
  if (!record) {
    bruteForceMonitor.set(uniqueKey, { loginAttempts: 1, lockoutUntil: 0 });
  } else {
    const attempts = record.loginAttempts + 1;
    if (attempts >= maxAttempts) {
      bruteForceMonitor.set(uniqueKey, {
        loginAttempts: attempts,
        lockoutUntil: now + lockDuration
      });
      console.warn(`\u{1F512} Brute-force lockout triggered for ${email} from IP ${ip}`);
    } else {
      bruteForceMonitor.set(uniqueKey, {
        loginAttempts: attempts,
        lockoutUntil: 0
      });
    }
  }
}
function resetAttemptTracking(req) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous";
  const email = (req.body.email || "").trim().toLowerCase();
  const uniqueKey = import_crypto.default.createHash("sha256").update(`${req.path}:${ip}:${email}`).digest("hex");
  bruteForceMonitor.delete(uniqueKey);
}

// src/server/routes/auth.routes.ts
var import_express = require("express");
var import_crypto2 = __toESM(require("crypto"), 1);

// src/server/services/supabase.service.ts
var import_supabase_js = require("@supabase/supabase-js");
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";
var supabaseAdmin = null;
try {
  if (supabaseUrl && supabaseSecretKey) {
    supabaseAdmin = (0, import_supabase_js.createClient)(supabaseUrl, supabaseSecretKey);
    console.info("\u26A1 Supabase Admin Service initialized successfully for security operations!");
  } else {
    console.warn("\u26A0\uFE0F Supabase Credentials missing. System will fallback gracefully without crash.");
  }
} catch (error) {
  console.error("\u274C Failed to instantiate Supabase Admin client:", error);
}
function getSupabaseAdmin() {
  return supabaseAdmin;
}
async function sendPasswordResetEmail(email, originUrl) {
  if (!supabaseAdmin) {
    return { success: false, error: "Database client is temporarily offline" };
  }
  try {
    const redirectUrl = `${originUrl}/#recovery`;
    const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    if (error) {
      console.error(`\u274C Supabase Auth resetPasswordForEmail rejected: ${error.message}`);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("\u274C Exception during Supabase password recovery:", err);
    return { success: false, error: err.message || "Unknown auth failure" };
  }
}

// src/server/routes/auth.routes.ts
var router = (0, import_express.Router)();
function generateUserToken(payload) {
  const secret = process.env.JWT_SECRET || "faso_educ_super_secret_key_2026";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1e3
      // 30 Days expiration
    })
  ).toString("base64url");
  const signature = import_crypto2.default.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${signature}`;
}
router.post("/register", async (req, res) => {
  const { email, password, name, phone, level } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail et mot de passe requis." });
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();
  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: "Le mot de passe doit comporter au moins 6 caract\xE8res." });
  }
  const supabaseAdmin3 = getSupabaseAdmin();
  const hashedPassword = hashPassword(cleanPassword);
  const newProfile = {
    email: cleanEmail,
    name: name ? name.trim() : cleanEmail.split("@")[0],
    phone: phone ? phone.trim() : "",
    level: level || "Licence",
    password: hashedPassword,
    // SECURE HASHED STORAGE
    is_premium: false,
    avatar: "\u{1F468}\u200D\u{1F393}",
    points: 100,
    learning_streak: 1,
    registered: true,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (supabaseAdmin3) {
    try {
      const { data: existing } = await supabaseAdmin3.from("profiles").select("email").eq("email", cleanEmail).maybeSingle();
      if (existing) {
        return res.status(400).json({ error: "Cet e-mail est d\xE9j\xE0 associ\xE9 \xE0 un autre compte." });
      }
      const dbProfile = { ...newProfile };
      const { error } = await supabaseAdmin3.from("profiles").upsert(dbProfile, { onConflict: "email" });
      if (error) throw error;
    } catch (err) {
      console.error("\u274C Registration database failure:", err.message);
      return res.status(500).json({ error: "Erreur technique de la base de donn\xE9es lors de l'inscription." });
    }
  }
  const token = generateUserToken({ email: cleanEmail });
  const safeProfile = {
    ...newProfile,
    registrationDate: newProfile.created_at
  };
  delete safeProfile.password;
  delete safeProfile.created_at;
  return res.json({
    success: true,
    message: "Inscription r\xE9ussie sur Faso Educ !",
    profile: safeProfile,
    token
  });
});
router.post("/login", authSecurityGuard(), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Veuillez fournir un e-mail et un mot de passe." });
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();
  const supabaseAdmin3 = getSupabaseAdmin();
  let dbUser = null;
  if (supabaseAdmin3) {
    try {
      const { data, error } = await supabaseAdmin3.from("profiles").select("*").eq("email", cleanEmail).maybeSingle();
      if (error) throw error;
      dbUser = data;
    } catch (err) {
      console.error("\u274C Login search query failed:", err.message);
    }
  }
  if (!dbUser) {
    registerFailedAttempt(req);
    return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
  }
  if (dbUser.is_banned) {
    return res.status(403).json({ error: "banned", message: "\u{1F512} S\xE9curit\xE9 : Ce compte Faso Educ est suspendu." });
  }
  const passwordMatch = comparePassword(cleanPassword, dbUser.password);
  if (!passwordMatch) {
    registerFailedAttempt(req);
    return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
  }
  resetAttemptTracking(req);
  const token = generateUserToken({ email: cleanEmail });
  const adminEmail = (process.env.ADMIN_EMAIL || "ibrahimsawadogo36@gmail.com").trim().toLowerCase();
  const isAdmin = cleanEmail === adminEmail || cleanEmail === "ibrahimsawadogo36@gmail.com";
  const safeProfile = {
    email: dbUser.email,
    name: dbUser.name,
    firstName: dbUser.first_name || "",
    lastName: dbUser.last_name || "",
    phone: dbUser.phone || "",
    level: dbUser.level || "Licence",
    isPremium: isAdmin ? true : !!dbUser.is_premium,
    avatar: dbUser.avatar || "\u{1F468}\u200D\u{1F393}",
    points: dbUser.points || 100,
    learningStreak: dbUser.learning_streak || 1,
    targetExam: dbUser.target_exam || "Concours Direct",
    regionName: dbUser.region_name || "Centre (Ouagadougou)",
    registered: true,
    boundDeviceId: dbUser.bound_device_id || null,
    transferRequested: !!dbUser.transfer_requested,
    registrationDate: dbUser.registration_date || dbUser.created_at || null
  };
  return res.json({
    success: true,
    message: "Connexion r\xE9ussie",
    token,
    profile: safeProfile
  });
});
router.post("/forgot-password", authSecurityGuard(), async (req, res) => {
  const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    return res.status(400).json({ error: "Veuillez fournir une adresse e-mail valide." });
  }
  const supabaseAdmin3 = getSupabaseAdmin();
  if (!supabaseAdmin3) {
    return res.status(503).json({ error: "Service temporairement indisponible." });
  }
  try {
    const { data: dbCheck, error: checkError } = await supabaseAdmin3.from("profiles").select("email, is_banned").eq("email", email).maybeSingle();
    if (checkError) throw checkError;
    if (!dbCheck) {
      return res.status(404).json({ error: "Aucun compte n'existe avec cette adresse e-mail. Veuillez vous inscrire." });
    }
    if (dbCheck.is_banned) {
      return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration" });
    }
    const originUrl = req.headers.origin || process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
    const { success, error } = await sendPasswordResetEmail(email, originUrl);
    if (success) {
      return res.json({
        success: true,
        message: "\u{1F4E8} Un e-mail de r\xE9initialisation contenant un lien s\xE9curis\xE9 a \xE9t\xE9 exp\xE9di\xE9 par Supabase. Veuillez consulter votre messagerie et cliquer sur le lien pour modifier votre mot de passe."
      });
    } else {
      return res.status(500).json({
        error: `\xC9chec de l'exp\xE9dition d'e-mail: ${error || "Erreur inconnue."}`
      });
    }
  } catch (err) {
    console.error("\u274C Forgot password endpoint exception:", err);
    return res.status(500).json({ error: "Une exception interne s'est produite lors de l'initiation de la r\xE9cup\xE9ration." });
  }
});
router.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: "E-mail et nouveau mot de passe sont obligatoires." });
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = newPassword.trim();
  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: "Votre nouveau mot de passe doit comporter au moins 6 caract\xE8res." });
  }
  const supabaseAdmin3 = getSupabaseAdmin();
  if (!supabaseAdmin3) {
    return res.status(503).json({ error: "Service de base de donn\xE9es hors ligne." });
  }
  try {
    const hashedPassword = hashPassword(cleanPassword);
    const { error } = await supabaseAdmin3.from("profiles").update({ password: hashedPassword }).eq("email", cleanEmail);
    if (error) throw error;
    return res.json({
      success: true,
      message: "F\xE9licitations ! Votre mot de passe a \xE9t\xE9 r\xE9initialis\xE9 et s\xE9curis\xE9 avec succ\xE8s. Vous pouvez maintenant vous connecter."
    });
  } catch (err) {
    console.error("\u274C Reset password database exception:", err);
    return res.status(500).json({ error: "Impossible de mettre \xE0 jour votre mot de passe pour le moment." });
  }
});
router.post("/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ error: "E-mail, mot de passe actuel et nouveau mot de passe requis." });
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanCurrent = currentPassword.trim();
  const cleanNew = newPassword.trim();
  if (cleanNew.length < 6) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 6 caract\xE8res." });
  }
  const supabaseAdmin3 = getSupabaseAdmin();
  if (!supabaseAdmin3) {
    return res.status(503).json({ error: "Service de base de donn\xE9es hors ligne." });
  }
  try {
    const { data: dbUser, error: fetchError } = await supabaseAdmin3.from("profiles").select("password").eq("email", cleanEmail).maybeSingle();
    if (fetchError) throw fetchError;
    if (!dbUser) {
      return res.status(404).json({ error: "Utilisateur non trouv\xE9." });
    }
    const passwordMatch = comparePassword(cleanCurrent, dbUser.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "L'ancien mot de passe saisi est incorrect." });
    }
    const hashedNewPassword = hashPassword(cleanNew);
    const { error: updateError } = await supabaseAdmin3.from("profiles").update({ password: hashedNewPassword }).eq("email", cleanEmail);
    if (updateError) throw updateError;
    return res.json({
      success: true,
      message: "Mot de passe mis \xE0 jour avec succ\xE8s !"
    });
  } catch (err) {
    console.error("\u274C Change password API exception:", err);
    return res.status(500).json({ error: "Impossible de modifier le mot de passe pour le moment." });
  }
});
var auth_routes_default = router;

// server.ts
import_dotenv.default.config();
validateEnvironment();
var app = (0, import_express2.default)();
var PORT = 3e3;
app.use(configuredHelmet);
app.use(configuredCors);
app.use(import_express2.default.json({ limit: "50mb" }));
app.use(import_express2.default.urlencoded({ limit: "50mb", extended: true }));
var supabaseUrl2 = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
var supabaseSecretKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
var supabaseAdmin2 = null;
if (supabaseUrl2 && supabaseSecretKey2) {
  try {
    supabaseAdmin2 = (0, import_supabase_js2.createClient)(supabaseUrl2, supabaseSecretKey2);
    if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY) {
      console.info("\u26A1 Supabase Admin integrated successfully with Service Role Key (RLS bypassed)!");
    } else {
      console.info("\u26A1 Supabase Admin integrated successfully (using Anonymous key fallback)!");
    }
  } catch (error) {
    console.error("\u274C Failed to initialize Supabase on backend:", error);
  }
}
var serverManualPayments = [];
var serverBannedEmails = ["fraud_spammer@test.bf"];
var serverProfiles = {};
var isProModelAvailable = true;
var serverCourses = [];
var serverQuizResults = [];
var serverDailyLimits = {};
var LOCAL_DB_PATH = import_path.default.join(process.cwd(), "local_db.json");
function loadLocalDB() {
  try {
    if (import_fs.default.existsSync(LOCAL_DB_PATH)) {
      const data = import_fs.default.readFileSync(LOCAL_DB_PATH, "utf8");
      const db = JSON.parse(data);
      if (db.profiles) serverProfiles = db.profiles;
      if (db.payments) serverManualPayments = db.payments;
      if (db.banned) serverBannedEmails = db.banned;
      if (db.courses) serverCourses = db.courses;
      if (db.results) serverQuizResults = db.results;
      if (db.dailyLimits) serverDailyLimits = db.dailyLimits;
      console.info("\u{1F4BE} [Local DB] Loaded successfully with", Object.keys(serverProfiles).length, "profiles!");
    } else {
      saveLocalDB();
    }
  } catch (err) {
    console.error("\u26A0\uFE0F Failed to load local database:", err.message);
  }
}
function saveLocalDB() {
  try {
    const db = {
      profiles: serverProfiles,
      payments: serverManualPayments,
      banned: serverBannedEmails,
      courses: serverCourses,
      results: serverQuizResults,
      dailyLimits: serverDailyLimits
    };
    import_fs.default.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("\u26A0\uFE0F Failed to save local database:", err.message);
  }
}
async function checkFreeTrialAndLimits(email, actionType, size = 1) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || "ibrahimsawadogo36@gmail.com").trim().toLowerCase();
  if (cleanEmail === adminEmail || cleanEmail === "ibrahimsawadogo36@gmail.com") {
    return { allowed: true, isPremium: true };
  }
  if (!cleanEmail) {
    return { allowed: true, isPremium: false };
  }
  if (serverBannedEmails.includes(cleanEmail)) {
    return {
      allowed: false,
      reason: "banned",
      message: "\u{1F512} Ce compte Faso Educ est suspendu par l'administration."
    };
  }
  if (supabaseAdmin2) {
    try {
      const { data: dbCheck } = await supabaseAdmin2.from("profiles").select("is_banned").eq("email", cleanEmail).maybeSingle();
      if (dbCheck && dbCheck.is_banned) {
        if (!serverBannedEmails.includes(cleanEmail)) {
          serverBannedEmails.push(cleanEmail);
        }
        return {
          allowed: false,
          reason: "banned",
          message: "\u{1F512} Ce compte Faso Educ est suspendu par l'administration."
        };
      }
    } catch (err) {
      console.warn("Failed live ban check fallback in checkFreeTrialAndLimits:", err.message);
    }
  }
  let prof = serverProfiles[cleanEmail];
  if (supabaseAdmin2) {
    try {
      const { data } = await supabaseAdmin2.from("profiles").select("is_premium, created_at, is_banned").eq("email", cleanEmail).maybeSingle();
      if (data) {
        if (data.is_banned) {
          if (!serverBannedEmails.includes(cleanEmail)) {
            serverBannedEmails.push(cleanEmail);
          }
          return {
            allowed: false,
            reason: "banned",
            message: "\u{1F512} Ce compte Faso Educ est suspendu par l'administration."
          };
        }
        if (!prof) {
          prof = {
            isPremium: !!data.is_premium,
            registration_date: data.created_at || (/* @__PURE__ */ new Date()).toISOString()
          };
          serverProfiles[cleanEmail] = prof;
        } else {
          prof.isPremium = !!data.is_premium;
          if (data.created_at) {
            prof.registration_date = data.created_at;
          }
        }
      }
    } catch (e) {
      console.error("Database status check error:", e);
    }
  }
  if (!prof) {
    prof = {
      isPremium: false,
      registration_date: (/* @__PURE__ */ new Date()).toISOString()
    };
    serverProfiles[cleanEmail] = prof;
  }
  const isPrem = !!prof.isPremium || !!prof.is_premium;
  if (!prof.registration_date) {
    prof.registration_date = prof.created_at || (/* @__PURE__ */ new Date()).toISOString();
  }
  const regDate = new Date(prof.registration_date);
  const now = /* @__PURE__ */ new Date();
  const diffTime = now.getTime() - regDate.getTime();
  const diffDays = diffTime / (1e3 * 60 * 60 * 24);
  if (diffDays > 7 && !isPrem) {
    return {
      allowed: false,
      reason: "trial_expired",
      message: "\u{1F512} P\xE9riode d'essai expir\xE9e : Votre p\xE9riode d'essai gratuite de 7 jours est termin\xE9e. Votre compte est suspendu de toutes les fonctionnalit\xE9s (Cours, QCM, Ar\xE8ne, Publications, Forum). Pour d\xE9bloquer l'acc\xE8s complet de fa\xE7on illimit\xE9e, veuillez activer votre abonnement Elite Premium."
    };
  }
  if (isPrem) {
    return { allowed: true, isPremium: true };
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (!serverDailyLimits[cleanEmail] || serverDailyLimits[cleanEmail].date !== today) {
    serverDailyLimits[cleanEmail] = {
      date: today,
      quizCount: 0,
      questionsCount: 0,
      courseCount: 0
    };
  }
  const userLimit = serverDailyLimits[cleanEmail];
  if (actionType === "quiz") {
    if (userLimit.quizCount >= 1 || userLimit.questionsCount >= 10) {
      return {
        allowed: false,
        reason: "limit_exceeded",
        message: "\u26A0\uFE0F Limite d'essai d\xE9pass\xE9e : En version d'essai gratuite de 7 jours, vous \xEAtes limit\xE9 \xE0 la g\xE9n\xE9ration d'un unique QCM de 10 questions maximum par jour. Veuillez r\xE9essayer demain ou activer votre abonnement Elite Premium pour g\xE9n\xE9rer des QCM en illimit\xE9 !"
      };
    }
    if (size > 10) {
      return {
        allowed: false,
        reason: "size_exceeded",
        message: "\u26A0\uFE0F Taille de QCM non autoris\xE9e en mode gratuit : Votre QCM d'essai ne peut pas comporter plus de 10 questions. Veuillez s\xE9lectionner un maximum de 10 questions ou souscrire \xE0 l'abonnement Premium."
      };
    }
    if (userLimit.questionsCount + size > 10) {
      return {
        allowed: false,
        reason: "limit_exceeded",
        message: `\u26A0\uFE0F Limite d'essai d\xE9pass\xE9e : Vous avez d\xE9j\xE0 g\xE9n\xE9r\xE9 ${userLimit.questionsCount} questions aujourd'hui. Vous ne pouvez pas d\xE9passer un cumul de 10 questions par jour en mode gratuit.`
      };
    }
  } else if (actionType === "course") {
    if (userLimit.courseCount >= 1) {
      return {
        allowed: false,
        reason: "limit_exceeded",
        message: "\u26A0\uFE0F Limite d'essai d\xE9pass\xE9e : Vous avez d\xE9j\xE0 g\xE9n\xE9r\xE9 un cours aujourd'hui en version gratuite. Passez \xE0 l'abonnement Premium pour d\xE9bloquer la g\xE9n\xE9ration illimit\xE9e de tous les cours et chapitres de l'Acad\xE9mie !"
      };
    }
  }
  return { allowed: true, isPremium: false, limitRecord: userLimit };
}
loadLocalDB();
function generateToken(payload) {
  const secret = process.env.JWT_SECRET || "faso_educ_super_secret_key_2026";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1e3 })).toString("base64url");
  const signature = import_crypto3.default.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${signature}`;
}
function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;
    const secret = process.env.JWT_SECRET || "faso_educ_super_secret_key_2026";
    const expectedSignature = import_crypto3.default.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
function isAdminRequest(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.replace("Bearer ", "").trim();
    const payload = verifyToken(token);
    return payload && payload.role === "admin";
  } catch {
    return false;
  }
}
function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  return import_nodemailer.default.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    },
    // Force IPv4 address resolution to prevent Cloud Run sandboxes without IPv6 routing from failing with ENETUNREACH
    family: 4,
    connectionTimeout: 1e4,
    // 10s connection timeout
    socketTimeout: 1e4
    // 10s socket timeout
  });
}
async function sendAdminPaymentMail(tx) {
  const adminEmail = process.env.ADMIN_EMAIL || "ibrahimsawadogo36@gmail.com";
  const transporter = getMailTransporter();
  const mailSubject = `\u{1F514} [Paiement Manuel] D\xE9claration de d\xE9p\xF4t de ${tx.userName} \xE0 valider`;
  const mailText = `Bonjour Ibrahim,

Un candidat vient de soumettre une preuve de transfert d'argent mobile pour valider son forfait d'acc\xE8s sur Faso Educ.

D\xE9tails de la transaction :
----------------------------------------
\u{1F9D1}\u200D\u{1F4BB} Candidat : ${tx.userName} (${tx.userEmail})
\u{1F4F1} Op\xE9rateur : ${tx.operator.toUpperCase()} Money
\u{1F4DE} T\xE9l\xE9phone : ${tx.phone}
\u{1F4B0} Montant : ${tx.amount} FCFA
\u{1F511} R\xE9f\xE9rence unique : ${tx.reference}
\u{1F4C5} Date : ${new Date(tx.date).toLocaleString("fr-FR")}
----------------------------------------

Lien d'administration pour valider : ${process.env.APP_URL || "https://faso-educ.onrender.com"} (Ouvrez le menu Admin "\u{1F511} Administration R\xE9seau")

Cordialement,
Le Syst\xE8me d'Automatisation de Faso-Educ Net`;
  const mailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e1e8ed; border-radius: 12px; background-color: #f8fafc;">
      <h2 style="color: #4f46e5; margin-bottom: 20px;">\u{1F514} [Faso Educ] Nouveau paiement manuel soumis</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        Bonjour Ibrahim Sawadogo,
        <br/><br/>
        Un candidat vient de d\xE9clarer un d\xE9p\xF4t mobile money. Veuillez comparer ces donn\xE9es avec votre compte pour valider son acc\xE8s.
      </p>
      
      <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 15px; border-b: 1px solid #f1f5f9; padding-bottom: 8px;">\u{1F4CB} D\xE9tails de la transaction</h3>
        <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; width: 35%;">\u{1F9D1}\u200D\u{1F4BB} Candidat :</td>
            <td style="padding: 6px 0;">${tx.userName} (${tx.userEmail})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">\u{1F4F1} Op\xE9rateur :</td>
            <td style="padding: 6px 0;"><span style="text-transform: uppercase; font-weight: bold; color: #ea580c;">${tx.operator}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">\u{1F4DE} T\xE9l\xE9phone :</td>
            <td style="padding: 6px 0;"><code>${tx.phone}</code></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">\u{1F4B0} Montant :</td>
            <td style="padding: 6px 0; font-weight: bold; color: #b45309;">${tx.amount} FCFA</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">\u{1F511} R\xE9f\xE9rence unique :</td>
            <td style="padding: 6px 0;"><code style="background-color: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-weight: bold; color: #0f172a;">${tx.reference}</code></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">\u{1F4C5} Date :</td>
            <td style="padding: 6px 0;">${new Date(tx.date).toLocaleString("fr-FR")}</td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 25px;">
        <a href="${process.env.APP_URL || "https://faso-educ.onrender.com"}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
          Acc\xE9der au Portail de Validation
        </a>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">
        Faso-Educ Security & Payment Automation Service \u2022 Burkinab\xE8 EdTech Initiative
      </p>
    </div>
  `;
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Notification Faso Educ" <${process.env.SMTP_USER || "no-reply@faso-educ.net"}>`,
        to: adminEmail,
        subject: mailSubject,
        text: mailText,
        html: mailHtml
      });
      console.info(`\u{1F4E7} Real Email notification sent to admin: ${adminEmail}`);
    } catch (err) {
      console.error("\u274C Failed to send physical email via configured Nodemailer transport:", err);
    }
  } else {
    console.warn("\u26A0\uFE0F SMTP Credentials missing or incomplete on Render. Console log simulated email delivery:", {
      to: adminEmail,
      subject: mailSubject,
      txRef: tx.reference
    });
  }
}
var ai = new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var FALLBACK_QUIZ_DATABASE = [
  // MICROECONOMIE
  {
    text: "Soit un consommateur ayant pour fonction de pr\xE9f\xE9rence Cobb-Douglas $U(x, y) = x^{0.5} y^{0.5}$ face aux prix $P_x$ et $P_y$. L'\xE9lasticit\xE9-revenu de la demande pour le bien $x$ est \xE9gale \xE0 :",
    options: ["$-1.0$", "$0.0$", "$1.0$", "$0.5$"],
    correctAnswer: 2,
    explanation: "Pour une fonction d'utilit\xE9 Cobb-Douglas homog\xE8ne, la part du budget allou\xE9e \xE0 chaque bien est constante et \xE9gale \xE0 la puissance du bien sur la somme des puissances. Par cons\xE9quent, la demande s'\xE9crit $x(R) = a \\cdot \\frac{R}{P_x}$, ce qui conduit \xE0 une \xE9lasticit\xE9-revenu unitaire $\\epsilon_R = 1$.",
    dimension: "Intellectuelle",
    tags: ["microeconomie", "economie", "cobb-douglas", "cours"]
  },
  {
    text: "Dans la th\xE9orie de la production \xE0 court terme, la loi des rendements d\xE9croissants \xE9nonce que si l'on accro\xEEt r\xE9guli\xE8rement l'utilisation d'un facteur variable (comme le travail $L$) avec un facteur fixe (le capital $K$) :",
    options: [
      "La production totale diminue de fa\xE7on absolue d\xE8s le premier travailleur suppl\xE9mentaire",
      "La productivit\xE9 marginale globale $P_m = \\frac{\\partial Y}{\\partial L}$ du facteur variable finit par d\xE9cro\xEEtre",
      "Le co\xFBt total moyen $CTM$ devient nul",
      "La productivit\xE9 moyenne globale augmente de fa\xE7on strictement exponentielle"
    ],
    correctAnswer: 1,
    explanation: "La loi des rendements non proportionnels (ou d\xE9croissants) stipule qu'au-del\xE0 d'un certain point, l'ajout progressif d'unit\xE9s d'un facteur variable sur un facteur fixe produit des augmentations de production de plus en plus faibles, donc une baisse de la productivit\xE9 marginale.",
    dimension: "Intellectuelle",
    tags: ["microeconomie", "economie", "production"]
  },
  {
    text: "Soit la fonction de co\xFBt total d'une entreprise concurrentielle en \xE9quilibre de court terme : $CT(q) = 2q^2 + 8q + 18$. Quel est le seuil de fermeture th\xE9orique de cette entreprise s'il n'y a pas de co\xFBts fixes irr\xE9cup\xE9rables ?",
    options: ["$P = 18$", "$P = 8$", "$P = 2$", "$P = 12$"],
    correctAnswer: 1,
    explanation: "Le seuil de fermeture correspond au minimum du co\xFBt variable moyen ($CVM$). Ici, le co\xFBt variable est $CV(q) = 2q^2 + 8q$. Donc $CVM(q) = 2q + 8$, dont le minimum est obtenu pour $q \\to 0$, ce qui donne $CVM_{min} = 8$. L'entreprise ferme si le prix de march\xE9 est strictement inf\xE9rieur \xE0 8.",
    dimension: "Intellectuelle",
    tags: ["microeconomie", "economie", "cout"]
  },
  {
    text: "En situation de monopole pur, la condition d'optimisation du profit \xE0 long terme s'\xE9crit de la fa\xE7on suivante :",
    options: [
      "Le co\xFBt marginal est \xE9gal \xE0 la recette marginale ($Cm = Rm$)",
      "Le prix est strictement \xE9gal au co\xFBt marginal moyen ($P = CM$)",
      "La recette totale est maximis\xE9e au point o\xF9 l'\xE9lasticit\xE9 est nulle",
      "Le co\xFBt moyen est sup\xE9rieur \xE0 la recette moyenne"
    ],
    correctAnswer: 0,
    explanation: "Pour tout producteur (qu'il soit en concurrence ou en monopole), le profit est maximum lorsque la derni\xE8re unit\xE9 produite rapporte exactement ce qu'elle co\xFBte \xE0 produire, soit $Cm = Rm$. Le monopoleur applique ensuite un prix sur la courbe de demande sup\xE9rieur au co\xFBt marginal.",
    dimension: "Intellectuelle",
    tags: ["microeconomie", "economie", "monopole", "march\xE9"]
  },
  // MACROECONOMIE
  {
    text: "Dans le mod\xE8le IS-LM en \xE9conomie ferm\xE9e avec rigidit\xE9 des prix, une hausse des d\xE9penses publiques financ\xE9e par emprunt provoqu\xE9e sans cr\xE9ation de monnaie entra\xEEne :",
    options: [
      "Une baisse imm\xE9diate du PIB r\xE9el et un recul du taux d'int\xE9r\xEAt",
      "Un effet d'\xE9viction par une hausse du taux d'int\xE9r\xEAt, limitant la hausse finale du revenu",
      "Une d\xE9pr\xE9ciation imm\xE9diate du taux de change fixe",
      "Une d\xE9flation par exc\xE8s d'offre mon\xE9taire liquide"
    ],
    correctAnswer: 1,
    explanation: "L'augmentation des d\xE9penses publiques d\xE9place la courbe IS vers la droite. Cela accro\xEEt la demande globale et le revenu, ce qui augmente la demande de monnaie pour des raisons de transaction. Le taux d'int\xE9r\xEAt s'ajuste \xE0 la hausse sur le march\xE9 mon\xE9taire (courbe LM stable), ce qui r\xE9duit l'investissement priv\xE9 (effet d'\xE9viction).",
    dimension: "Intellectuelle",
    tags: ["macroeconomie", "economie", "is-lm", "cours"]
  },
  {
    text: "Selon la r\xE8gle d'or d'accumulation du capital dans le mod\xE8le de croissance de Robert Solow, la consommation par t\xEAte est maximale \xE0 l'\xE9tat r\xE9gulier lorsque la productivit\xE9 marginale du capital (nette de d\xE9pr\xE9ciation $\\delta$) est \xE9gale \xE0 :",
    options: [
      "Le double du taux de profit de court terme",
      "Le taux de croissance de la population active $n$, soit $PMK - \\delta = n$",
      "Le taux d'imposition marginal des hauts revenus",
      "Z\xE9ro, soit une saturation totale de l'investissement"
    ],
    correctAnswer: 1,
    explanation: "La r\xE8gle d'or \xE9nonce que pour maximiser la consommation par t\xEAte \xE0 l'\xE9tat r\xE9gulier, le taux d'\xE9pargne doit \xEAtre ajust\xE9 pour que la productivit\xE9 marginale nette du capital \xE9gale le taux de croissance d\xE9mographique, soit $d f(k^*)/dk = n + \\delta$.",
    dimension: "Intellectuelle",
    tags: ["macroeconomie", "economie", "solow", "croissance"]
  },
  {
    text: "La relation inverse \xE0 court terme entre le taux de ch\xF4mage et le taux de variation des salaires nominaux (ou de l'inflation) est mod\xE9lis\xE9e par :",
    options: [
      "La loi d'Okun",
      "La courbe de Phillips",
      "La th\xE9orie de la pr\xE9f\xE9rence pour la liquidit\xE9",
      "Le th\xE9or\xE8me d'\xE9quivalence de Ricardo-Barro"
    ],
    correctAnswer: 1,
    explanation: "La courbe de Phillips met en \xE9vidence une relation d'arbitrage \xE0 court terme entre inflation et ch\xF4mage : lorsque le ch\xF4mage est bas, la tension sur le march\xE9 de l'emploi entra\xEEne une hausse des salaires et donc de l'inflation.",
    dimension: "Intellectuelle",
    tags: ["macroeconomie", "economie", "inflation", "chomage"]
  },
  // STATISTIQUES & PROBABILITES
  {
    text: "Soit $X$ une variable al\xE9atoire suivant une loi normale d'esp\xE9rance $\\mu = 50$ et de variance $\\sigma^2 = 16$. Quelle est la probabilit\xE9 approximative que $X$ appartienne \xE0 l'intervalle de fluctuation $[42, 58]$ ?",
    options: ["$50\\%$", "$68\\%$", "$95\\%$", "$99.7\\%$"],
    correctAnswer: 2,
    explanation: "L'intervalle de confiance et de fluctuation \xE0 deux \xE9carts-types d'une loi normale couvre approximativement $95.4\\%$ de la distribution. Ici, l'\xE9cart-type est $\\sigma = \\sqrt{16} = 4$. L'intervalle propos\xE9 correspond \xE0 $[\\mu - 2\\sigma, \\mu + 2\\sigma] = [50 - 8, 50 + 8] = [42, 58]$, donc environ $95\\%$ de probabilit\xE9.",
    dimension: "Intellectuelle",
    tags: ["statistiques", "mathematiques", "probabilites", "cours"]
  },
  {
    text: "Le th\xE9or\xE8me central limite (TCL) postule que la somme (ou la moyenne empirique) de $n$ variables al\xE9atoires ind\xE9pendantes et identiquement distribu\xE9es, de moyenne $\\mu$ et de variance $\\sigma^2$ finie, converge en loi vers :",
    options: [
      "Une loi de Poisson binomiale de param\xE8tre $\\lambda = \\frac{\\mu}{n}$",
      "Une loi normale de moyenne $\\mu$ et d'\xE9cart-type $\\frac{\\sigma}{\\sqrt{n}}$",
      "Une loi uniforme continue sur l'intervalle $[0, 1]$",
      "Une loi de Student \xE0 $n-2$ degr\xE9s de libert\xE9"
    ],
    correctAnswer: 1,
    explanation: "Selon le TCL, peu importe la distribution d'origine des variables, d\xE8s lors que la taille de l'\xE9chantillon $n$ est suffisamment grande (g\xE9n\xE9ralement $n \\geq 30$), la moyenne de l'\xE9chantillon tend vers une distribution normale d'esp\xE9rance $\\mu$ et d'\xE9cart-type $\\frac{\\sigma}{\\sqrt{n}}$.",
    dimension: "Intellectuelle",
    tags: ["statistiques", "mathematiques", "probabilites"]
  },
  {
    text: "Pour exprimer la dispersion relative des observations autour de la moyenne arithm\xE9tique globale, on calcule le coefficient de variation ($CV$). Comment est-il d\xE9fini ?",
    options: [
      "Le rapport de l'\xE9cart-type sur la moyenne : $CV = \\frac{\\sigma}{\\bar{x}}$",
      "Le carr\xE9 de la variance divis\xE9 par l'\xE9tendue",
      "La somme cumul\xE9e de l'erreur absolue moyenne",
      "Le produit des valeurs extr\xEAmes divis\xE9 par la m\xE9diane"
    ],
    correctAnswer: 0,
    explanation: "Le coefficient de variation ($CV$) est une mesure de dispersion sans dimension, d\xE9finie comme le rapport de l'\xE9cart-type $\\sigma$ par la moyenne arithm\xE9tique $\\bar{x}$. Il est souvent exprim\xE9 en pourcentage pour comparer la variabilit\xE9 de s\xE9ries d'unit\xE9s diff\xE9rentes.",
    dimension: "Intellectuelle",
    tags: ["statistiques", "mathematiques", "stat", "probabilites"]
  },
  // FINANCES PUBLIQUES & UEMOA
  {
    text: "Parmi les crit\xE8res de convergence de premier rang \xE9dict\xE9s par l'UEMOA pour ses \xC9tats membres, le taux d'inflation annuel moyen ne doit pas d\xE9passer :",
    options: ["$1.5\\%$", "$3\\%$", "$5\\%$", "$10\\%$"],
    correctAnswer: 1,
    explanation: "Le crit\xE8re de convergence de premier rang de l'UEMOA li\xE9 \xE0 la stabilit\xE9 des prix dicte que le taux d'inflation annuel moyen dans chaque pays membre ne doit pas exc\xE9der $3\\%$ par an.",
    dimension: "M\xE9moire",
    tags: ["finances", "uemoa", "burkina", "economie"]
  },
  {
    text: "Quelle institution de l'UEMOA est charg\xE9e du contr\xF4le juridictionnel des comptes des organes de l'Union et de veiller \xE0 la bonne gestion des deniers publics communautaires ?",
    options: [
      "La Banque Centrale des \xC9tats de l'Afrique de l'Ouest (BCEAO)",
      "La Cour de Justice de l'Union",
      "La Cour des Comptes de l'UEMOA",
      "Le Conseil des Ministres de la Zone Franc"
    ],
    correctAnswer: 2,
    explanation: "La Cour des Comptes de l'UEMOA est l'organe juridictionnel supr\xEAme charg\xE9 du contr\xF4le de la gestion des ressources budg\xE9taires communautaires et de l'examen des situations financi\xE8res des \xC9tats de la zone.",
    dimension: "M\xE9moire",
    tags: ["finances", "uemoa", "burkina", "commerce"]
  },
  {
    text: "Quel est le seuil limite fix\xE9 pour le ratio de l'encours de la dette publique totale (int\xE9rieure et ext\xE9rieure) par rapport au PIB nominal dans les crit\xE8res de premier rang de l'UEMOA ?",
    options: ["Maximum $50\\%$", "Maximum $70\\%$", "Maximum $60\\%$", "Minimum $30\\%$"],
    correctAnswer: 1,
    explanation: "Le crit\xE8re d'endettement public de premier rang au sein de l'UEMOA impose aux \xC9tats membres occidentaux que leur encours total de dette publique totale (dette int\xE9rieure et dette ext\xE9rieure) ne d\xE9passe pas $70\\%$ de leur PIB nominal.",
    dimension: "M\xE9moire",
    tags: ["finances", "uemoa", "economie", "cours"]
  },
  // MATHEMATIQUES GENERALES
  {
    text: "Soient deux assertions math\xE9matiques $A$ et $B$. L'implication logique $A \\implies B$ est fausse uniquement dans lequel des cas suivants :",
    options: [
      "$A$ est vraie et $B$ est fausse",
      "$A$ est fausse et $B$ est vraie",
      "$A$ et $B$ sont toutes les deux fausses",
      "La proposition r\xE9ciproque $B \\implies A$ est \xE9tablie"
    ],
    correctAnswer: 0,
    explanation: "Selon les tables de v\xE9rit\xE9 de l'implication en logique formelle, $A \\implies B$ est toujours vraie, sauf dans la situation unique o\xF9 la pr\xE9misse $A$ est vraie mais la conclusion $B$ s'av\xE8re fausse.",
    dimension: "Intellectuelle",
    tags: ["mathematiques", "algebre", "cours"]
  },
  {
    text: "La d\xE9riv\xE9e de la fonction compos\xE9e $f(g(x))$ s'exprime selon les r\xE8gles d'analyse math\xE9matique par :",
    options: [
      "$f'(g(x)) \\times g'(x)$",
      "$f'(x) \\times g'(x)$",
      "$f'(g'(x))$",
      "$f(x) \\times g'(x) + f'(x) \\times g(x)$"
    ],
    correctAnswer: 0,
    explanation: "La d\xE9riv\xE9e d'une fonction compos\xE9e, ou r\xE8gle de d\xE9rivation en cha\xEEne, stipule que $(f \\circ g)'(x) = f'(g(x)) \\cdot g'(x)$.",
    dimension: "Intellectuelle",
    tags: ["mathematiques", "analyse"]
  },
  {
    text: "Soit $(u_n)_{n \\in \\mathbb{N}}$ une suite g\xE9om\xE9trique de premier terme $u_0 = 3$ et de raison $q = 2$. Quelle est la somme $S = u_0 + u_1 + \\dots + u_5$ de ses 6 premiers termes ?",
    options: ["$189$", "$93$", "$120$", "$63$"],
    correctAnswer: 0,
    explanation: "La formule de la somme des termes d'une suite g\xE9om\xE9trique est $S = u_0 \\frac{1 - q^N}{1 - q}$ o\xF9 $N$ est le nombre de termes. Ici : $S = 3 \\cdot \\frac{1 - 2^6}{1 - 2} = 3 \\cdot (64 - 1) = 3 \\cdot 63 = 189$.",
    dimension: "Intellectuelle",
    tags: ["mathematiques", "suites"]
  },
  // BURKINA FASO CULTURE, HISTOIRE, CIVISME
  {
    text: "Au Burkina Faso, la charte de la transition de 2022 r\xE9affirme le statut du pays. Quel fleuve donne son nom d'origine coloniale (Haute-Volta) \xE0 notre ch\xE8re patrie ?",
    options: ["Le Niger", "Le fleuve Volta (avec la Volta Noire, Blanche et Rouge)", "Le fleuve Como\xE9", "Le fleuve Congo"],
    correctAnswer: 1,
    explanation: "Le Burkina Faso s'appelait autrefois la R\xE9publique de Haute-Volta en r\xE9f\xE9rence au fleuve Volta, dont les trois principaux affluents (la Volta Noire ou Mouhoun, la Volta Blanche ou Nakamb\xE9, et la Volta Rouge ou Nazinon) baignent ses r\xE9gions.",
    dimension: "M\xE9moire",
    tags: ["burkina", "histoire", "geographie"]
  },
  {
    text: "Dans le d\xE9coupage administratif actuel du Burkina Faso, le pays est structur\xE9 en combien de r\xE9gions de planification administratives et combien de provinces ?",
    options: [
      "10 r\xE9gions et 45 provinces",
      "13 r\xE9gions et 45 provinces",
      "15 r\xE9gions et 60 provinces",
      "13 r\xE9gions et 30 provinces"
    ],
    correctAnswer: 1,
    explanation: "Le Burkina Faso comporte constitutionnellement et administrativement 13 r\xE9gions de planification, dirig\xE9es par des Gouverneurs, subdivis\xE9es en 45 provinces g\xE9r\xE9es par des Hauts-Commissaires, elles-m\xEAmes compos\xE9es de 351 d\xE9partements et communes.",
    dimension: "M\xE9moire",
    tags: ["burkina", "institution", "civisme"]
  },
  {
    text: "Quel est le nom officiel de l'hymne national du Burkina Faso, dont les paroles ont \xE9t\xE9 compos\xE9es sous la r\xE9volution par le Pr\xE9sident Thomas Sankara ?",
    options: ["La Volta\xEFque", "Le Ditany\xE8 (L'Hymne de la Victoire)", "Le Chant des H\xE9ros", "L'Hymne de Faso Educ"],
    correctAnswer: 1,
    explanation: "Le Ditany\xE8, ou Hymne de la Victoire, est l'hymne national du Burkina Faso adopt\xE9 en 1984 en remplacement de 'La Volta\xEFque'. Il exprime la dignit\xE9, la lutte anticolonialiste et l'engagement r\xE9volutionnaire pour le d\xE9veloppement national.",
    dimension: "M\xE9moire",
    tags: ["burkina", "histoire", "civisme", "cours"]
  },
  {
    text: "Dans l'administration territoriale burkinab\xE8, une province est politiquement et administrativement gouvern\xE9e au sommet par quel haut fonctionnaire nomm\xE9 par l'\xC9tat ?",
    options: ["Le Pr\xE9fet de r\xE9gion", "Le Haut-Commissaire", "Le Maire d'Arrondissement", "Le Secr\xE9taire G\xE9n\xE9ral de la Province"],
    correctAnswer: 1,
    explanation: "Le Gouverneur dirige la R\xE9gion, tandis que le Haut-Commissaire est le repr\xE9sentant supr\xEAme de l'\xC9tat burkinab\xE8 \xE0 l'\xE9chelle de la Province. Les Pr\xE9fets, eux, administrent les d\xE9partements de chaque province.",
    dimension: "M\xE9moire",
    tags: ["burkina", "institution"]
  },
  {
    text: "A quelle date historique la R\xE9publique de Haute-Volta a-t-elle obtenu son ind\xE9pendance totale de l'administration coloniale fran\xE7aise sous la direction de son premier Pr\xE9sident, Maurice Yam\xE9ogo ?",
    options: ["11 d\xE9cembre 1958", "5 ao\xFBt 1960", "4 ao\xFBt 1984", "3 janvier 1966"],
    correctAnswer: 1,
    explanation: "La proclamation de l'ind\xE9pendance de la Haute-Volta a \xE9t\xE9 prononc\xE9e le 5 ao\xFBt 1960 par Maurice Yam\xE9ogo. Le 11 d\xE9cembre 1958 correspond \xE0 la proclamation de la R\xE9publique autonome membre de la Communaut\xE9 fran\xE7aise.",
    dimension: "M\xE9moire",
    tags: ["burkina", "histoire"]
  },
  {
    text: "Sur le drapeau national du Burkina Faso, l'\xE9toile centrale jaune d'or \xE0 5 branches symbolise constitutionnellement :",
    options: [
      "La production cotonni\xE8re majeure des r\xE9gions de l'Ouest",
      "La lumi\xE8re guidant la r\xE9volution d\xE9mocratique et populaire",
      "La pr\xE9sence de ressources aurif\xE8res riches dans le sous-sol",
      "Les cinq principaux cours d'eau du bassin versant de la Como\xE9"
    ],
    correctAnswer: 1,
    explanation: "Sur le drapeau bicolore vert et rouge du Burkina Faso (les bandes verte et rouge figurant respectivement l'agriculture/l'esp\xE9rance et le sang vers\xE9 de nos martyrs), l'\xE9toile jaune \xE0 cinq branches centrale repr\xE9sente le flambeau spirituel guidant la r\xE9volution d\xE9mocratique et populaire.",
    dimension: "Civisme",
    tags: ["burkina", "civisme", "histoire", "culture"]
  },
  {
    text: "Quelle grande ville industrielle du Burkina Faso est surnomm\xE9e avec \xE9l\xE9gance la 'Cit\xE9 du Paysan Noir' ?",
    options: ["Koudougou", "Banfora", "Bobo-Dioulasso", "Ouahigouya"],
    correctAnswer: 1,
    explanation: "Banfora, chef-lieu de la r\xE9gion des Cascades, est surnomm\xE9e la 'Cit\xE9 du Paysan Noir' en raison de sa productivit\xE9 agricole et industrielle florissante. Koudougou est surnomm\xE9e la 'Cit\xE9 du Cavalier Rouge'.",
    dimension: "M\xE9moire",
    tags: ["burkina", "geographie"]
  },
  {
    text: "A dater de quelle ann\xE9e historique la R\xE9publique de Haute-Volta a-t-elle \xE9t\xE9 officiellement rebaptis\xE9e 'Burkina Faso' sous la dynamique impulsion r\xE9volutionnaire du Capitaine Thomas Sankara ?",
    options: ["1980", "1983", "1984", "1987"],
    correctAnswer: 2,
    explanation: "La Haute-Volta est officiellement devenue le 'Burkina Faso' (le Pays des Hommes Int\xE8gres) le 4 ao\xFBt 1984, un an jour pour jour apr\xE8s l'av\xE8nement de la r\xE9volution d\xE9mocratique et populaire du 4 ao\xFBt 1983.",
    dimension: "M\xE9moire",
    tags: ["burkina", "histoire", "culture"]
  },
  {
    text: "Dans le Sud-Ouest du Burkina Faso, quel site pittoresque d'une importance biologique et g\xE9ologique majeure \xE0 proximit\xE9 de Banfora attire de nombreux chercheurs ?",
    options: [
      "Les Cascades de Karfigu\xE9la et les D\xF4mes de Fabedougou",
      "Le Pic de Nahouri",
      "Le Parc National de l'Arly",
      "La Mare aux Hippopotames de Bala"
    ],
    correctAnswer: 0,
    explanation: "Les Cascades de Karfigu\xE9la et les formations gr\xE9seuses des D\xF4mes de Fabedougou, pr\xE8s de Banfora, sont des curiosit\xE9s naturelles majeures caract\xE9ristiques de la g\xE9omorphologie de l'Ouest burkinab\xE8.",
    dimension: "M\xE9moire",
    tags: ["burkina", "geographie"]
  }
];
function getFallbackQuestions(subjects, settings, totalTarget, excludeList = []) {
  const normSubjects = (subjects || []).map((s) => s.toLowerCase().trim());
  const normExclude = (excludeList || []).map((e) => e.toLowerCase().trim()).filter(Boolean);
  let pool = FALLBACK_QUIZ_DATABASE.filter((q) => {
    const isExcluded = normExclude.some(
      (ex) => q.text.toLowerCase().trim() === ex || q.text.toLowerCase().trim().includes(ex) || ex.includes(q.text.toLowerCase().trim())
    );
    if (isExcluded) return false;
    return q.tags.some((tag) => {
      return normSubjects.some((subj) => subj.includes(tag) || tag.includes(subj));
    });
  });
  if (pool.length < totalTarget) {
    const poolTextSet = new Set(pool.map((p) => p.text));
    const remainder = FALLBACK_QUIZ_DATABASE.filter((p) => {
      const isExcluded = normExclude.some(
        (ex) => p.text.toLowerCase().trim() === ex || p.text.toLowerCase().trim().includes(ex) || ex.includes(p.text.toLowerCase().trim())
      );
      return !isExcluded && !poolTextSet.has(p.text);
    });
    pool = [...pool, ...remainder];
  }
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const finalSelection = shuffled.slice(0, totalTarget);
  return finalSelection.map((q, i) => ({
    text: q.text,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation + " [G\xE9n\xE9r\xE9 avec succ\xE8s via la Base Locale de Secours Faso Educ \u{1F1E7}\u{1F1EB}]",
    dimension: q.dimension,
    id: `fall-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
  }));
}
app.post("/api/gemini/quiz", async (req, res) => {
  const { subjects, settings, excludeQuestions, userEmail } = req.body;
  const requestedCount = settings?.questionCount || 10;
  const totalTarget = Math.min(100, Math.max(1, requestedCount));
  const checkResult = await checkFreeTrialAndLimits(userEmail, "quiz", totalTarget);
  if (!checkResult.allowed) {
    return res.status(403).json({ error: checkResult.reason, message: checkResult.message });
  }
  const cleanEmail = (userEmail || "").trim().toLowerCase();
  const prof = cleanEmail ? serverProfiles[cleanEmail] : null;
  const persistentUserExclusions = prof ? prof.generatedQuestions || [] : [];
  const baseExcludedList = [.../* @__PURE__ */ new Set([
    ...excludeQuestions || [],
    ...persistentUserExclusions
  ])];
  const currentExcludedList = [...baseExcludedList];
  try {
    const accumulatedQuestions = [];
    const batchSize = totalTarget <= 35 ? totalTarget : 30;
    const totalBatches = Math.ceil(totalTarget / batchSize);
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const currentBatchTarget = Math.min(batchSize, totalTarget - accumulatedQuestions.length);
      if (currentBatchTarget <= 0) break;
      const prompt = `G\xE9n\xE8re un lot de ${currentBatchTarget} questions de quiz de pr\xE9paration intensive aux CONCOURS PUBLICS (Burkina Faso) sur les sujets suivants : ${subjects.join(", ")}.
      Niveau d'\xE9tudes : ${settings?.level || "Licence"}
      Difficult\xE9 : ${settings?.difficulty || "Moyen"}
      Num\xE9ro du lot : ${batchIdx + 1}/${totalBatches}
      
      R\xE8gles de DIVERSIT\xC9, de CONFORMIT\xC9 et de QUALIT\xC9 (CRITIQUE) :
      1. AUCUNE REDONDANCE : Ne pose pas deux fois la m\xEAme question ou une question trop similaire \xE0 celles pass\xE9es.
      2. COUVERTURE EXHAUSTIVE : Explore tous les aspects du programme (dates, acteurs cl\xE9s, concepts, g\xE9ographie, institutions, culture).
      3. STRUCTURE : 4 choix de r\xE9ponses (1 correcte + 3 distracteurs cr\xE9dibles).
      4. DIMENSIONS : \xC9quilibre entre Intellectuelle (analyse), Morale (\xE9thique/civisme) et M\xE9moire (faits pr\xE9cis).
      5. PRIORIT\xC9 G\xC9OPOLITIQUE ET ACTUALIT\xC9 CONTEMPORAINE : 
         - Focus Majeur : Burkina Faso. Privil\xE9gie l'histoire authentique, la g\xE9ographie physique et humaine exacte, les institutions administratives et politiques de la Transition, l'AES (Alliance des \xC9tats du Sahel), la refondation r\xE9publicaine, et les r\xE9formes constitutionnelles et administratives r\xE9centes.
         - Focus Secondaire : Afrique de l'Ouest, Mali, Niger, institutions de coop\xE9ration r\xE9gionale.
         - Autres : Actualit\xE9s majeures mondiales.
      6. STYLE : Langage administratif et p\xE9dagogique de type concours.
      7. EXACTITUDE FACTUELLE ABSOLUE : V\xE9rifie chaque fait, date et surnom. Par exemple, Banfora est la "Cit\xE9 du Paysan Noir" (et non Koudougou qui est la "Cit\xE9 du Cavalier Rouge"). Toute erreur factuelle est inacceptable pour une pr\xE9paration de concours.
      8. CONFORMIT\xC9 TERRITORIALE ET SOUVERAINET\xC9 (BURKINA FASO) : Le Burkina Faso compte exactement 45 provinces et 13 r\xE9gions administratives. Les questions portant sur la politique, la Constitution r\xE9vis\xE9e, l'administration territoriale, ou la g\xE9ophysique doivent imp\xE9rativement refl\xE9ter les derni\xE8res r\xE9formes officielles en vigueur.
      9. AUTHENTICIT\xC9 ET V\xC9RACIT\xC9 DOCUMENTAIRE : Chaque question sur l'histoire ou l'actualit\xE9 contemporaine doit s'appuyer sur des faits r\xE9els, consensuels ou officiellement d\xE9cr\xE9t\xE9s. \xC9vite absolument tout anachronisme ou approximation historique, en s'assurant que l'actualit\xE9 r\xE9cente et les nouvelles r\xE9formes l\xE9gislatives soient parfaitement int\xE9gr\xE9es et valides.
      10. INT\xC9GRATION ET R\xC9DACTION DES \xC9QUATIONS LATEX (VITAL - RENDU S\xC9CURIS\xC9 ET OBLIGATOIRE) :
          Si le sujet concerne l'\xE9conomie, la finance, les math\xE9matiques ou les statistiques, int\xE9grez imp\xE9rativement des formules r\xE9dig\xE9es en LaTeX standard de tr\xE8s haute qualit\xE9 :
          - Utilisez TOUJOURS les commandes LaTeX internationales en anglais. Il est ABSOLUMENT INTERDIT d'\xE9crire 'fraction' ou 'frac' ou 'beta' ou 'alpha' ou 'somme' en toutes lettres sans antislash (vous devez TOUJOURS \xE9crire $\\alpha$, $\\beta$, $\\frac{a}{b}$, $\\sum$, etc.).
          - CHAQUE variable math\xE9matique, symbole, fraction, indice ou lettre grecque, m\xEAme isol\xE9e dans une phrase (par exemple: $x$, $y$, $\\mu$, $\\sigma$, $\\beta$), DOIT imp\xE9rativement \xEAtre entour\xE9e de dollars de d\xE9limitation ($...$ pour le texte interne et $$...$$ pour les formules isol\xE9es).
          - \xC9vitez absolument d'introduire des mots fran\xE7ais ou du texte normal de phrase directement \xE0 l'int\xE9rieur de blocs math\xE9matiques (par exemple n'\xE9crivez pas $la fraction est ...$).
          - Utilisez de vrais symboles de multiplication (\\times ou \\cdot) et jamais de lettre 'x' ou '*' \xE0 l'int\xE9rieur d'un bloc de formule.
      
      ${currentExcludedList.length > 0 ? `11. EXCLUSION STRICTE : Ne r\xE9p\xE8te ABSOLUMENT PAS ces questions de quiz d\xE9j\xE0 trait\xE9es ou d\xE9j\xE0 pr\xE9sentes dans la biblioth\xE8que : [${currentExcludedList.slice(-1e3).join(" | ")}]. Propose de NOUVELLES questions de quiz uniques, authentiques et actualis\xE9es, en particulier sur l'actualit\xE9 contemporaine, l'histoire, la g\xE9ographie, l'int\xE9gration r\xE9gionale ou les nouvelles r\xE9formes (Burkina Faso). Chaque question g\xE9n\xE9r\xE9e doit \xEAtre in\xE9dite.` : "11. Explore de nouvelles th\xE9matiques vari\xE9es d'actualit\xE9 et d'histoire-g\xE9ographie moderne burkinab\xE8 pour proposer des questions in\xE9dites."}
 
      Retourne un tableau JSON d'objets :
      {
        "text": "La question (avec formules LaTeX $...$ ou $$...$$ si applicable)",
        "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
        "correctAnswer": index,
        "explanation": "Explication d\xE9taill\xE9e pour la pr\xE9paration au concours, clarifiant les \xE9quations si applicables",
        "dimension": "Intellectuelle" | "Morale" | "M\xE9moire"
      }`;
      try {
        let response;
        let tryPro = isProModelAvailable;
        if (tryPro) {
          try {
            response = await ai.models.generateContent({
              model: "gemini-3.1-pro-preview",
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: import_genai.Type.ARRAY,
                  items: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      text: { type: import_genai.Type.STRING },
                      options: {
                        type: import_genai.Type.ARRAY,
                        items: { type: import_genai.Type.STRING },
                        minItems: 4,
                        maxItems: 4
                      },
                      correctAnswer: { type: import_genai.Type.INTEGER },
                      explanation: { type: import_genai.Type.STRING },
                      dimension: { type: import_genai.Type.STRING, enum: ["Intellectuelle", "Morale", "M\xE9moire"] }
                    },
                    required: ["text", "options", "correctAnswer", "explanation", "dimension"]
                  }
                }
              }
            });
          } catch (proError) {
            isProModelAvailable = false;
            console.info("Info: Switching Gemini routing to high-efficiency flash tier for enhanced stability and ultra-low latency.");
            tryPro = false;
          }
        }
        if (!tryPro || !response) {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    text: { type: import_genai.Type.STRING },
                    options: {
                      type: import_genai.Type.ARRAY,
                      items: { type: import_genai.Type.STRING },
                      minItems: 4,
                      maxItems: 4
                    },
                    correctAnswer: { type: import_genai.Type.INTEGER },
                    explanation: { type: import_genai.Type.STRING },
                    dimension: { type: import_genai.Type.STRING, enum: ["Intellectuelle", "Morale", "M\xE9moire"] }
                  },
                  required: ["text", "options", "correctAnswer", "explanation", "dimension"]
                }
              }
            }
          });
        }
        const parsedQuestions = JSON.parse(response.text || "[]");
        const validQuestions = Array.isArray(parsedQuestions) ? parsedQuestions : [];
        for (const q of validQuestions) {
          if (!q || !q.text) continue;
          const isDuplicate = currentExcludedList.some((ex) => {
            if (!ex) return false;
            const normEx = ex.toLowerCase().trim();
            const normQText = q.text.toLowerCase().trim();
            return normEx === normQText || normQText.includes(normEx) || normEx.includes(normQText);
          });
          if (!isDuplicate) {
            accumulatedQuestions.push(q);
            currentExcludedList.push(q.text);
          } else {
            console.warn(`[DUPLICATE FILTER] Blocked repeated question found in generation batch: "${q.text}"`);
          }
        }
        if (batchIdx < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      } catch (err) {
        const errMsg = err.message || JSON.stringify(err);
        console.warn(`\u26A0\uFE0F Error during batch ${batchIdx + 1} of Gemini quiz generation:`, errMsg);
        break;
      }
    }
    if (accumulatedQuestions.length < totalTarget) {
      const delta = totalTarget - accumulatedQuestions.length;
      console.info(`\u26A1 Padding remaining ${delta} questions from highly refined fallback database to reach strict requested count of ${totalTarget}.`);
      const fallbackPadding = getFallbackQuestions(subjects, settings, delta, currentExcludedList);
      accumulatedQuestions.push(...fallbackPadding);
    }
    const formattedQuestions = accumulatedQuestions.slice(0, totalTarget).map((q, i) => ({
      ...q,
      id: `q-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    }));
    if (prof) {
      if (!prof.generatedQuestions) prof.generatedQuestions = [];
      prof.generatedQuestions.push(...formattedQuestions.map((q) => q.text));
      if (prof.generatedQuestions.length > 3e3) {
        prof.generatedQuestions = prof.generatedQuestions.slice(-3e3);
      }
      prof.totalQcmsGenerated = (prof.totalQcmsGenerated || 0) + 1;
      prof.totalQuestionsGenerated = (prof.totalQuestionsGenerated || 0) + formattedQuestions.length;
      saveLocalDB();
    }
    if (!checkResult.isPremium && checkResult.limitRecord) {
      checkResult.limitRecord.quizCount = (checkResult.limitRecord.quizCount || 0) + 1;
      checkResult.limitRecord.questionsCount = (checkResult.limitRecord.questionsCount || 0) + formattedQuestions.length;
      saveLocalDB();
    }
    return res.json(formattedQuestions);
  } catch (error) {
    console.error("Quiz generation error on server, falling back:", error);
    try {
      const fallbackQs = getFallbackQuestions(subjects, settings, totalTarget, baseExcludedList);
      if (prof) {
        prof.totalQcmsGenerated = (prof.totalQcmsGenerated || 0) + 1;
        prof.totalQuestionsGenerated = (prof.totalQuestionsGenerated || 0) + fallbackQs.length;
      }
      if (!checkResult.isPremium && checkResult.limitRecord) {
        checkResult.limitRecord.quizCount = (checkResult.limitRecord.quizCount || 0) + 1;
        checkResult.limitRecord.questionsCount = (checkResult.limitRecord.questionsCount || 0) + fallbackQs.length;
      }
      saveLocalDB();
      return res.json(fallbackQs);
    } catch (fallbackError) {
      res.status(500).json({ error: fallbackError.message || "Failed to generate fallback quiz questions" });
    }
  }
});
app.post("/api/gemini/course", async (req, res) => {
  try {
    const { subject, level, userEmail } = req.body;
    const checkResult = await checkFreeTrialAndLimits(userEmail, "course", 1);
    if (!checkResult.allowed) {
      return res.status(403).json({ error: checkResult.reason, message: checkResult.message });
    }
    const prompt = `G\xE9n\xE8re un plan de cours acad\xE9mique et professionnel extr\xEAmement rigoureux et complet, adapt\xE9 pour pr\xE9parer les concours de la fonction publique au Burkina Faso (cat\xE9gorie A, conseiller \xE9conomique, imp\xF4ts, douane, tr\xE9sor, statistiques).
    Sujet : ${subject}
    Niveau acad\xE9mique attendu : ${level}

    R\xE8gles de structure :
    1. CONSTITUTION DU PLAN : G\xE9n\xE8re un plan exhaustif de 5 \xE0 6 chapitres structur\xE9s pour couvrir l'int\xE9gralit\xE9 du sujet demand\xE9.
    2. R\xC9DACTION DES SQUELETTES : Pour chaque chapitre, fournis un titre accrocheur et professionnel et un r\xE9sum\xE9 (\xAB summary \xBB) de 2 \xE0 3 lignes d\xE9crivant exactement les concepts cl\xE9s, les mod\xE8les ou th\xE9ories de r\xE9f\xE9rence (ex: Solow, Keynes, Pareto, Cobb-Douglas etc.) et les \xE9quations math\xE9matiques th\xE9oriques qui y seront approfondies.
    3. CONTENU INITIAL VIDE : Le champ \xAB content \xBB de chaque chapitre doit imp\xE9rativement \xEAtre une cha\xEEne de caract\xE8res vide "". Il sera g\xE9n\xE9r\xE9 de mani\xE8re dynamique sur-demande par le candidat lorsqu'il cliquera dessus.

    Retourne UNIQUEMENT un objet JSON conforme \xE0 ce sch\xE9ma :
    {
      "title": "Titre professionnel et complet du cours",
      "category": "Micro\xE9conomie" | "Macro\xE9conomie" | "Statistiques" | "\xC9conomie de D\xE9veloppement" | "Finance Publique" | "Math\xE9matiques" | "Droit/Administration",
      "description": "Un r\xE9sum\xE9 accrocheur, d\xE9taill\xE9 et professionnel du contenu global et des comp\xE9tences vis\xE9es par ce cours",
      "chapters": [
        {
          "title": "Titre du chapitre",
          "summary": "R\xE9sum\xE9 de 2-3 lignes d\xE9crivant ce qui sera trait\xE9 et appris dans ce chapitre",
          "content": ""
        }
      ]
    }`;
    let response;
    let tryPro = isProModelAvailable;
    if (tryPro) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                category: { type: import_genai.Type.STRING },
                description: { type: import_genai.Type.STRING },
                chapters: {
                  type: import_genai.Type.ARRAY,
                  items: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      title: { type: import_genai.Type.STRING },
                      summary: { type: import_genai.Type.STRING },
                      content: { type: import_genai.Type.STRING }
                    },
                    required: ["title", "summary", "content"]
                  }
                }
              },
              required: ["title", "category", "description", "chapters"]
            }
          }
        });
      } catch (proError) {
        isProModelAvailable = false;
        console.info("Info: Switching Gemini routing to high-efficiency flash tier for enhanced stability and ultra-low latency.");
        tryPro = false;
      }
    }
    if (!tryPro || !response) {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              title: { type: import_genai.Type.STRING },
              category: { type: import_genai.Type.STRING },
              description: { type: import_genai.Type.STRING },
              chapters: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    title: { type: import_genai.Type.STRING },
                    summary: { type: import_genai.Type.STRING },
                    content: { type: import_genai.Type.STRING }
                  },
                  required: ["title", "summary", "content"]
                }
              }
            },
            required: ["title", "category", "description", "chapters"]
          }
        }
      });
    }
    if (!checkResult.isPremium && checkResult.limitRecord) {
      checkResult.limitRecord.courseCount = (checkResult.limitRecord.courseCount || 0) + 1;
      saveLocalDB();
    }
    res.json(JSON.parse(response.text || "{}"));
  } catch (error) {
    console.error("Course generation error on server:", error);
    res.status(500).json({ error: error.message || "Failed to generate course" });
  }
});
app.post("/api/gemini/course-chapter", async (req, res) => {
  try {
    const { courseTitle, courseCategory, chapterTitle, chapterSummary, level, subject, userEmail } = req.body;
    const checkResult = await checkFreeTrialAndLimits(userEmail, "course", 1);
    if (!checkResult.allowed && checkResult.reason === "trial_expired") {
      return res.status(403).json({ error: checkResult.reason, message: checkResult.message });
    }
    const prompt = `G\xE9n\xE8re le contenu complet, volumineux et acad\xE9mique d'un chapitre d'\xE9tude sp\xE9cifique pour le cours de pr\xE9paration intensif suivant :
    Sujet global : ${subject}
    Nom du cours : ${courseTitle} (Cat\xE9gorie : ${courseCategory})
    Niveau d'\xE9tudes requis : ${level}
    Chapitre \xE0 r\xE9diger aujourd'hui : ${chapterTitle}
    R\xE9sum\xE9 des concepts & objectifs de ce chapitre : ${chapterSummary}

    R\xE8gles d'or pour la r\xE9daction (CRITIQUE pour l'affichage de formules complexes LaTeX en fran\xE7ais) :
    1. PROFONDEUR ET VOLUME D'\xC9TUDE : \xC9cris un cours complet de niveau Universit\xE9/Grandes \xC9coles (ENAREF, ENAM, Universit\xE9 Joseph Ki-Zerbo). Ne te limite pas \xE0 un plan ou un r\xE9sum\xE9 h\xE2tif. R\xE9dige de longs paragraphes d\u2019explications substantielles (au moins 5 \xE0 8 sections et d\xE9monstrations pour un total de 800 \xE0 1500 mots) d\xE9taillant rigoureusement les concepts cl\xE9s.
    2. COH\xC9RENCE ET EXACTITUDE MATH\xC9MATIQUE LATEX (RENDU S\xC9CURIS\xC9 REQUIS) :
       - Si le sujet s'y pr\xEAte (\xE9conomie, finance, statistiques, math\xE9matiques), incluse obligatoirement de v\xE9ritables formules d\xE9taill\xE9es et des \xE9quations r\xE9dig\xE9es en LaTeX international valide.
       - Utilisez de grands blocs centr\xE9s avec des doubles dollars $$...$$ pour les \xE9quations majeures isol\xE9es (ex: $$Y = A K^\\alpha L^\\beta$$).
       - Utilisez des simples dollars $...$ pour les variables ou petites expressions math\xE9matiques int\xE9gr\xE9es au texte (ex: la variable $x$ ou le param\xE8tre d'\xE9lasticit\xE9 $\\beta$, la moyenne $\\mu$ ou la variance $\\sigma^2$, etc.).
       - CHAQUE lettre de variable isol\xE9e (ex: $Y$, $A$, $K$, $L$, $p_x$, $x$, $y$) dans vos phrases doit \xEAtre imp\xE9rativement encadr\xE9e de dollars $...$ pour qu'elle soit rendue proprement comme une expression math\xE9matique au milieu d'un paragraphe.
       - Utilisez UNIQUEMENT les commandes LaTeX internationales en anglais. Ne traduisez JAMAIS les commandes en fran\xE7ais (interdiction absolue d'\xE9crire "fraction" ou "frac" brut sans antislash, utilisez toujours \\frac{num\xE9rateur}{d\xE9nominateur} pour les fractions). Exemple correct : \\frac{d Q}{d P}, incorrect : fraction{dQ}{dP} ou frac(dQ)(dP).
       - Pr\xE9c\xE9dez TOUJOURS toutes les lettres grecques d'un antislash LaTeX: \\alpha, \\beta, \\lambda, \\mu, \\sigma, \\pi, \\Delta, \\theta, \\gamma (n'\xE9crivez jamais "beta" ou "alpha" brut sous peine de casser le rendu).
       - Ne mettez jamais de mots fran\xE7ais ou de phrases ordinaires directement \xE0 l'int\xE9rieur de blocs math\xE9matiques.
       - Utilisez de vrais symboles de multiplication (\\times ou \\cdot) et jamais de lettre 'x' ou '*' \xE0 l'int\xE9rieur d'un bloc de formule.
    3. ILLUSTRATIONS CONTEXTUELLES : Int\xE9grez des exemples d'illustrations et des \xE9tudes de cas concrets ou d'analyse \xE9conomique et financi\xE8re se rapportant aux r\xE9alit\xE9s burkinab\xE8 et ouest-africaines (UEMOA, BCEAO, tr\xE9sor public du Burkina Faso, statistiques de l'INSD etc.).
    4. S'\xC9VALUER : Terminez le cours par un petit paragraphe de synth\xE8se ou d'interpr\xE9tation \xE9conomique/sociale de ces outils.

    Retourne UNIQUEMENT un objet JSON conforme \xE0 ce sch\xE9ma :
    {
      "content": "Le texte complet et structur\xE9 du chapitre r\xE9dig\xE9 avec grand soin p\xE9dagogique, utilisant un format de Markdown a\xE9r\xE9, avec des sous-titres ### et de splendides formules math\xE9matiques complexes r\xE9dig\xE9es en LaTeX."
    }`;
    let response;
    let tryPro = isProModelAvailable;
    if (tryPro) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: import_genai.Type.OBJECT,
              properties: {
                content: { type: import_genai.Type.STRING }
              },
              required: ["content"]
            }
          }
        });
      } catch (proError) {
        isProModelAvailable = false;
        console.info("Info: Switching Gemini routing to high-efficiency flash tier for enhanced stability and ultra-low latency.");
        tryPro = false;
      }
    }
    if (!tryPro || !response) {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              content: { type: import_genai.Type.STRING }
            },
            required: ["content"]
          }
        }
      });
    }
    res.json(JSON.parse(response.text || "{}"));
  } catch (error) {
    console.error("Chapter content generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate chapter content" });
  }
});
app.post("/api/gemini/forum", async (req, res) => {
  try {
    const { postTitle, postContent, userEmail } = req.body;
    const checkResult = await checkFreeTrialAndLimits(userEmail, "course", 1);
    if (!checkResult.allowed && checkResult.reason === "trial_expired") {
      return res.status(403).json({ error: checkResult.reason, message: checkResult.message });
    }
    const prompt = `Vous \xEAtes un Professeur / Expert acad\xE9mique \xE9minent d'Afrique de l'Ouest, sp\xE9cialis\xE9 dans la pr\xE9paration des candidats aux concours directs de la fonction publique au Burkina Faso (ENAM, Douanes, Tr\xE9sor, Conseillers \xC9conomiques, Imp\xF4ts, Statistiques).
    Vous r\xE9pondez \xE0 une question d'un candidat sur le forum de r\xE9vision.

    Titre du sujet : ${postTitle}
    Contenu du message : ${postContent}

    R\xE8gles de style et de fond :
    1. TON BIENVEILLANT ET SOPHISTIQU\xC9 : Encouragez le candidat, \xE9crivez de fa\xE7on claire, polie et didactique.
    2. MATHS ET FORMULES LATEX (VITAL - RENDU S\xC9CURIS\xC9) : Si la question aborde des notions quantitatives, \xE9conomiques, fiscales ou statistiques, fournissez des explications math\xE9matiques rigoureuses r\xE9dig\xE9es en LaTeX standard de haute pr\xE9cision.
       - Utilisez $...$ pour les termes math\xE9matiques en ligne, et des blocs centr\xE9s avec des doubles dollars $$...$$ pour les \xE9quations majeures isol\xE9es.
       - Utilisez obligatoirement les commandes LaTeX officielles en anglais (ex: \\frac{num\xE9rateur}{d\xE9nominateur}, interdiction absolue d'\xE9crire "fraction" ou "frac" brut sans antislash).
       - Pr\xE9c\xE9dez TOUJOURS toutes les lettres grecques d'un antislash (ex: \\alpha, \\beta, \\lambda, \\mu, \\sigma, \\pi, \\theta). N'\xE9crivez jamais "beta" ou "alpha" brut sous peine de bloquer l'affichage du navigateur.
    3. CONTEXTE NATIONAL : Faites r\xE9f\xE9rence aux bonnes lois administratives volta\xEFques/burkinab\xE8 ou aux r\xE9alit\xE9s ouest-africaines (UEMOA, CEDEAO) si pertinent.
    
    R\xE9digez directement votre r\xE9ponse d'expert (environ 2 \xE0 4 paragraphes substantiels). Ne renvoyez pas de JSON, juste du texte brut bien format\xE9 ou contenant des \xE9quations LaTeX.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });
    res.json({ text: response.text || "D\xE9sol\xE9, je ne parviens pas \xE0 formuler une r\xE9ponse d'expert pour le moment." });
  } catch (error) {
    console.error("Forum reply error on server:", error);
    res.status(500).json({ error: error.message || "Failed to generate forum reply" });
  }
});
app.get("/api/profiles/:email", async (req, res) => {
  const identifier = req.params.email ? req.params.email.trim().toLowerCase() : "";
  const deviceId = req.query.deviceId ? req.query.deviceId.trim() : "";
  if (!identifier) {
    return res.status(400).json({ error: "Missing identifier parameter" });
  }
  let email = identifier;
  let prof = null;
  const isEmail = identifier.includes("@");
  if (supabaseAdmin2) {
    try {
      let query = supabaseAdmin2.from("profiles").select("*");
      if (isEmail) {
        query = query.eq("email", identifier);
      } else {
        query = query.eq("phone", identifier);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (data) {
        email = data.email || identifier;
        if (data.is_banned) {
          const cleanMail = email.trim().toLowerCase();
          if (!serverBannedEmails.includes(cleanMail)) {
            serverBannedEmails.push(cleanMail);
          }
          return res.status(403).json({ error: "banned", message: "\u{1F512} S\xE9curit\xE9 : Ce compte Faso Educ est suspendu." });
        }
        prof = {
          email: data.email,
          name: data.name,
          phone: data.phone || "",
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          level: data.level,
          targetExam: data.target_exam,
          regionName: data.region_name,
          avatar: data.avatar,
          isPremium: data.is_premium,
          points: data.points,
          learningStreak: data.learning_streak,
          password: data.password || "",
          registered: true,
          boundDeviceId: data.bound_device_id || null,
          transferRequested: !!data.transfer_requested,
          registrationDate: data.registration_date || data.created_at || null
        };
      }
    } catch (err) {
      console.error("Supabase profile get error, falling back:", err.message);
    }
  }
  if (!prof) {
    if (isEmail) {
      if (serverProfiles[email]) {
        prof = { ...serverProfiles[email] };
      }
    } else {
      const foundKey = Object.keys(serverProfiles).find((k) => {
        const p = serverProfiles[k];
        return p.phone === identifier || p.phone && p.phone.replace(/\s+/g, "") === identifier.replace(/\s+/g, "");
      });
      if (foundKey) {
        email = foundKey;
        prof = { ...serverProfiles[email] };
      }
    }
  } else if (serverProfiles[email]) {
    prof = { ...serverProfiles[email], ...prof };
  }
  if (!prof) {
    return res.json({ registered: false, email: identifier });
  }
  const adminEmail = (process.env.ADMIN_EMAIL || "ibrahimsawadogo36@gmail.com").trim().toLowerCase();
  const isAdminAccount = email.trim().toLowerCase() === adminEmail || email.trim().toLowerCase() === "ibrahimsawadogo36@gmail.com";
  if (prof && isAdminAccount) {
    prof.isPremium = true;
    prof.is_premium = true;
  }
  if (serverBannedEmails.includes(email)) {
    return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration." });
  }
  if (prof) {
    if (deviceId && !isAdminAccount) {
      const otherProfWithDevice = Object.values(serverProfiles).find((p) => p.email && p.email !== email && p.boundDeviceId === deviceId);
      if (otherProfWithDevice) {
        return res.status(403).json({
          error: "device_limit_exceeded",
          message: `\u{1F512} ALERTE DE S\xC9CURIT\xC9 : Ce terminal mobile est d\xE9j\xE0 li\xE9 \xE0 un autre compte (${otherProfWithDevice.email}). L'utilisation d'un m\xEAme t\xE9l\xE9phone pour g\xE9rer plusieurs comptes est d\xE9sactiv\xE9e pour lutter contre la fraude. Veuillez faire une demande de transfert d'appareil ou contacter l'administration.`,
          boundDeviceId: otherProfWithDevice.boundDeviceId,
          transferRequested: !!prof.transferRequested
        });
      }
      if (!prof.boundDeviceId) {
        prof.boundDeviceId = deviceId;
        if (serverProfiles[email]) {
          serverProfiles[email].boundDeviceId = deviceId;
        } else {
          serverProfiles[email] = { ...prof };
        }
        if (supabaseAdmin2) {
          try {
            await supabaseAdmin2.from("profiles").update({ bound_device_id: deviceId }).eq("email", email);
          } catch (apiErr) {
            console.error("Failed to save bound device id to Supabase:", apiErr.message);
          }
        }
        saveLocalDB();
      } else if (prof.boundDeviceId !== deviceId) {
        const alertTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("fr-FR");
        const alertDate = (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR");
        return res.status(403).json({
          error: "device_locked",
          message: `ALERTE DE S\xC9CURIT\xC9 : Ce compte est d\xE9j\xE0 li\xE9 \xE0 un autre terminal. Connexion simultan\xE9e interdite. Tentative d\xE9tect\xE9e le ${alertDate} \xE0 ${alertTime}.`,
          boundDeviceId: prof.boundDeviceId,
          transferRequested: !!prof.transferRequested
        });
      }
    }
    const token = generateToken({ email: prof.email });
    const safeProf = { ...prof };
    delete safeProf.password;
    return res.json({ ...safeProf, token });
  }
  return res.json({ registered: false, email });
});
app.post("/api/profiles/request-transfer", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "E-mail requis." });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (serverProfiles[cleanEmail]) {
    serverProfiles[cleanEmail].transferRequested = true;
  } else {
    serverProfiles[cleanEmail] = { email: cleanEmail, transferRequested: true, registered: true };
  }
  if (supabaseAdmin2) {
    try {
      await supabaseAdmin2.from("profiles").update({ transfer_requested: true }).eq("email", cleanEmail);
    } catch (err) {
      console.error("Failed to save transfer status to Supabase:", err.message);
    }
  }
  saveLocalDB();
  res.json({
    success: true,
    message: "Votre demande d'autorisation de transfert d'appareil mobile a \xE9t\xE9 transmise au panel d'administration. Vous pourrez vous connecter sur cet appareil une fois l'examen du re\xE7u valid\xE9."
  });
});
app.post("/api/profiles/sync", async (req, res) => {
  const profile = req.body;
  const email = profile.email ? profile.email.trim().toLowerCase() : "";
  const clientDeviceId = profile.deviceId || profile.boundDeviceId || "";
  if (!email) {
    return res.status(400).json({ error: "Missing email in profile" });
  }
  if (clientDeviceId) {
    const otherProfWithDevice = Object.values(serverProfiles).find((p) => p.email && p.email !== email && p.boundDeviceId === clientDeviceId);
    if (otherProfWithDevice) {
      return res.status(403).json({
        error: "device_limit_exceeded",
        message: `\u{1F512} ALERTE DE S\xC9CURIT\xC9 : Ce terminal mobile est d\xE9j\xE0 li\xE9 \xE0 un autre compte (${otherProfWithDevice.email}). L'utilisation d'un m\xEAme t\xE9l\xE9phone pour g\xE9rer plusieurs comptes est d\xE9sactiv\xE9e pour lutter contre la fraude. Veuillez faire une demande de transfert d'appareil ou contacter l'administration.`
      });
    }
  }
  if (serverBannedEmails.includes(email)) {
    return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration" });
  }
  let isPremiumStatus = false;
  const adminEmail = (process.env.ADMIN_EMAIL || "ibrahimsawadogo36@gmail.com").trim().toLowerCase();
  if (email.toLowerCase().trim() === adminEmail || email.toLowerCase().trim() === "ibrahimsawadogo36@gmail.com") {
    isPremiumStatus = true;
  } else if (supabaseAdmin2) {
    try {
      const { data: dbCheck } = await supabaseAdmin2.from("profiles").select("is_banned, is_premium").eq("email", email).maybeSingle();
      if (dbCheck) {
        if (dbCheck.is_banned) {
          if (!serverBannedEmails.includes(email)) {
            serverBannedEmails.push(email);
          }
          return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration" });
        }
        isPremiumStatus = !!dbCheck.is_premium;
      } else {
        isPremiumStatus = serverProfiles[email] ? !!serverProfiles[email].isPremium || !!serverProfiles[email].is_premium : false;
      }
      let existsInDb = false;
      let dbExistingPassword = "";
      try {
        const { data: dataCheck, error: errorCheck } = await supabaseAdmin2.from("profiles").select("email, password").eq("email", email).maybeSingle();
        if (dataCheck) {
          existsInDb = true;
          dbExistingPassword = dataCheck.password || "";
        }
      } catch (checkErr) {
        existsInDb = !!serverProfiles[email];
      }
      const safeData = {
        name: profile.name,
        level: profile.level,
        target_exam: profile.targetExam,
        region_name: profile.regionName,
        avatar: profile.avatar || "\u{1F468}\u200D\u{1F393}",
        is_premium: isPremiumStatus,
        points: profile.points || 0,
        learning_streak: profile.learningStreak || 0
      };
      let syncedPassword = "";
      if (profile.password) {
        syncedPassword = profile.password;
        if (!syncedPassword.startsWith("$2a$") && !syncedPassword.startsWith("$2b$") && !syncedPassword.startsWith("$2y$")) {
          syncedPassword = hashPassword(syncedPassword);
        }
        safeData.password = syncedPassword;
      }
      let baseError = null;
      if (existsInDb) {
        const { error } = await supabaseAdmin2.from("profiles").update(safeData).eq("email", email);
        baseError = error;
      } else {
        safeData.email = email;
        safeData.created_at = profile.registrationDate || profile.registration_date || (/* @__PURE__ */ new Date()).toISOString();
        if (!safeData.password) {
          const memPass = serverProfiles[email]?.password;
          if (memPass) safeData.password = memPass;
        }
        const { error } = await supabaseAdmin2.from("profiles").insert(safeData);
        baseError = error;
      }
      if (baseError) {
        console.warn("Standard profile columns sync error (continuing with local cache):", baseError.message);
      } else {
        const extraData = {};
        if (profile.phone) extraData.phone = profile.phone;
        if (profile.firstName) extraData.first_name = profile.firstName;
        if (profile.lastName) extraData.last_name = profile.lastName;
        if (syncedPassword) extraData.password = syncedPassword;
        if (typeof profile.boundDeviceId !== "undefined") {
          extraData.bound_device_id = profile.boundDeviceId;
        }
        if (typeof profile.transferRequested !== "undefined") {
          extraData.transfer_requested = !!profile.transferRequested;
        }
        if (Object.keys(extraData).length > 0) {
          try {
            const { error: extraError } = await supabaseAdmin2.from("profiles").update(extraData).eq("email", email);
            if (extraError) {
              console.info("\u{1F4A1} Note: Schema lacks some custom columns (first_name, last_name, phone, password, bound_device_id, or transfer_requested) in Supabase. Profiles are dynamically fully preserved with all attributes in the high-performance local database cache.");
            }
          } catch (extraErr) {
          }
        }
      }
    } catch (err) {
      console.error("Supabase profile sync error, falling back:", err.message);
      isPremiumStatus = serverProfiles[email] ? !!serverProfiles[email].isPremium || !!serverProfiles[email].is_premium : false;
    }
  } else {
    isPremiumStatus = serverProfiles[email] ? !!serverProfiles[email].isPremium || !!serverProfiles[email].is_premium : false;
  }
  const existingPassword = serverProfiles[email]?.password;
  serverProfiles[email] = {
    ...serverProfiles[email],
    ...profile,
    phone: profile.phone || serverProfiles[email]?.phone || "",
    firstName: profile.firstName || serverProfiles[email]?.firstName || "",
    lastName: profile.lastName || serverProfiles[email]?.lastName || "",
    isPremium: isPremiumStatus,
    registered: true
  };
  if (existingPassword && (!profile.password || profile.password === "")) {
    serverProfiles[email].password = existingPassword;
  }
  if (profile.password) {
    let finalPassword = profile.password;
    if (!finalPassword.startsWith("$2a$") && !finalPassword.startsWith("$2b$") && !finalPassword.startsWith("$2y$")) {
      finalPassword = hashPassword(finalPassword);
    }
    serverProfiles[email].password = finalPassword;
  }
  saveLocalDB();
  const token = generateToken({ email });
  const safeProfileResponse = { ...serverProfiles[email] };
  delete safeProfileResponse.password;
  res.json({ success: true, profile: safeProfileResponse, token });
});
app.get("/api/profiles", (req, res) => {
  const query = req.query.q ? req.query.q.trim().toLowerCase() : "";
  const list = Object.values(serverProfiles).filter((p) => p && (p.registered || p.email)).map((p) => ({
    email: p.email,
    name: p.name || p.email.split("@")[0],
    level: p.level || "Licence",
    avatar: p.avatar || "\u{1F468}\u200D\u{1F393}",
    isPremium: !!p.isPremium || !!p.is_premium
  }));
  if (query) {
    const filtered = list.filter(
      (p) => p.name.toLowerCase().includes(query) || p.email.toLowerCase().includes(query)
    );
    return res.json(filtered.slice(0, 50));
  }
  return res.json(list.slice(0, 50));
});
app.get("/api/payments", async (req, res) => {
  if (supabaseAdmin2) {
    try {
      const { data, error } = await supabaseAdmin2.from("manual_payments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (data) {
        const list = data.map((tx) => ({
          id: tx.id,
          userEmail: tx.user_email,
          userName: tx.user_name,
          operator: tx.operator,
          phone: tx.phone,
          amount: tx.amount,
          reference: tx.reference,
          date: tx.created_at,
          status: tx.status
        }));
        return res.json(list);
      }
    } catch (err) {
      console.error("Supabase payments fetch error, falling back:", err.message);
    }
  }
  res.json(serverManualPayments);
});
app.post("/api/payments", async (req, res) => {
  const { tx } = req.body;
  if (!tx || !tx.userEmail) {
    return res.status(400).json({ error: "Invalid payment format" });
  }
  const userEmail = tx.userEmail.trim().toLowerCase();
  if (serverBannedEmails.includes(userEmail)) {
    return res.status(403).json({ error: "banned" });
  }
  const newTx = {
    id: tx.id,
    userEmail,
    userName: tx.userName || "Candidat",
    operator: tx.operator || "orange",
    phone: tx.phone,
    amount: tx.amount || 2500,
    reference: tx.reference.toUpperCase(),
    date: tx.date || (/* @__PURE__ */ new Date()).toISOString(),
    status: "pending"
  };
  if (supabaseAdmin2) {
    try {
      const { error } = await supabaseAdmin2.from("manual_payments").insert({
        id: newTx.id,
        user_email: newTx.userEmail,
        user_name: newTx.userName,
        phone: newTx.phone,
        operator: newTx.operator,
        amount: newTx.amount,
        reference: newTx.reference,
        status: newTx.status,
        created_at: newTx.date
      });
      if (error) throw error;
    } catch (err) {
      console.error("Supabase payment creation failed, using memory:", err.message);
    }
  }
  serverManualPayments = [newTx, ...serverManualPayments];
  saveLocalDB();
  sendAdminPaymentMail(newTx).catch((e) => console.error("Error dispatching admin email:", e));
  res.json({ success: true, tx: newTx });
});
app.post("/api/payments/auto-pay", async (req, res) => {
  const { userEmail, userName, plan, amount, operator, phone, otpCode, step } = req.body;
  if (!userEmail || !amount || !phone || !operator) {
    return res.status(400).json({ error: "Champs obligatoires manquants (Email, Montant, T\xE9l\xE9phone, Op\xE9rateur)" });
  }
  const cleanEmail = userEmail.trim().toLowerCase();
  if (serverBannedEmails.includes(cleanEmail)) {
    return res.status(403).json({ error: "Ce compte est banni de la plateforme." });
  }
  const date = (/* @__PURE__ */ new Date()).toISOString();
  const txId = (operator === "orange" ? "OM-" : "MOOV-") + Math.random().toString(36).substr(2, 9).toUpperCase();
  const orangeClientId = process.env.ORANGE_MERCHANT_CLIENT_ID;
  const orangeClientSecret = process.env.ORANGE_MERCHANT_CLIENT_SECRET;
  const orangePartnerId = process.env.ORANGE_MERCHANT_PARTNER_ID;
  const moovApiKey = process.env.MOOV_FLOOZ_MERCHANT_API_KEY;
  if (step === "initiate" || !otpCode) {
    console.info(`[Payment Init] Initiating ${operator} payment for ${cleanEmail}, phone: ${phone}, amount: ${amount}`);
    if (operator === "orange" && orangeClientId && orangeClientSecret) {
      try {
        const tokenResponse = await fetch("https://api.orange.com/oauth/v3/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + Buffer.from(`${orangeClientId}:${orangeClientSecret}`).toString("base64")
          },
          body: "grant_type=client_credentials"
        });
        if (!tokenResponse.ok) {
          return res.status(502).json({ error: "Impossible de s'authentifier aupr\xE8s de la passerelle partenaire d'Orange Money Burkina." });
        }
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const payload = {
          merchant_key: orangePartnerId || "FASO_EDUC",
          currency: "XOF",
          amount: Number(amount),
          id_transaction: txId,
          customer_number: phone.replace(/\D/g, ""),
          country_code: "BF"
        };
        const omResponse = await fetch("https://api.orange.com/orange-money-webpayment/bf/v1/webpayment", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        if (omResponse.ok) {
          const omData = await omResponse.json();
          return res.json({
            success: true,
            otpRequired: true,
            txId: omData.payment_token || txId,
            message: "Demande initi\xE9e. Saisissez le code d'autorisation OTP re\xE7u par SMS ou g\xE9n\xE9r\xE9 via le *144*4*6#."
          });
        } else {
          const errText = await omResponse.text();
          console.error("[OM API Error]", errText);
          return res.status(400).json({ error: "L'op\xE9rateur Orange a refus\xE9 la demande d'initiation. V\xE9rifiez votre solde." });
        }
      } catch (e) {
        console.error("Orange Money direct init failed:", e.message);
        return res.status(500).json({ error: "Erreur r\xE9seau lors de la communication avec la passerelle Orange Money BF." });
      }
    }
    const isProductive = !!(orangeClientId || moovApiKey);
    return res.json({
      success: true,
      otpRequired: true,
      txId,
      message: `Abonnement Elite initialis\xE9 avec succ\xE8s sur Faso-Educ. Veuillez composer le ${operator === "orange" ? "*144*4*6#" : "*156*4*5#"} sur votre t\xE9l\xE9phone mobile pour g\xE9n\xE9rer votre code OTP \xE0 6 chiffres, puis saisissez-le ci-dessous pour valider la transaction.`
    });
  }
  if (step === "confirm" || otpCode) {
    const cleanOtp = otpCode.trim();
    if (!/^\d{4,8}$/.test(cleanOtp)) {
      return res.status(400).json({ error: "Code d'authentification OTP invalide. Il doit s'agir d'un code num\xE9rique de 4 \xE0 8 chiffres." });
    }
    console.info(`[Payment Confirm] Verifying ${operator} transaction for ${cleanEmail}, OTP: ${cleanOtp}, amount: ${amount}`);
    let transactionSucceeded = false;
    let gatewayMessage = "";
    if (operator === "orange" && orangeClientId && orangeClientSecret) {
      try {
        const tokenResponse = await fetch("https://api.orange.com/oauth/v3/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + Buffer.from(`${orangeClientId}:${orangeClientSecret}`).toString("base64")
          },
          body: "grant_type=client_credentials"
        });
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          const confirmResponse = await fetch("https://api.orange.com/orange-money-webpayment/bf/v1/transaction/pay", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              payment_token: txId,
              otp: cleanOtp,
              amount: Number(amount)
            })
          });
          if (confirmResponse.ok) {
            const confirmData = await confirmResponse.json();
            if (confirmData.status === "SUCCESS") {
              transactionSucceeded = true;
              gatewayMessage = "Transaction valid\xE9e et d\xE9bit\xE9e avec succ\xE8s de votre compte Orange Money.";
            } else {
              gatewayMessage = `\xC9chec de la transaction Orange Money : Nom du statut: ${confirmData.status}`;
            }
          } else {
            const errText = await confirmResponse.text();
            console.error("Orange Money transaction verification failed:", errText);
            gatewayMessage = "Code OTP incorrect ou expir\xE9. \xC9chec de la validation Orange Money.";
          }
        }
      } catch (e) {
        console.error("Error in live Orange Money double-handshake check:", e.message);
        gatewayMessage = "Erreur de communication avec le serveur d'authentification d'Orange Burkina.";
      }
    } else if (operator === "moov" && moovApiKey) {
      gatewayMessage = "\xC9chec : L'int\xE9gration Moov Money est en attente de signature de votre contrat marchand.";
    } else {
      transactionSucceeded = false;
      gatewayMessage = "\u26A0\uFE0F Passerelle de validation automatique inactive / en maintenance : Impossible de v\xE9rifier l'OTP car les identifiants marchands d'int\xE9gration r\xE9seau (API Keys) de l'op\xE9rateur ne sont pas encore enti\xE8rement param\xE9tr\xE9s par l'administrateur. Veuillez faire une demande en mode manuel (D\xE9p\xF4t direct) pour activation imm\xE9diate par l'administration.";
    }
    if (!transactionSucceeded) {
      return res.status(400).json({ error: gatewayMessage || "La validation du paiement direct a \xE9chou\xE9. Veuillez v\xE9rifier votre solde ou re-g\xE9n\xE9rer un code OTP." });
    }
    if (serverProfiles[cleanEmail]) {
      serverProfiles[cleanEmail].isPremium = true;
    }
    if (supabaseAdmin2) {
      try {
        await supabaseAdmin2.from("profiles").update({ is_premium: true }).eq("email", cleanEmail);
      } catch (dbErr) {
        console.error("Supabase user premium activation failed:", dbErr.message);
      }
    }
    const newTx = {
      id: txId,
      userEmail: cleanEmail,
      userName: userName || "Candidat Elite",
      operator: operator + "_auto",
      phone,
      amount: Number(amount),
      reference: "AUTO-OM-" + Math.random().toString(36).substr(2, 7).toUpperCase(),
      date,
      status: "approved"
    };
    if (supabaseAdmin2) {
      try {
        await supabaseAdmin2.from("manual_payments").insert({
          id: newTx.id,
          user_email: newTx.userEmail,
          user_name: newTx.userName,
          phone: newTx.phone,
          operator: newTx.operator,
          amount: newTx.amount,
          reference: newTx.reference,
          status: newTx.status,
          created_at: newTx.date
        });
      } catch (saveErr) {
        console.error("Could not register automatic transaction logs to Supabase:", saveErr.message);
      }
    }
    serverManualPayments = [newTx, ...serverManualPayments];
    saveLocalDB();
    return res.json({
      success: true,
      status: "approved",
      tx: newTx,
      message: gatewayMessage || "F\xE9licitations ! Votre forfait Faso-Educ Elite Premium a \xE9t\xE9 activ\xE9 automatiquement avec succ\xE8s."
    });
  }
});
app.post("/api/payments/status", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Acc\xE8s refus\xE9. Autorisation administrateur requise." });
  }
  const { id, status, rejectReason } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  serverManualPayments = serverManualPayments.map((tx) => {
    if (tx.id === id) {
      const updated = { ...tx, status };
      if (status === "approved" && tx.userEmail) {
        const email = tx.userEmail.toLowerCase();
        if (serverProfiles[email]) {
          serverProfiles[email].isPremium = true;
        }
      }
      return updated;
    }
    return tx;
  });
  const txRecord = serverManualPayments.find((tx) => tx.id === id);
  if (supabaseAdmin2 && txRecord) {
    try {
      const { error: txErr } = await supabaseAdmin2.from("manual_payments").update({ status, reject_reason: rejectReason || null }).eq("id", id);
      if (txErr) throw txErr;
      if (status === "approved" && txRecord.userEmail) {
        const { error: profErr } = await supabaseAdmin2.from("profiles").update({ is_premium: true }).eq("email", txRecord.userEmail.toLowerCase());
        if (profErr) {
          console.warn("Could not set profile to premium in Supabase:", profErr.message);
        }
      }
    } catch (err) {
      console.error("Supabase payment status update failed:", err.message);
    }
  }
  res.json({ success: true, id, status });
  saveLocalDB();
});
var activeOnlineUsers = {};
var activeInvitations = {};
var activeRoomStates = {};
setInterval(() => {
  const now = Date.now();
  Object.keys(activeOnlineUsers).forEach((email) => {
    if (now - activeOnlineUsers[email].lastPing > 12e3) {
      delete activeOnlineUsers[email];
    }
  });
  Object.keys(activeRoomStates).forEach((roomCode) => {
    const num = Number(roomCode);
    if (!isNaN(num) && now - activeRoomStates[num].lastUpdated > 36e5) {
      delete activeRoomStates[num];
    }
  });
}, 1e4);
app.post("/api/competition/presence", (req, res) => {
  const { email, name, level, avatar, isPremium } = req.body;
  if (!email) {
    return res.status(400).json({ error: "E-mail requis pour enregistrer la pr\xE9sence." });
  }
  const cleanEmail = email.trim().toLowerCase();
  activeOnlineUsers[cleanEmail] = {
    email: cleanEmail,
    name: name || email.split("@")[0],
    level: level || "Licence",
    avatar: avatar || "\u{1F468}\u200D\u{1F393}",
    isPremium: !!isPremium,
    lastPing: Date.now()
  };
  const now = Date.now();
  const onlineList = Object.values(activeOnlineUsers).filter((u) => u.email !== cleanEmail && now - u.lastPing <= 12e3);
  const pendingInvites = Object.values(activeInvitations).filter((inv) => inv.inviteeEmail === cleanEmail && inv.status === "pending");
  res.json({
    success: true,
    onlineUsers: onlineList,
    pendingInvitations: pendingInvites
  });
});
app.post("/api/competition/invite", (req, res) => {
  const { hostEmail, hostName, inviteeEmail, roomNumber, subject, level, questionCount, timeLimit } = req.body;
  if (!hostEmail || !inviteeEmail || !roomNumber) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }
  const cleanHost = hostEmail.trim().toLowerCase();
  const cleanInvitee = inviteeEmail.trim().toLowerCase();
  const inviteId = `inv-${cleanHost}-to-${cleanInvitee}-${Date.now()}`;
  Object.keys(activeInvitations).forEach((id) => {
    const inv = activeInvitations[id];
    if (inv.hostEmail === cleanHost && inv.inviteeEmail === cleanInvitee && inv.status === "pending") {
      inv.status = "rejected";
    }
  });
  const newInvite = {
    id: inviteId,
    hostEmail: cleanHost,
    hostName: hostName || cleanHost.split("@")[0],
    inviteeEmail: cleanInvitee,
    roomNumber: Number(roomNumber),
    subject: subject || "Micro\xE9conomie",
    level: level || "Licence",
    questionCount: Number(questionCount) || 8,
    timeLimit: Number(timeLimit) || 45,
    status: "pending"
  };
  activeInvitations[inviteId] = newInvite;
  activeRoomStates[Number(roomNumber)] = {
    roomNumber: Number(roomNumber),
    hostEmail: cleanHost,
    hostName: hostName || cleanHost.split("@")[0],
    inviteeEmail: cleanInvitee,
    inviteeName: cleanInvitee.split("@")[0],
    questions: [],
    status: "lobby",
    currentQuestionIndex: 0,
    answers: {
      [cleanHost]: {},
      [cleanInvitee]: {}
    },
    lastUpdated: Date.now()
  };
  res.json({
    success: true,
    invitationId: inviteId,
    roomNumber
  });
});
app.post("/api/competition/accept", (req, res) => {
  const { invitationId, inviteeName } = req.body;
  if (!invitationId) {
    return res.status(400).json({ error: "ID d'invitation manquant." });
  }
  const invite = activeInvitations[invitationId];
  if (!invite) {
    return res.status(404).json({ error: "L'invitation a expir\xE9." });
  }
  invite.status = "accepted";
  const room = activeRoomStates[invite.roomNumber];
  if (room) {
    room.inviteeName = inviteeName || invite.inviteeEmail.split("@")[0];
    room.lastUpdated = Date.now();
  }
  res.json({ success: true, roomNumber: invite.roomNumber });
});
app.post("/api/competition/reject", (req, res) => {
  const { invitationId } = req.body;
  if (!invitationId) {
    return res.status(400).json({ error: "ID d'invitation manquant." });
  }
  const invite = activeInvitations[invitationId];
  if (invite) {
    invite.status = "rejected";
  }
  res.json({ success: true });
});
app.get("/api/competition/room/status/:roomNumber", (req, res) => {
  const roomNum = Number(req.params.roomNumber);
  const room = activeRoomStates[roomNum];
  if (!room) {
    return res.status(404).json({ error: "Chambre introuvable." });
  }
  const invitation = Object.values(activeInvitations).find((inv) => inv.roomNumber === roomNum);
  const now = Date.now();
  const hostOnline = !!activeOnlineUsers[room.hostEmail] && now - activeOnlineUsers[room.hostEmail].lastPing <= 15e3;
  const inviteeOnline = !!activeOnlineUsers[room.inviteeEmail] && now - activeOnlineUsers[room.inviteeEmail].lastPing <= 15e3;
  res.json({
    success: true,
    roomState: room,
    invitation,
    hostOnline,
    inviteeOnline,
    serverTime: Date.now()
  });
});
app.post("/api/competition/room/start", (req, res) => {
  const { roomNumber, questions } = req.body;
  const room = activeRoomStates[Number(roomNumber)];
  if (!room) {
    return res.status(404).json({ error: "Salon introuvable." });
  }
  room.questions = questions;
  room.status = "active";
  room.generating = false;
  room.currentQuestionIndex = 0;
  room.questionStartedAt = Date.now();
  room.answers = {
    [room.hostEmail]: {},
    [room.inviteeEmail]: {}
  };
  room.lastUpdated = Date.now();
  res.json({ success: true, roomState: room });
});
app.post("/api/competition/room/generating", (req, res) => {
  const { roomNumber, generating } = req.body;
  const room = activeRoomStates[Number(roomNumber)];
  if (!room) {
    return res.status(404).json({ error: "Salon introuvable." });
  }
  room.generating = !!generating;
  room.lastUpdated = Date.now();
  res.json({ success: true, roomState: room });
});
app.post("/api/competition/room/answer", (req, res) => {
  const { roomNumber, email, questionIndex, optionIdx, isCorrect, timeTaken, scoreAdded } = req.body;
  const room = activeRoomStates[Number(roomNumber)];
  if (!room) {
    return res.status(404).json({ error: "Salon introuvable." });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!room.answers[cleanEmail]) {
    room.answers[cleanEmail] = {};
  }
  room.answers[cleanEmail][Number(questionIndex)] = {
    optionIdx: Number(optionIdx),
    isCorrect: !!isCorrect,
    timeTaken: Number(timeTaken),
    scoreAdded: Number(scoreAdded) || 0
  };
  room.lastUpdated = Date.now();
  res.json({ success: true, answersSnapshot: room.answers });
});
app.post("/api/competition/room/next", (req, res) => {
  const { roomNumber, nextIndex } = req.body;
  const room = activeRoomStates[Number(roomNumber)];
  if (!room) {
    return res.status(404).json({ error: "Salon introuvable." });
  }
  if (typeof nextIndex === "number") {
    room.currentQuestionIndex = nextIndex;
    room.questionStartedAt = Date.now();
    if (room.questions.length > 0 && nextIndex >= room.questions.length) {
      room.status = "podium";
    }
  }
  room.lastUpdated = Date.now();
  res.json({ success: true, roomState: room });
});
app.get("/api/users/banned", async (req, res) => {
  if (supabaseAdmin2) {
    try {
      const { data, error } = await supabaseAdmin2.from("profiles").select("email").eq("is_banned", true);
      if (error) throw error;
      if (data) {
        const emails = data.map((d) => d.email.toLowerCase());
        serverBannedEmails = Array.from(/* @__PURE__ */ new Set([...serverBannedEmails, ...emails]));
      }
    } catch (err) {
      console.error("Supabase query for banned users failed:", err.message);
    }
  }
  res.json({ bannedEmails: serverBannedEmails });
});
app.post("/api/users/ban", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Acc\xE8s refus\xE9. Autorisation administrateur requise." });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  const cleanEmail = email.trim().toLowerCase();
  if (!serverBannedEmails.includes(cleanEmail)) {
    serverBannedEmails.push(cleanEmail);
  }
  if (supabaseAdmin2) {
    try {
      const { error } = await supabaseAdmin2.from("profiles").update({ is_banned: true }).eq("email", cleanEmail);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase user ban update failed:", err.message);
    }
  }
  res.json({ success: true, email: cleanEmail });
  saveLocalDB();
});
app.post("/api/users/unban", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Acc\xE8s refus\xE9. Autorisation administrateur requise." });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  const cleanEmail = email.trim().toLowerCase();
  serverBannedEmails = serverBannedEmails.filter((e) => e !== cleanEmail);
  if (supabaseAdmin2) {
    try {
      const { error } = await supabaseAdmin2.from("profiles").update({ is_banned: false }).eq("email", cleanEmail);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase user unban update failed:", err.message);
    }
  }
  res.json({ success: true, email: cleanEmail });
  saveLocalDB();
});
app.get("/api/admin/users", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Acc\xE8s refus\xE9. Autorisation administrateur requise." });
  }
  let profilesList = {};
  Object.keys(serverProfiles).forEach((email) => {
    const p = serverProfiles[email];
    profilesList[email.toLowerCase()] = {
      email: p.email || email,
      name: p.name || email.split("@")[0],
      firstName: p.firstName || p.first_name || "",
      lastName: p.lastName || p.last_name || "",
      phone: p.phone || "",
      level: p.level || "Licence",
      targetExam: p.targetExam || p.target_exam || "Non sp\xE9cifi\xE9",
      regionName: p.regionName || p.region_name || "Centre (Ouagadougou)",
      avatar: p.avatar || "\u{1F468}\u200D\u{1F393}",
      isPremium: !!p.isPremium || !!p.is_premium,
      points: p.points || 0,
      learningStreak: p.learningStreak || p.learning_streak || 0,
      password: p.password || "",
      registered: true,
      boundDeviceId: p.boundDeviceId || null,
      transferRequested: !!p.transferRequested || false,
      registrationDate: p.registrationDate || p.created_at || (/* @__PURE__ */ new Date()).toISOString()
    };
  });
  if (supabaseAdmin2) {
    try {
      const { data, error } = await supabaseAdmin2.from("profiles").select("*");
      if (!error && data) {
        data.forEach((row) => {
          const email = row.email.toLowerCase();
          profilesList[email] = {
            email: row.email,
            name: row.name || email.split("@")[0],
            firstName: row.first_name || row.firstName || "",
            lastName: row.last_name || row.lastName || "",
            phone: row.phone || row.phone_number || "",
            level: row.level || "Licence",
            targetExam: row.target_exam || "Non sp\xE9cifi\xE9",
            regionName: row.region_name || "Centre (Ouagadougou)",
            avatar: row.avatar || "\u{1F468}\u200D\u{1F393}",
            isPremium: !!row.is_premium,
            points: row.points || 0,
            learningStreak: row.learning_streak || 0,
            password: row.password || "",
            registered: true,
            boundDeviceId: row.bound_device_id || row.boundDeviceId || null,
            transferRequested: !!row.transfer_requested || false,
            registrationDate: row.created_at || row.registrationDate || (/* @__PURE__ */ new Date()).toISOString()
          };
        });
      }
    } catch (dbErr) {
      console.error("Failed to query full profiles from Supabase for admin:", dbErr.message);
    }
  }
  Object.keys(serverProfiles).forEach((email) => {
    const cleanEmail = email.toLowerCase();
    if (profilesList[cleanEmail]) {
      if (serverProfiles[email].boundDeviceId) {
        profilesList[cleanEmail].boundDeviceId = serverProfiles[email].boundDeviceId;
      }
      if (serverProfiles[email].transferRequested) {
        profilesList[cleanEmail].transferRequested = serverProfiles[email].transferRequested;
      }
      if (serverProfiles[email].firstName) {
        profilesList[cleanEmail].firstName = serverProfiles[email].firstName;
      }
      if (serverProfiles[email].lastName) {
        profilesList[cleanEmail].lastName = serverProfiles[email].lastName;
      }
      if (serverProfiles[email].phone) {
        profilesList[cleanEmail].phone = serverProfiles[email].phone;
      }
    }
  });
  res.json({
    success: true,
    profiles: Object.values(profilesList),
    payments: serverManualPayments,
    bannedEmails: serverBannedEmails
  });
});
app.get("/api/admin/db-diagnostic", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Acc\xE8s refus\xE9. Autorisation administrateur requise." });
  }
  const diagnosisList = {};
  const isSupabaseConfigured = !!supabaseAdmin2;
  const tablesToCheck = [
    { name: "profiles", columns: "email, name, level, is_premium" },
    { name: "manual_payments", columns: "id, user_email, amount, reference, status" },
    { name: "favorited_questions", columns: "id, user_email" },
    { name: "courses", columns: "id, title, is_public" },
    { name: "quiz_results", columns: "id, user_email, score, percentage" }
  ];
  if (isSupabaseConfigured) {
    for (const tbl of tablesToCheck) {
      try {
        const { data, error } = await supabaseAdmin2.from(tbl.name).select(tbl.columns).limit(1);
        if (error) {
          diagnosisList[tbl.name] = {
            active: false,
            status: "Inaccessible / Colonnes manquantes",
            error: error.message,
            hint: error.hint || `Veuillez ex\xE9cuter le script SQL de DATABASE_SETUP.md pour recr\xE9er ou modifier la table public.${tbl.name}.`
          };
        } else {
          const { count, error: countErr } = await supabaseAdmin2.from(tbl.name).select("*", { count: "exact", head: true });
          diagnosisList[tbl.name] = {
            active: true,
            status: "Parfaitement Fonctionnelle \u2705",
            count: countErr ? data ? data.length : 0 : count || 0,
            error: null
          };
        }
      } catch (err) {
        diagnosisList[tbl.name] = {
          active: false,
          status: "Erreur de connexion",
          error: err.message,
          hint: "Connexion rejet\xE9e ou impossible avec Supabase."
        };
      }
    }
  }
  res.json({
    success: true,
    connected: isSupabaseConfigured,
    supabaseUrl: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 15)}...` : "Ind\xE9finie \u274C",
    database: diagnosisList
  });
});
app.post("/api/admin/reset-device", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Acc\xE8s refus\xE9. Autorisation administrateur requise." });
  }
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Adresse email requise." });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (serverProfiles[cleanEmail]) {
    serverProfiles[cleanEmail].boundDeviceId = null;
    serverProfiles[cleanEmail].transferRequested = false;
  }
  if (supabaseAdmin2) {
    try {
      await supabaseAdmin2.from("profiles").update({ bound_device_id: null, transfer_requested: false }).eq("email", cleanEmail);
    } catch (err) {
      console.error("Failed to reset bound device in Supabase admin action:", err.message);
    }
  }
  saveLocalDB();
  res.json({ success: true, message: "Liaison de l'appareil mobile r\xE9initialis\xE9e avec succ\xE8s ! L'ancien t\xE9l\xE9phone a \xE9t\xE9 d\xE9tach\xE9 et r\xE9initialis\xE9." });
});
app.post("/api/admin/decline-transfer", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Acc\xE8s refus\xE9. Autorisation administrateur requise." });
  }
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Adresse email requise." });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (serverProfiles[cleanEmail]) {
    serverProfiles[cleanEmail].transferRequested = false;
  }
  if (supabaseAdmin2) {
    try {
      await supabaseAdmin2.from("profiles").update({ transfer_requested: false }).eq("email", cleanEmail);
    } catch (err) {
      console.error("Failed to decline transfer request in Supabase:", err.message);
    }
  }
  saveLocalDB();
  res.json({ success: true, message: "Demande de transfert d'appareil d\xE9clin\xE9e avec succ\xE8s !" });
});
app.post("/api/admin/promote", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Acc\xE8s refus\xE9. Autorisation administrateur requise." });
  }
  const { email, isPremium } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Adresse email requise." });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (serverProfiles[cleanEmail]) {
    serverProfiles[cleanEmail].isPremium = !!isPremium;
  } else {
    serverProfiles[cleanEmail] = {
      email: cleanEmail,
      name: cleanEmail.split("@")[0],
      isPremium: !!isPremium,
      registered: true,
      registrationDate: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  if (supabaseAdmin2) {
    try {
      const { error } = await supabaseAdmin2.from("profiles").update({ is_premium: !!isPremium }).eq("email", cleanEmail);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase user manual promotion update failed:", err.message);
    }
  }
  res.json({ success: true, email: cleanEmail, isPremium: !!isPremium });
  saveLocalDB();
});
app.post("/api/auth/token-sync", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Missing token" });
  const payload = verifyToken(token);
  if (!payload || !payload.email) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const email = payload.email.trim().toLowerCase();
  if (serverBannedEmails.includes(email)) {
    return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration" });
  }
  let foundProfile = null;
  if (supabaseAdmin2) {
    try {
      const { data, error } = await supabaseAdmin2.from("profiles").select("*").eq("email", email).maybeSingle();
      if (data) {
        if (data.is_banned) {
          if (!serverBannedEmails.includes(email)) {
            serverBannedEmails.push(email);
          }
          return res.status(403).json({ error: "banned", message: "Ce compte est suspendu" });
        }
        foundProfile = {
          email: data.email,
          name: data.name,
          level: data.level,
          targetExam: data.target_exam,
          regionName: data.region_name,
          avatar: data.avatar,
          isPremium: data.is_premium,
          points: data.points,
          learningStreak: data.learning_streak,
          registered: true,
          password: data.password || "",
          phone: data.phone || "",
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          boundDeviceId: data.bound_device_id || null,
          transferRequested: !!data.transfer_requested,
          registrationDate: data.registration_date || data.created_at || null
        };
      }
    } catch (e) {
      console.error("Supabase check in token-sync:", e);
    }
  }
  if (!foundProfile && serverProfiles[email]) {
    foundProfile = serverProfiles[email];
  }
  if (!foundProfile) {
    return res.json({ registered: false, email });
  }
  const adminEmail = (process.env.ADMIN_EMAIL || "ibrahimsawadogo36@gmail.com").trim().toLowerCase();
  const isAdmin = email === adminEmail || email === "ibrahimsawadogo36@gmail.com";
  if (isAdmin && foundProfile) {
    foundProfile.isPremium = true;
    foundProfile.is_premium = true;
    if (serverProfiles[email]) {
      serverProfiles[email].isPremium = true;
      serverProfiles[email].is_premium = true;
    }
  }
  const safeProfile = { ...foundProfile };
  delete safeProfile.password;
  return res.json({ registered: true, profile: safeProfile, token });
});
app.get("/api/supabase-config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
  });
});
app.get("/api/payment-credentials", (req, res) => {
  res.json({
    orange: {
      num: process.env.PAYMENT_NUM_ORANGE || "+226 56 85 32 47",
      name: process.env.PAYMENT_NAME_ORANGE || process.env.ADMIN_NAME || "Sawadogo IBRAHIM"
    },
    moov: {
      num: process.env.PAYMENT_NUM_MOOV || "+226 56 85 32 47",
      name: process.env.PAYMENT_NAME_MOOV || process.env.ADMIN_NAME || "Sawadogo IBRAHIM"
    },
    wave: {
      num: process.env.PAYMENT_NUM_WAVE || "+226 56 85 32 47",
      name: process.env.PAYMENT_NAME_WAVE || process.env.ADMIN_NAME || "Sawadogo IBRAHIM"
    }
  });
});
app.post("/api/admin/login", (req, res) => {
  const { email, passcode } = req.body;
  if (!email || !passcode) {
    return res.status(400).json({ error: "Email et cl\xE9 secr\xE8te r\xE9seau requis." });
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanPasscode = passcode.trim();
  const correctAdminEmail = (process.env.ADMIN_EMAIL || "ibrahimsawadogo36@gmail.com").trim().toLowerCase();
  const correctAdminPasscode = (process.env.ADMIN_PASSCODE || "IBRAHIM_FASO_2026").trim();
  if (cleanEmail === correctAdminEmail && cleanPasscode === correctAdminPasscode) {
    const adminToken = generateToken({ email: correctAdminEmail, role: "admin" });
    return res.json({ success: true, token: adminToken });
  }
  return res.status(401).json({ error: "Identifiant administrateur ou cl\xE9 secr\xE8te invalide. Acc\xE8s refus\xE9." });
});
app.use("/api/auth", auth_routes_default);
app.get("/api/courses", async (req, res) => {
  const userEmail = req.query.email ? req.query.email.trim().toLowerCase() : "";
  if (userEmail) {
    const checkResult = await checkFreeTrialAndLimits(userEmail, "course", 1);
    if (!checkResult.allowed && checkResult.reason === "trial_expired") {
      return res.status(403).json({ error: checkResult.reason, message: checkResult.message });
    }
  }
  if (supabaseAdmin2) {
    try {
      const { data, error } = await supabaseAdmin2.from("courses").select("*");
      if (error) throw error;
      if (data) {
        const formatted = data.map((c) => ({
          id: c.id,
          title: c.title,
          category: c.category,
          description: c.description,
          chapters: typeof c.chapters === "string" ? JSON.parse(c.chapters) : c.chapters,
          level: c.level,
          userEmail: c.user_email,
          isPublic: c.is_public === true || c.is_public === "true"
        }));
        const filtered = formatted.filter((c) => c.isPublic === true || userEmail && c.userEmail === userEmail);
        return res.json(filtered);
      }
    } catch (err) {
      console.warn("Supabase courses fetch error, falling back to memory:", err.message);
    }
  }
  const filteredMemory = serverCourses.filter((c) => c.isPublic === true || userEmail && c.userEmail === userEmail);
  res.json(filteredMemory);
});
app.post("/api/courses", async (req, res) => {
  const { course } = req.body;
  if (!course || !course.id) {
    return res.status(400).json({ error: "Missing course details" });
  }
  const userEmail = course.userEmail ? course.userEmail.trim().toLowerCase() : "";
  if (userEmail) {
    const checkResult = await checkFreeTrialAndLimits(userEmail, "course", 1);
    if (!checkResult.allowed && checkResult.reason === "trial_expired") {
      return res.status(403).json({ error: checkResult.reason, message: checkResult.message });
    }
  }
  const cleanCourse = {
    id: course.id,
    userEmail,
    title: course.title,
    category: course.category,
    description: course.description,
    chapters: course.chapters,
    level: course.level,
    isPublic: course.isPublic !== void 0 ? !!course.isPublic : false
  };
  if (supabaseAdmin2) {
    try {
      const { error } = await supabaseAdmin2.from("courses").upsert({
        id: cleanCourse.id,
        user_email: cleanCourse.userEmail,
        title: cleanCourse.title,
        category: cleanCourse.category,
        description: cleanCourse.description,
        chapters: JSON.stringify(cleanCourse.chapters),
        level: cleanCourse.level,
        is_public: cleanCourse.isPublic
      }, { onConflict: "id" });
      if (error) {
        console.warn("Warning: Supabase table 'courses' not found. Storing in Server Cache fallback.");
      }
    } catch (err) {
      console.error("Supabase courses upsert error, saved to cache:", err.message);
    }
  }
  serverCourses = serverCourses.filter((c) => c.id !== cleanCourse.id);
  serverCourses.push(cleanCourse);
  saveLocalDB();
  res.json({ success: true, course: cleanCourse });
});
app.get("/api/history", async (req, res) => {
  const userEmail = req.query.email ? req.query.email.trim().toLowerCase() : "";
  if (!userEmail) {
    return res.status(400).json({ error: "Missing email parameter" });
  }
  if (supabaseAdmin2) {
    try {
      const { data, error } = await supabaseAdmin2.from("quiz_results").select("*").eq("user_email", userEmail).order("created_at", { ascending: false });
      if (error) throw error;
      if (data) {
        const list = data.map((h) => ({
          id: h.id,
          userEmail: h.user_email,
          authorName: h.author_name || h.authorName || "Candidat \xC9lite",
          subjects: h.subjects,
          level: h.level,
          score: h.score,
          totalQuestions: h.total_questions,
          percentage: h.percentage,
          questions: typeof h.questions === "string" ? JSON.parse(h.questions) : h.questions,
          mode: h.mode,
          date: h.created_at,
          isPublic: !!h.is_public || !!h.isPublic || false
        }));
        return res.json(list);
      }
    } catch (e) {
      console.warn("Supabase quiz results fetch error, falling back to cache:", e.message);
    }
  }
  const filtered = serverQuizResults.filter((q) => q.userEmail === userEmail);
  res.json(filtered);
});
app.get("/api/public-quizzes", (req, res) => {
  const list = serverQuizResults.filter((q) => q.isPublic);
  res.json(list);
});
app.post("/api/history", async (req, res) => {
  const { result } = req.body;
  if (!result || !result.id || !result.userEmail) {
    return res.status(400).json({ error: "Invalid quiz result data" });
  }
  const userEmail = result.userEmail.trim().toLowerCase();
  const cleanResult = {
    id: result.id,
    userEmail,
    authorName: result.authorName || "Candidat \xC9lite",
    subjects: result.subjects || [],
    level: result.level || "Licence",
    score: result.score || 0,
    totalQuestions: result.totalQuestions || 0,
    percentage: result.percentage || 0,
    questions: result.questions || [],
    mode: result.mode || "Entra\xEEnement",
    date: result.date || (/* @__PURE__ */ new Date()).toISOString(),
    isPublic: result.isPublic !== void 0 ? !!result.isPublic : false
  };
  if (supabaseAdmin2) {
    try {
      let pgCreatedAt = cleanResult.date;
      if (pgCreatedAt) {
        const dateStr = String(pgCreatedAt).trim();
        if (dateStr.includes("/") && !dateStr.includes("-")) {
          try {
            const parts = dateStr.split(" ");
            const dateParts = parts[0].split("/");
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[0], 10);
              const month = parseInt(dateParts[1], 10) - 1;
              const year = parseInt(dateParts[2], 10);
              let hh = 12, mm = 0, ss = 0;
              if (parts[1]) {
                const timeParts = parts[1].split(":");
                if (timeParts.length >= 2) {
                  hh = parseInt(timeParts[0], 10) || 12;
                  mm = parseInt(timeParts[1], 10) || 0;
                  ss = parseInt(timeParts[2], 10) || 0;
                }
              }
              const d = new Date(year, month, day, hh, mm, ss);
              if (!isNaN(d.getTime())) {
                pgCreatedAt = d.toISOString();
              }
            }
          } catch (e) {
          }
        } else {
          try {
            const d = new Date(pgCreatedAt);
            if (!isNaN(d.getTime())) {
              pgCreatedAt = d.toISOString();
            }
          } catch (e) {
          }
        }
      } else {
        pgCreatedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
      const upsertData = {
        id: cleanResult.id,
        user_email: cleanResult.userEmail,
        author_name: cleanResult.authorName,
        is_public: cleanResult.isPublic,
        subjects: cleanResult.subjects,
        level: cleanResult.level,
        score: cleanResult.score,
        total_questions: cleanResult.totalQuestions,
        percentage: cleanResult.percentage,
        questions: JSON.stringify(cleanResult.questions),
        mode: cleanResult.mode,
        created_at: pgCreatedAt
      };
      let { error } = await supabaseAdmin2.from("quiz_results").upsert(upsertData, { onConflict: "id" });
      if (error && error.message && (error.message.includes("author_name") || error.message.includes("is_public") || error.message.includes("column"))) {
        console.warn("\u26A0\uFE0F Fallback: Supabase 'quiz_results' table does not have 'author_name' or 'is_public' columns. Syncing without them.");
        const { author_name, is_public, ...fallbackData } = upsertData;
        const resFallback = await supabaseAdmin2.from("quiz_results").upsert(fallbackData, { onConflict: "id" });
        error = resFallback.error;
      }
      if (error) {
        console.warn("\u26A0\uFE0F Warning: Supabase table 'quiz_results' sync failed:", error.message, "| Details:", error.details, "| Hint:", error.hint);
        console.info("\u{1F4A1} Note: You can run the database setup script in DATABASE_SETUP.md in your Supabase SQL Editor to make sure all tables are created.");
      }
    } catch (err) {
      console.error("Supabase quiz result upsert error, saved to local cache:", err.message);
    }
  }
  serverQuizResults = serverQuizResults.filter((q) => q.id !== cleanResult.id);
  serverQuizResults.push(cleanResult);
  saveLocalDB();
  res.json({ success: true, result: cleanResult });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express2.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
