import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const VERSION_FILE_PATH = path.join(process.cwd(), "latest_version.json");

interface UpdateInfo {
  version: string;
  downloadUrl: string;
  changelog?: string;
  forceUpdate?: boolean;
  publishedAt: string;
}

// Helper to read current update info safely
function getLatestUpdateInfo(): UpdateInfo {
  const defaultInfo: UpdateInfo = {
    version: "1.0.0",
    downloadUrl: "https://github.com/ibrahimsawadogo36/Faso-Educ/actions",
    changelog: "Version initiale de Faso-Educ",
    forceUpdate: false,
    publishedAt: new Date().toISOString()
  };

  try {
    if (fs.existsSync(VERSION_FILE_PATH)) {
      const rawData = fs.readFileSync(VERSION_FILE_PATH, "utf8");
      return JSON.parse(rawData);
    }
  } catch (error) {
    console.error("⚠️ Failed to read latest_version.json, using default:", error);
  }
  return defaultInfo;
}

// Helper to save update info
function saveUpdateInfo(info: UpdateInfo): boolean {
  try {
    fs.writeFileSync(VERSION_FILE_PATH, JSON.stringify(info, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("❌ Failed to write latest_version.json:", error);
    return false;
  }
}

/**
 * GET /api/version/latest
 * Serves the latest available version details to the mobile application
 */
router.get("/latest", (req: Request, res: Response) => {
  const updateInfo = getLatestUpdateInfo();
  res.json(updateInfo);
});

/**
 * POST /api/version/latest
 * Webhook called by GitHub Actions after a successful compilation to register a new build
 */
router.post("/latest", (req: Request, res: Response) => {
  const { version, downloadUrl, changelog, forceUpdate, secret } = req.body;

  // Simple optional token authentication for security
  const webhookSecret = process.env.UPDATE_WEBHOOK_SECRET || "faso_educ_webhook_secret_key_2026";
  if (secret && secret !== webhookSecret) {
    return res.status(403).json({ error: "Non autorisé. Clé secrète de webhook invalide." });
  }

  if (!version) {
    return res.status(400).json({ error: "Le paramètre 'version' est requis." });
  }

  const newUpdate: UpdateInfo = {
    version: String(version).trim(),
    downloadUrl: String(downloadUrl || "https://github.com/ibrahimsawadogo36/Faso-Educ/actions").trim(),
    changelog: String(changelog || "Mises à jour et améliorations de performance.").trim(),
    forceUpdate: !!forceUpdate,
    publishedAt: new Date().toISOString()
  };

  const success = saveUpdateInfo(newUpdate);
  if (success) {
    console.log(`🚀 [Auto-Update] Successfully registered new version via Webhook: ${newUpdate.version}`);
    return res.json({ message: "Version enregistrée avec succès !", data: newUpdate });
  } else {
    return res.status(500).json({ error: "Échec de l'enregistrement de la version sur le serveur." });
  }
});

export default router;
