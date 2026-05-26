import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";
import nodemailer from "nodemailer";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable highly permissive native CORS support for cross-origin routing
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Supabase Client if env is loaded
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
// Prioritize service role key which is configured server-side and bypasses RLS policies. Fall back to anon key.
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseAdmin: any = null;
if (supabaseUrl && supabaseSecretKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);
    if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY) {
      console.info("⚡ Supabase Admin integrated successfully with Service Role Key (RLS bypassed)!");
    } else {
      console.info("⚡ Supabase Admin integrated successfully (using Anonymous key fallback)!");
    }
  } catch (error) {
    console.error("❌ Failed to initialize Supabase on backend:", error);
  }
}

// Full-Stack High-Performance in-memory database fallback to avoid crashes
let serverManualPayments: any[] = [];
let serverBannedEmails: string[] = ["fraud_spammer@test.bf"];
let serverProfiles: Record<string, any> = {};
let serverCourses: any[] = [];
let serverQuizResults: any[] = [];

const LOCAL_DB_PATH = path.join(process.cwd(), "local_db.json");

function loadLocalDB() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, "utf8");
      const db = JSON.parse(data);
      if (db.profiles) serverProfiles = db.profiles;
      if (db.payments) serverManualPayments = db.payments;
      if (db.banned) serverBannedEmails = db.banned;
      if (db.courses) serverCourses = db.courses;
      if (db.results) serverQuizResults = db.results;
      console.info("💾 [Local DB] Loaded successfully with", Object.keys(serverProfiles).length, "profiles!");
    } else {
      saveLocalDB();
    }
  } catch (err: any) {
    console.error("⚠️ Failed to load local database:", err.message);
  }
}

function saveLocalDB() {
  try {
    const db = {
      profiles: serverProfiles,
      payments: serverManualPayments,
      banned: serverBannedEmails,
      courses: serverCourses,
      results: serverQuizResults
    };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (err: any) {
    console.error("⚠️ Failed to save local database:", err.message);
  }
}

// Ensure the local database is loaded immediately
loadLocalDB();

// Helper methods for JWT Session Signatures (JWS)
function generateToken(payload: any): string {
  const secret = process.env.JWT_SECRET || "faso_educ_super_secret_key_2026";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${signature}`;
}

function verifyToken(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;
    const secret = process.env.JWT_SECRET || "faso_educ_super_secret_key_2026";
    const expectedSignature = crypto.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Support advanced administrator authorization validation
function isAdminRequest(req: any): boolean {
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

// Nodemailer SMTP Lazy Transporter initialisation
function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    },
    // Force IPv4 address resolution to prevent Cloud Run sandboxes without IPv6 routing from failing with ENETUNREACH
    family: 4,
    connectionTimeout: 10000, // 10s connection timeout
    socketTimeout: 10000      // 10s socket timeout
  } as any);
}

// Send Email when a candidate declares manual payment
async function sendAdminPaymentMail(tx: any) {
  const adminEmail = process.env.ADMIN_EMAIL || "ibrahimsawadogo36@gmail.com";
  const transporter = getMailTransporter();

  const mailSubject = `🔔 [Paiement Manuel] Déclaration de dépôt de ${tx.userName} à valider`;
  const mailText = `Bonjour Ibrahim,

Un candidat vient de soumettre une preuve de transfert d'argent mobile pour valider son forfait d'accès sur Faso Educ.

Détails de la transaction :
----------------------------------------
🧑‍💻 Candidat : ${tx.userName} (${tx.userEmail})
📱 Opérateur : ${tx.operator.toUpperCase()} Money
📞 Téléphone : ${tx.phone}
💰 Montant : ${tx.amount} FCFA
🔑 Référence unique : ${tx.reference}
📅 Date : ${new Date(tx.date).toLocaleString('fr-FR')}
----------------------------------------

Lien d'administration pour valider : ${process.env.APP_URL || 'https://faso-educ.onrender.com'} (Ouvrez le menu Admin "🔑 Administration Réseau")

Cordialement,
Le Système d'Automatisation de Faso-Educ Net`;

  const mailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e1e8ed; border-radius: 12px; background-color: #f8fafc;">
      <h2 style="color: #4f46e5; margin-bottom: 20px;">🔔 [Faso Educ] Nouveau paiement manuel soumis</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        Bonjour Ibrahim Sawadogo,
        <br/><br/>
        Un candidat vient de déclarer un dépôt mobile money. Veuillez comparer ces données avec votre compte pour valider son accès.
      </p>
      
      <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 15px; border-b: 1px solid #f1f5f9; padding-bottom: 8px;">📋 Détails de la transaction</h3>
        <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; width: 35%;">🧑‍💻 Candidat :</td>
            <td style="padding: 6px 0;">${tx.userName} (${tx.userEmail})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">📱 Opérateur :</td>
            <td style="padding: 6px 0;"><span style="text-transform: uppercase; font-weight: bold; color: #ea580c;">${tx.operator}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">📞 Téléphone :</td>
            <td style="padding: 6px 0;"><code>${tx.phone}</code></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">💰 Montant :</td>
            <td style="padding: 6px 0; font-weight: bold; color: #b45309;">${tx.amount} FCFA</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">🔑 Référence unique :</td>
            <td style="padding: 6px 0;"><code style="background-color: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-weight: bold; color: #0f172a;">${tx.reference}</code></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">📅 Date :</td>
            <td style="padding: 6px 0;">${new Date(tx.date).toLocaleString('fr-FR')}</td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 25px;">
        <a href="${process.env.APP_URL || 'https://faso-educ.onrender.com'}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
          Accéder au Portail de Validation
        </a>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">
        Faso-Educ Security & Payment Automation Service • Burkinabè EdTech Initiative
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
      console.info(`📧 Real Email notification sent to admin: ${adminEmail}`);
    } catch (err) {
      console.error("❌ Failed to send physical email via configured Nodemailer transport:", err);
    }
  } else {
    console.warn("⚠️ SMTP Credentials missing or incomplete on Render. Console log simulated email delivery:", {
      to: adminEmail,
      subject: mailSubject,
      txRef: tx.reference
    });
  }
}

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API Routes
app.post("/api/gemini/quiz", async (req, res) => {
  try {
    const { subjects, settings, excludeQuestions } = req.body;
    
    const requestedCount = settings?.questionCount || 10;
    // Cap total limit at 100 questions for extreme safety and reliability
    const totalTarget = Math.min(100, Math.max(1, requestedCount));
    
    const accumulatedQuestions: any[] = [];
    const baseExcludedList = [...(excludeQuestions || [])];
    
    // We generate in batches of max 15 questions to ensure extreme speed, reliability and prevent JSON/token truncations
    const batchSize = 15;
    const totalBatches = Math.ceil(totalTarget / batchSize);
    
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const currentBatchTarget = Math.min(batchSize, totalTarget - accumulatedQuestions.length);
      if (currentBatchTarget <= 0) break;
      
      const currentExcludedList = [
        ...baseExcludedList,
        ...accumulatedQuestions.map(q => q.text)
      ];
      
      const prompt = `Génère un lot de ${currentBatchTarget} questions de quiz de préparation intensive aux CONCOURS PUBLICS (Burkina Faso) sur les sujets suivants : ${subjects.join(", ")}.
      Niveau d'études : ${settings?.level || "Licence"}
      Difficulté : ${settings?.difficulty || "Moyen"}
      Numéro du lot : ${batchIdx + 1}/${totalBatches}
      
      Règles de DIVERSITÉ et de QUALITÉ (CRITIQUE) :
      1. AUCUNE REDONDANCE : Ne pose pas deux fois la même question ou une question trop similaire à celles passées.
      2. COUVERTURE EXHAUSTIVE : Explore tous les aspects du programme (dates, acteurs clés, concepts, géographie, institutions, culture).
      3. STRUCTURE : 4 choix de réponses (1 correcte + 3 distracteurs crédibles).
      4. DIMENSIONS : Équilibre entre Intellectuelle (analyse), Morale (éthique/civisme) et Mémoire (faits précis).
      5. PRIORITÉ GÉOPOLITIQUE : 
         - Focus Majeur : Burkina Faso (Institutions, Histoire, Géographie, Actualités).
         - Focus Secondaire : Afrique, Mali, Russie, Iran, Chine.
         - Autres : Reste du monde.
      6. STYLE : Langage administratif et pédagogique de type concours.
      7. EXACTITUDE FACTUELLE ABSOLUE : Vérifie chaque fait, date et surnom. Par exemple, Banfora est la "Cité du Paysan Noir" (et non Koudougou qui est la "Cité du Cavalier Rouge"). Toute erreur factuelle est inacceptable pour une préparation de concours.
      8. AUTHENTICITÉ ET VÉRACITÉ : Les questions et réponses doivent être rigoureusement authentiques et vérifiables. Pas d'inventions ou d'approximations.
      9. INTÉGRATION DES ÉQUATIONS (VITAL) : Si le sujet concerne les mathématiques, les statistiques, l'économie (microéconomie, macroéconomie), la finance ou la comptabilité, intègre de véritables équations de cours écrites au format LaTeX standard (en ligne avec $...$ ou en bloc avec $$...$$). Exemple: la fonction de Cobb-Douglas $Y = A K^\\alpha L^\\beta$, l'élasticité-prix $e_p = \\frac{d Q}{d P} \\times \\frac{P}{Q}$, la variance $\\sigma^2 = \\frac{1}{N} \\sum (x_i - \\mu)^2$. Les explications doivent détailler la démonstration ou l'utilité des équations.
      
      ${currentExcludedList.length > 0 ? `10. EXCLUSION STRICTE : Ne répète ABSOLUMENT PAS ces questions déjà traitées : [${currentExcludedList.slice(-80).join(" | ")}]. Propose de NOUVELLES questions de quiz uniques et différentes.` : "10. Explore un large éventail de thématiques pour enrichir la base de connaissances."}

      Retourne un tableau JSON d'objets :
      {
        "text": "La question (avec formules LaTeX $...$ ou $$...$$ si applicable)",
        "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
        "correctAnswer": index,
        "explanation": "Explication détaillée pour la préparation au concours, clarifiant les équations si applicables",
        "dimension": "Intellectuelle" | "Morale" | "Mémoire"
      }`;
      
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    minItems: 4,
                    maxItems: 4
                  },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  dimension: { type: Type.STRING, enum: ["Intellectuelle", "Morale", "Mémoire"] }
                },
                required: ["text", "options", "correctAnswer", "explanation", "dimension"]
              }
            }
          }
        });
        
        const parsedQuestions = JSON.parse(response.text || "[]");
        const validQuestions = Array.isArray(parsedQuestions) ? parsedQuestions : [];
        accumulatedQuestions.push(...validQuestions);
        
        // Slightly delay next batch call to respect standard API quotas
        if (batchIdx < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      } catch (err: any) {
        const errMsg = err.message || JSON.stringify(err);
        console.warn(`⚠️ Error during batch ${batchIdx + 1} of Gemini quiz generation:`, errMsg);
        
        // If we already collected some questions, let's gracefully return what we have instead of failing completely!
        if (accumulatedQuestions.length > 0) {
          console.info(`Returning ${accumulatedQuestions.length} partially generated quiz questions due to batch generation notice.`);
          break;
        }
        
        if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429") || errMsg.includes("quota")) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: "⚠️ Quota de requêtes IA (Gemini) temporairement atteint ou saturé. L'API est soumise à des limites strictes sur l'accès gratuit. Veuillez réessayer à nouveau dans une minute."
          });
        }
        throw err;
      }
    }
    
    // Safe fallback if loop finished but no questions generated
    if (accumulatedQuestions.length === 0) {
      throw new Error("Aucune question n'a pu être générée par l'Intelligence Artificielle.");
    }
    
    const formattedQuestions = accumulatedQuestions.map((q: any, i: number) => ({
      ...q,
      id: `q-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    }));
    
    return res.json(formattedQuestions);
  } catch (error: any) {
    console.error("Quiz generation error on server:", error);
    res.status(500).json({ error: error.message || "Failed to generate quiz questions" });
  }
});

app.post("/api/gemini/course", async (req, res) => {
  try {
    const { subject, level } = req.body;
    const prompt = `Génère un cours académique et professionnel extrêmement rigoureux et complet, adapté pour préparer les concours de la fonction publique au Burkina Faso (catégorie A, conseiller économique, impôts, douane, trésor, statistiques).
    Sujet : ${subject}
    Niveau académique attendu : ${level}

    Règles d'or pour la rédaction :
    1. TON PROFESSIONNEL ET ACADÉMIQUE : Écris comme un chercheur ou professeur d'université d'économie ou de sciences quantitatives. Formulations soignées, définitions étayées et développements profonds.
    2. ÉQUATIONS MATHÉMATIQUES (CRITIQUE) : Si le sujet s'y prête (économie, finance, statistiques, mathématiques), incluse obligatoirement de véritables formules détaillées et des équations formulées en LaTeX valide :
       - Utilise $...$ pour les équations ou variables au milieu d'une phrase.
       - Utilise de grands blocs centrés avec $$...$$ pour les équations majeures.
       - Exemple : La maximisation sous contrainte de budget s'écrit comme un lagrangien :
         $$\\mathcal{L}(x, y, \\lambda) = U(x, y) + \\lambda (R - p_x x - p_y y)$$
       - Démontre l'intuition derrière chaque variable.
    3. STRUCTURE : Génère 3 chapitres substantiels. Chaque chapitre doit faire au moins 4-5 paragraphes exhaustifs avec des définitions claires, théories de référence, applications concrètes, équations et limites de la théorie économique ou statistique. Inclure des exemples fictifs appliqués au contexte de l'Afrique de l'Ouest ou du Burkina Faso (UEMOA, CEDEAO).
    
    Retourne UNIQUEMENT un objet JSON conforme à ce schéma :
    {
      "title": "Titre professionnel et complet du cours",
      "category": "Microéconomie" | "Macroéconomie" | "Statistiques" | "Économie du Développement" | "Finance Publique" | "Mathématiques" | "Droit/Administration",
      "description": "Un résumé accrocheur et professionnel du cours",
      "chapters": [
        {
          "title": "Titre du chapitre 1",
          "content": "Contenu ultra-complet du chapitre 1 avec les équations LaTeX $ et $$, paragraphes et théories détaillés"
        },
        ...
      ]
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["title", "content"]
              }
            }
          },
          required: ["title", "category", "description", "chapters"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Course generation error on server:", error);
    res.status(500).json({ error: error.message || "Failed to generate course" });
  }
});

app.post("/api/gemini/forum", async (req, res) => {
  try {
    const { postTitle, postContent } = req.body;
    const prompt = `Vous êtes un Professeur / Expert académique éminent d'Afrique de l'Ouest, spécialisé dans la préparation des candidats aux concours directs de la fonction publique au Burkina Faso (ENAM, Douanes, Trésor, Conseillers Économiques, Impôts, Statistiques).
    Vous répondez à une question d'un candidat sur le forum de révision.

    Titre du sujet : ${postTitle}
    Contenu du message : ${postContent}

    Règles de style et de fond :
    1. TON BIENVEILLANT ET SOPHISTIQUÉ : Encouragez le candidat, écrivez de façon claire, polie et didactique.
    2. MATHS ET FORMULES (VITAL) : Si la question aborde des notions quantitatives, économiques, fiscales ou statistiques, fournissez des explications mathématiques rigoureuses en LaTeX.
       - Utilisez $...$ pour les termes mathématiques en ligne.
       - Utilisez des blocs avec $$...$$ pour les équations majeures.
    3. CONTEXTE NATIONAL : Faites référence aux bonnes lois administratives voltaïques/burkinabè ou aux réalités ouest-africaines (UEMOA, CEDEAO) si pertinent.
    
    Rédigez directement votre réponse d'expert (environ 2 à 4 paragraphes substantiels). Ne renvoyez pas de JSON, juste du texte brut bien formaté ou contenant des équations LaTeX.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    res.json({ text: response.text || "Désolé, je ne parviens pas à formuler une réponse d'expert pour le moment." });
  } catch (error: any) {
    console.error("Forum reply error on server:", error);
    res.status(500).json({ error: error.message || "Failed to generate forum reply" });
  }
});

// 1. Dynamic Supabase// 2. Profile Fetch / Sync Endpoints
app.get("/api/profiles/:email", async (req, res) => {
  const identifier = req.params.email ? req.params.email.trim().toLowerCase() : "";
  const deviceId = req.query.deviceId ? (req.query.deviceId as string).trim() : "";

  if (!identifier) {
    return res.status(400).json({ error: "Missing identifier parameter" });
  }

  let email = identifier;
  let prof: any = null;

  // If looking up by phone, check Supabase first or resolve cached email
  const isEmail = identifier.includes("@");

  if (supabaseAdmin) {
    try {
      let query = supabaseAdmin.from("profiles").select("*");
      if (isEmail) {
        query = query.eq("email", identifier);
      } else {
        query = query.eq("phone", identifier);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      if (data) {
        email = data.email || identifier;
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
          password: data.password || "123456",
          registered: true,
          boundDeviceId: data.bound_device_id || null,
          transferRequested: !!data.transfer_requested
        };
      }
    } catch (err: any) {
      console.error("Supabase profile get error, falling back:", err.message);
    }
  }

  // Fallback or merge with memory using phone matching if not email
  if (!prof) {
    if (isEmail) {
      if (serverProfiles[email]) {
        prof = { ...serverProfiles[email] };
      }
    } else {
      // Find by phone in memory cache
      const foundKey = Object.keys(serverProfiles).find(k => {
        const p = serverProfiles[k];
        return p.phone === identifier || (p.phone && p.phone.replace(/\s+/g, "") === identifier.replace(/\s+/g, ""));
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

  // Block banned emails immediately
  if (serverBannedEmails.includes(email)) {
    return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration." });
  }

  if (prof) {
    // DEVICE BINDING RULE: 1 Compte = 1 Téléphone
    if (deviceId) {
      if (!prof.boundDeviceId) {
        // Link device for first connection
        prof.boundDeviceId = deviceId;
        if (serverProfiles[email]) {
          serverProfiles[email].boundDeviceId = deviceId;
        } else {
          serverProfiles[email] = { ...prof };
        }
        
        if (supabaseAdmin) {
          try {
            await supabaseAdmin
              .from("profiles")
              .update({ bound_device_id: deviceId })
              .eq("email", email);
          } catch (apiErr: any) {
            console.error("Failed to save bound device id to Supabase:", apiErr.message);
          }
        }
        saveLocalDB();
      } else if (prof.boundDeviceId !== deviceId) {
        // Device mismatch
        const alertTime = new Date().toLocaleTimeString("fr-FR");
        const alertDate = new Date().toLocaleDateString("fr-FR");
        return res.status(403).json({
          error: "device_locked",
          message: `ALERTE DE SÉCURITÉ : Ce compte est déjà lié à un autre terminal. Connexion simultanée interdite. Tentative détectée le ${alertDate} à ${alertTime}.`,
          boundDeviceId: prof.boundDeviceId,
          transferRequested: !!prof.transferRequested
        });
      }
    }

    const token = generateToken({ email: prof.email });
    return res.json({ ...prof, token });
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

  if (supabaseAdmin) {
    try {
      await supabaseAdmin
        .from("profiles")
        .update({ transfer_requested: true })
        .eq("email", cleanEmail);
    } catch (err: any) {
      console.error("Failed to save transfer status to Supabase:", err.message);
    }
  }

  saveLocalDB();
  res.json({
    success: true,
    message: "Votre demande d'autorisation de transfert d'appareil mobile a été transmise au panel d'administration. Vous pourrez vous connecter sur cet appareil une fois l'examen du reçu validé."
  });
});

app.post("/api/profiles/sync", async (req, res) => {
  const profile = req.body;
  const email = profile.email ? profile.email.trim().toLowerCase() : "";
  const clientDeviceId = profile.deviceId || profile.boundDeviceId || "";

  if (!email) {
    return res.status(400).json({ error: "Missing email in profile" });
  }

  // Check if banned
  if (serverBannedEmails.includes(email)) {
    return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration" });
  }

  // Determine true isPremium status server-side (preventing standard clients from upgrading themselves via sync)
  let isPremiumStatus = false;

  if (supabaseAdmin) {
    try {
      const { data: dbCheck } = await supabaseAdmin
        .from("profiles")
        .select("is_banned, is_premium")
        .eq("email", email)
        .maybeSingle();

      if (dbCheck) {
        if (dbCheck.is_banned) {
          if (!serverBannedEmails.includes(email)) {
            serverBannedEmails.push(email);
          }
          return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration" });
        }
        isPremiumStatus = !!dbCheck.is_premium;
      } else {
        // Fall back to memory if the user does not exist in the database yet
        isPremiumStatus = serverProfiles[email] ? (!!serverProfiles[email].isPremium || !!serverProfiles[email].is_premium) : false;
      }

      const safeData: any = {
        email: email,
        name: profile.name,
        level: profile.level,
        target_exam: profile.targetExam,
        region_name: profile.regionName,
        avatar: profile.avatar || "👨‍🎓",
        is_premium: isPremiumStatus,
        points: profile.points || 0,
        learning_streak: profile.learningStreak || 0
      };

      // Safely include device binding columns, matching standard database profiles schema
      if (typeof profile.boundDeviceId !== "undefined") {
        safeData.bound_device_id = profile.boundDeviceId;
      }
      if (typeof profile.transferRequested !== "undefined") {
        safeData.transfer_requested = !!profile.transferRequested;
      }

      // Perform standard columns upsert first (guaranteed to succeed on standard schema layout)
      const { error: baseError } = await supabaseAdmin.from("profiles").upsert(safeData, { onConflict: "email" });
      
      if (baseError) {
        console.warn("Standard profile columns upsert error (continuing with local cache):", baseError.message);
      } else {
        // Standard columns saved successfully! Now quietly and gracefully update extra custom/newer attributes
        const extraData: any = {};
        if (profile.phone) extraData.phone = profile.phone;
        if (profile.firstName) extraData.first_name = profile.firstName;
        if (profile.lastName) extraData.last_name = profile.lastName;
        if (profile.password) extraData.password = profile.password;

        if (Object.keys(extraData).length > 0) {
          try {
            // Quietly update extra attributes without triggering database-wide error traces or noisy warning banners
            const { error: extraError } = await supabaseAdmin
              .from("profiles")
              .update(extraData)
              .eq("email", email);
            
            if (extraError) {
              // Handle missing columns with low logger priority
              console.info("💡 Note: Schema lacks some custom columns (first_name, last_name, phone, or password) in Supabase. Profiles are dynamically fully preserved with all attributes in the high-performance local database cache.");
            }
          } catch (extraErr: any) {
            // Quiet catch
          }
        }
      }
    } catch (err: any) {
      console.error("Supabase profile sync error, falling back:", err.message);
      isPremiumStatus = serverProfiles[email] ? (!!serverProfiles[email].isPremium || !!serverProfiles[email].is_premium) : false;
    }
  } else {
    isPremiumStatus = serverProfiles[email] ? (!!serverProfiles[email].isPremium || !!serverProfiles[email].is_premium) : false;
  }

  // Sync to memory including all specified registration fields
  serverProfiles[email] = {
    ...serverProfiles[email],
    ...profile,
    phone: profile.phone || serverProfiles[email]?.phone || "",
    firstName: profile.firstName || serverProfiles[email]?.firstName || "",
    lastName: profile.lastName || serverProfiles[email]?.lastName || "",
    isPremium: isPremiumStatus,
    registered: true
  };
  saveLocalDB();
  const token = generateToken({ email });
  res.json({ success: true, profile: serverProfiles[email], token });
});

app.get("/api/profiles", (req, res) => {
  const query = req.query.q ? (req.query.q as string).trim().toLowerCase() : "";
  const list = Object.values(serverProfiles)
    .filter((p: any) => p && (p.registered || p.email))
    .map((p: any) => ({
      email: p.email,
      name: p.name || p.email.split("@")[0],
      level: p.level || "Licence",
      avatar: p.avatar || "👨‍🎓",
      isPremium: !!p.isPremium || !!p.is_premium
    }));

  if (query) {
    const filtered = list.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.email.toLowerCase().includes(query)
    );
    return res.json(filtered.slice(0, 50)); // Return top 50 matches
  }
  return res.json(list.slice(0, 50));
});

// 3. Manual Payment Transaction Synchronization
app.get("/api/payments", async (req, res) => {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("manual_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) {
        const list = data.map((tx: any) => ({
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
    } catch (err: any) {
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
  // Check if banned
  if (serverBannedEmails.includes(userEmail)) {
    return res.status(403).json({ error: "banned" });
  }

  const newTx = {
    id: tx.id,
    userEmail: userEmail,
    userName: tx.userName || "Candidat",
    operator: tx.operator || "orange",
    phone: tx.phone,
    amount: tx.amount || 2500,
    reference: tx.reference.toUpperCase(),
    date: tx.date || new Date().toISOString(),
    status: "pending"
  };

  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.from("manual_payments").insert({
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
    } catch (err: any) {
      console.error("Supabase payment creation failed, using memory:", err.message);
    }
  }

  serverManualPayments = [newTx, ...serverManualPayments];
  saveLocalDB();
  
  // Trigger non-blocking asynchronous email notification dispatch to administrator
  sendAdminPaymentMail(newTx).catch(e => console.error("Error dispatching admin email:", e));

  res.json({ success: true, tx: newTx });
});

// 3.5. Automated Direct API Payment Integration with Two-Step OTP Verification (Orange / Moov Money)
app.post("/api/payments/auto-pay", async (req, res) => {
  const { userEmail, userName, plan, amount, operator, phone, otpCode, step } = req.body;
  
  if (!userEmail || !amount || !phone || !operator) {
    return res.status(400).json({ error: "Champs obligatoires manquants (Email, Montant, Téléphone, Opérateur)" });
  }

  const cleanEmail = userEmail.trim().toLowerCase();
  
  // Check if banned
  if (serverBannedEmails.includes(cleanEmail)) {
    return res.status(403).json({ error: "Ce compte est banni de la plateforme." });
  }

  const date = new Date().toISOString();
  const txId = (operator === "orange" ? "OM-" : "MOOV-") + Math.random().toString(36).substr(2, 9).toUpperCase();

  // Load Carrier merchant credentials (set server-side in security parameters)
  const orangeClientId = process.env.ORANGE_MERCHANT_CLIENT_ID;
  const orangeClientSecret = process.env.ORANGE_MERCHANT_CLIENT_SECRET;
  const orangePartnerId = process.env.ORANGE_MERCHANT_PARTNER_ID;
  const moovApiKey = process.env.MOOV_FLOOZ_MERCHANT_API_KEY;

  // Step 1: Initiate Transaction / Request OTP
  if (step === "initiate" || !otpCode) {
    console.info(`[Payment Init] Initiating ${operator} payment for ${cleanEmail}, phone: ${phone}, amount: ${amount}`);
    
    // If live credentials are set for Orange Money API
    if (operator === "orange" && orangeClientId && orangeClientSecret) {
      try {
        // Authenticate with Orange Partner API and request dynamic token
        const tokenResponse = await fetch("https://api.orange.com/oauth/v3/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + Buffer.from(`${orangeClientId}:${orangeClientSecret}`).toString("base64")
          },
          body: "grant_type=client_credentials"
        });

        if (!tokenResponse.ok) {
          return res.status(502).json({ error: "Impossible de s'authentifier auprès de la passerelle partenaire d'Orange Money Burkina." });
        }

        const tokenData: any = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Call Orange Money BF Merchant API to initiate payment
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
          const omData: any = await omResponse.json();
          return res.json({
            success: true,
            otpRequired: true,
            txId: omData.payment_token || txId,
            message: "Demande initiée. Saisissez le code d'autorisation OTP reçu par SMS ou généré via le *144*4*6#."
          });
        } else {
          const errText = await omResponse.text();
          console.error("[OM API Error]", errText);
          return res.status(400).json({ error: "L'opérateur Orange a refusé la demande d'initiation. Vérifiez votre solde." });
        }
      } catch (e: any) {
        console.error("Orange Money direct init failed:", e.message);
        return res.status(500).json({ error: "Erreur réseau lors de la communication avec la passerelle Orange Money BF." });
      }
    }

    // Default Sandbox/Demonstration behavior for standard carriers - allow standard users to test simulation
    const isProductive = !!(orangeClientId || moovApiKey);
    
    return res.json({
      success: true,
      otpRequired: true,
      txId: txId,
      message: `Abonnement Elite initialisé avec succès sur Faso-Educ. Veuillez composer le ${operator === 'orange' ? '*144*4*6#' : '*156*4*5#'} sur votre téléphone mobile pour générer votre code OTP à 6 chiffres, puis saisissez-le ci-dessous pour valider la transaction.`
    });
  }

  // Step 2: Confirm Transaction / Validate OTP
  if (step === "confirm" || otpCode) {
    const cleanOtp = otpCode.trim();
    if (!/^\d{4,8}$/.test(cleanOtp)) {
      return res.status(400).json({ error: "Code d'authentification OTP invalide. Il doit s'agir d'un code numérique de 4 à 8 chiffres." });
    }

    console.info(`[Payment Confirm] Verifying ${operator} transaction for ${cleanEmail}, OTP: ${cleanOtp}, amount: ${amount}`);

    let transactionSucceeded = false;
    let gatewayMessage = "";

    // If live credentials are set, call real validation endpoints
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
          const tokenData: any = await tokenResponse.json();
          const accessToken = tokenData.access_token;

          // Call final confirmation endpoint
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
            const confirmData: any = await confirmResponse.json();
            if (confirmData.status === "SUCCESS") {
              transactionSucceeded = true;
              gatewayMessage = "Transaction validée et débitée avec succès de votre compte Orange Money.";
            } else {
              gatewayMessage = `Échec de la transaction Orange Money : Nom du statut: ${confirmData.status}`;
            }
          } else {
            const errText = await confirmResponse.text();
            console.error("Orange Money transaction verification failed:", errText);
            gatewayMessage = "Code OTP incorrect ou expiré. Échec de la validation Orange Money.";
          }
        }
      } catch (e: any) {
        console.error("Error in live Orange Money double-handshake check:", e.message);
        gatewayMessage = "Erreur de communication avec le serveur d'authentification d'Orange Burkina.";
      }
    } else if (operator === "moov" && moovApiKey) {
      // Execute true Moov Flooz validation
      gatewayMessage = "Échec : L'intégration Moov Money est en attente de signature de votre contrat marchand.";
    } else {
      // Standard carrier parameters are not configured in .env yet
      // We authorize mock inputs for all candidates to test simulation mode!
      transactionSucceeded = true;
      gatewayMessage = `Transaction de simulation validée avec succès. Accès Elite Premium activé pour ${operator === 'orange' ? 'Orange Money' : 'Moov Money'}.`;
    }

    if (!transactionSucceeded) {
      return res.status(400).json({ error: gatewayMessage || "La validation du paiement direct a échoué. Veuillez vérifier votre solde ou re-générer un code OTP." });
    }

    // Activate premium status for profile
    if (serverProfiles[cleanEmail]) {
      serverProfiles[cleanEmail].isPremium = true;
    }

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from("profiles")
          .update({ is_premium: true })
          .eq("email", cleanEmail);
      } catch (dbErr: any) {
        console.error("Supabase user premium activation failed:", dbErr.message);
      }
    }

    // Log transaction record securely in manual_payments
    const newTx = {
      id: txId,
      userEmail: cleanEmail,
      userName: userName || "Candidat Elite",
      operator: operator + "_auto",
      phone: phone,
      amount: Number(amount),
      reference: "AUTO-OM-" + Math.random().toString(36).substr(2, 7).toUpperCase(),
      date: date,
      status: "approved"
    };

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from("manual_payments").insert({
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
      } catch (saveErr: any) {
        console.error("Could not register automatic transaction logs to Supabase:", saveErr.message);
      }
    }

    serverManualPayments = [newTx, ...serverManualPayments];
    saveLocalDB();

    return res.json({
      success: true,
      status: "approved",
      tx: newTx,
      message: gatewayMessage || "Félicitations ! Votre forfait Faso-Educ Elite Premium a été activé automatiquement avec succès."
    });
  }
});

app.post("/api/payments/status", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Accès refusé. Autorisation administrateur requise." });
  }

  const { id, status, rejectReason } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  // Update in server memory fallback
  serverManualPayments = serverManualPayments.map(tx => {
    if (tx.id === id) {
      const updated = { ...tx, status };
      
      // Update the user premium state in memory if approved
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

  const txRecord = serverManualPayments.find(tx => tx.id === id);

  if (supabaseAdmin && txRecord) {
    try {
      // Update transaction status
      const { error: txErr } = await supabaseAdmin
        .from("manual_payments")
        .update({ status: status, reject_reason: rejectReason || null })
        .eq("id", id);
      
      if (txErr) throw txErr;

      // If approved, update profile is_premium status to true
      if (status === "approved" && txRecord.userEmail) {
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({ is_premium: true })
          .eq("email", txRecord.userEmail.toLowerCase());
        
        if (profErr) {
          console.warn("Could not set profile to premium in Supabase:", profErr.message);
        }
      }
    } catch (err: any) {
      console.error("Supabase payment status update failed:", err.message);
    }
  }

  res.json({ success: true, id, status });
  saveLocalDB();
});

// ==========================================
// REAL-TIME SYNCHRONIZED COMPETITION MOTORS
// ==========================================

interface OnlineUser {
  email: string;
  name: string;
  level: string;
  avatar: string;
  isPremium: boolean;
  lastPing: number;
}

interface Invitation {
  id: string;
  hostEmail: string;
  hostName: string;
  inviteeEmail: string;
  roomNumber: number;
  subject: string;
  level: string;
  questionCount: number;
  timeLimit: number;
  status: 'pending' | 'accepted' | 'rejected';
}

interface RoomAnswers {
  [email: string]: {
    [questionIdx: number]: {
      optionIdx: number;
      isCorrect: boolean;
      timeTaken: number;
      scoreAdded: number;
    }
  }
}

interface RoomState {
  roomNumber: number;
  hostEmail: string;
  hostName: string;
  inviteeEmail: string;
  inviteeName: string;
  questions: any[];
  status: 'lobby' | 'active' | 'podium';
  currentQuestionIndex: number;
  answers: RoomAnswers;
  lastUpdated: number;
}

let activeOnlineUsers: Record<string, OnlineUser> = {};
let activeInvitations: Record<string, Invitation> = {};
let activeRoomStates: Record<number, RoomState> = {};

// Automated cleaner for old/stale references
setInterval(() => {
  const now = Date.now();
  Object.keys(activeOnlineUsers).forEach(email => {
    if (now - activeOnlineUsers[email].lastPing > 12000) {
      delete activeOnlineUsers[email];
    }
  });
  Object.keys(activeRoomStates).forEach(roomCode => {
    const num = Number(roomCode);
    if (!isNaN(num) && now - activeRoomStates[num].lastUpdated > 3600000) {
      delete activeRoomStates[num];
    }
  });
}, 10000);

app.post("/api/competition/presence", (req, res) => {
  const { email, name, level, avatar, isPremium } = req.body;
  if (!email) {
    return res.status(400).json({ error: "E-mail requis pour enregistrer la présence." });
  }

  const cleanEmail = email.trim().toLowerCase();
  activeOnlineUsers[cleanEmail] = {
    email: cleanEmail,
    name: name || email.split("@")[0],
    level: level || "Licence",
    avatar: avatar || "👨‍🎓",
    isPremium: !!isPremium,
    lastPing: Date.now()
  };

  const now = Date.now();
  const onlineList = Object.values(activeOnlineUsers)
    .filter(u => u.email !== cleanEmail && (now - u.lastPing <= 12000));

  const pendingInvites = Object.values(activeInvitations)
    .filter(inv => inv.inviteeEmail === cleanEmail && inv.status === 'pending');

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

  // Reset ancient pending invites to preserve logic
  Object.keys(activeInvitations).forEach(id => {
    const inv = activeInvitations[id];
    if (inv.hostEmail === cleanHost && inv.inviteeEmail === cleanInvitee && inv.status === 'pending') {
      inv.status = 'rejected';
    }
  });

  const newInvite: Invitation = {
    id: inviteId,
    hostEmail: cleanHost,
    hostName: hostName || cleanHost.split("@")[0],
    inviteeEmail: cleanInvitee,
    roomNumber: Number(roomNumber),
    subject: subject || "Microéconomie",
    level: level || "Licence",
    questionCount: Number(questionCount) || 8,
    timeLimit: Number(timeLimit) || 45,
    status: 'pending'
  };

  activeInvitations[inviteId] = newInvite;

  activeRoomStates[Number(roomNumber)] = {
    roomNumber: Number(roomNumber),
    hostEmail: cleanHost,
    hostName: hostName || cleanHost.split("@")[0],
    inviteeEmail: cleanInvitee,
    inviteeName: cleanInvitee.split("@")[0],
    questions: [],
    status: 'lobby',
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
    return res.status(404).json({ error: "L'invitation a expiré." });
  }

  invite.status = 'accepted';

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
    invite.status = 'rejected';
  }

  res.json({ success: true });
});

app.get("/api/competition/room/status/:roomNumber", (req, res) => {
  const roomNum = Number(req.params.roomNumber);
  const room = activeRoomStates[roomNum];
  if (!room) {
    return res.status(404).json({ error: "Chambre introuvable." });
  }

  const invitation = Object.values(activeInvitations)
    .find(inv => inv.roomNumber === roomNum);

  const now = Date.now();
  const hostOnline = !!activeOnlineUsers[room.hostEmail] && (now - activeOnlineUsers[room.hostEmail].lastPing <= 15000);
  const inviteeOnline = !!activeOnlineUsers[room.inviteeEmail] && (now - activeOnlineUsers[room.inviteeEmail].lastPing <= 15000);

  res.json({
    success: true,
    roomState: room,
    invitation,
    hostOnline,
    inviteeOnline
  });
});

app.post("/api/competition/room/start", (req, res) => {
  const { roomNumber, questions } = req.body;
  const room = activeRoomStates[Number(roomNumber)];
  if (!room) {
    return res.status(404).json({ error: "Salon introuvable." });
  }

  room.questions = questions;
  room.status = 'active';
  room.currentQuestionIndex = 0;
  room.answers = {
    [room.hostEmail]: {},
    [room.inviteeEmail]: {}
  };
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

  if (typeof nextIndex === 'number') {
    room.currentQuestionIndex = nextIndex;
    if (room.questions.length > 0 && nextIndex >= room.questions.length) {
      room.status = 'podium';
    }
  }
  room.lastUpdated = Date.now();

  res.json({ success: true, roomState: room });
});

// 4. Banning Management
app.get("/api/users/banned", async (req, res) => {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("is_banned", true);

      if (error) throw error;
      if (data) {
        const emails = data.map((d: any) => d.email.toLowerCase());
        serverBannedEmails = Array.from(new Set([...serverBannedEmails, ...emails]));
      }
    } catch (err: any) {
      console.error("Supabase query for banned users failed:", err.message);
    }
  }
  res.json({ bannedEmails: serverBannedEmails });
});

app.post("/api/users/ban", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Accès refusé. Autorisation administrateur requise." });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const cleanEmail = email.trim().toLowerCase();
  if (!serverBannedEmails.includes(cleanEmail)) {
    serverBannedEmails.push(cleanEmail);
  }

  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ is_banned: true })
        .eq("email", cleanEmail);

      if (error) throw error;
    } catch (err: any) {
      console.error("Supabase user ban update failed:", err.message);
    }
  }

  res.json({ success: true, email: cleanEmail });
  saveLocalDB();
});

app.post("/api/users/unban", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Accès refusé. Autorisation administrateur requise." });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const cleanEmail = email.trim().toLowerCase();
  serverBannedEmails = serverBannedEmails.filter(e => e !== cleanEmail);

  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ is_banned: false })
        .eq("email", cleanEmail);

      if (error) throw error;
    } catch (err: any) {
      console.error("Supabase user unban update failed:", err.message);
    }
  }

  res.json({ success: true, email: cleanEmail });
  saveLocalDB();
});

// Admin Route to retrieve all logged-in/registered candidates and subscription matrices
app.get("/api/admin/users", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Accès refusé. Autorisation administrateur requise." });
  }

  let profilesList: Record<string, any> = {};

  // Seed with memory cached records first
  Object.keys(serverProfiles).forEach(email => {
    const p = serverProfiles[email];
    profilesList[email.toLowerCase()] = {
      email: p.email || email,
      name: p.name || email.split("@")[0],
      level: p.level || "Licence",
      targetExam: p.targetExam || p.target_exam || "Non spécifié",
      regionName: p.regionName || p.region_name || "Centre (Ouagadougou)",
      avatar: p.avatar || "👨‍🎓",
      isPremium: !!p.isPremium || !!p.is_premium,
      points: p.points || 0,
      learningStreak: p.learningStreak || p.learning_streak || 0,
      password: p.password || "123456",
      registered: true,
      boundDeviceId: p.boundDeviceId || null,
      transferRequested: !!p.transferRequested || false,
      registrationDate: p.registrationDate || p.created_at || new Date().toISOString()
    };
  });

  // Pull from Supabase if connected
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*");
      if (!error && data) {
        data.forEach((row: any) => {
          const email = row.email.toLowerCase();
          profilesList[email] = {
            email: row.email,
            name: row.name || email.split("@")[0],
            level: row.level || "Licence",
            targetExam: row.target_exam || "Non spécifié",
            regionName: row.region_name || "Centre (Ouagadougou)",
            avatar: row.avatar || "👨‍🎓",
            isPremium: !!row.is_premium,
            points: row.points || 0,
            learningStreak: row.learning_streak || 0,
            password: row.password || "123456",
            registered: true,
            boundDeviceId: row.bound_device_id || row.boundDeviceId || null,
            transferRequested: !!row.transfer_requested || false,
            registrationDate: row.created_at || row.registrationDate || new Date().toISOString()
          };
        });
      }
    } catch (dbErr: any) {
      console.error("Failed to query full profiles from Supabase for admin:", dbErr.message);
    }
  }

  // Inject memory bound devices state on top of Supabase results
  Object.keys(serverProfiles).forEach(email => {
    const cleanEmail = email.toLowerCase();
    if (profilesList[cleanEmail]) {
      if (serverProfiles[email].boundDeviceId) {
        profilesList[cleanEmail].boundDeviceId = serverProfiles[email].boundDeviceId;
      }
      if (serverProfiles[email].transferRequested) {
        profilesList[cleanEmail].transferRequested = serverProfiles[email].transferRequested;
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

// Admin Route to diagnose and verify Supabase Tables and status
app.get("/api/admin/db-diagnostic", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Accès refusé. Autorisation administrateur requise." });
  }

  const diagnosisList: Record<string, any> = {};
  const isSupabaseConfigured = !!supabaseAdmin;

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
        const { data, error } = await supabaseAdmin
          .from(tbl.name)
          .select(tbl.columns)
          .limit(1);

        if (error) {
          diagnosisList[tbl.name] = {
            active: false,
            status: "Inaccessible / Colonnes manquantes",
            error: error.message,
            hint: error.hint || `Veuillez exécuter le script SQL de DATABASE_SETUP.md pour recréer ou modifier la table public.${tbl.name}.`
          };
        } else {
          // Verify with a simple count
          const { count, error: countErr } = await supabaseAdmin
            .from(tbl.name)
            .select('*', { count: 'exact', head: true });

          diagnosisList[tbl.name] = {
            active: true,
            status: "Parfaitement Fonctionnelle ✅",
            count: countErr ? (data ? data.length : 0) : (count || 0),
            error: null
          };
        }
      } catch (err: any) {
        diagnosisList[tbl.name] = {
          active: false,
          status: "Erreur de connexion",
          error: err.message,
          hint: "Connexion rejetée ou impossible avec Supabase."
        };
      }
    }
  }

  res.json({
    success: true,
    connected: isSupabaseConfigured,
    supabaseUrl: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 15)}...` : "Indéfinie ❌",
    database: diagnosisList
  });
});

app.post("/api/admin/reset-device", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Accès refusé. Autorisation administrateur requise." });
  }
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Adresse email requise." });
  }
  const cleanEmail = email.trim().toLowerCase();

  // Reset in-memory profile cache
  if (serverProfiles[cleanEmail]) {
    serverProfiles[cleanEmail].boundDeviceId = null;
    serverProfiles[cleanEmail].transferRequested = false;
  }

  // Reset in Supabase database if active
  if (supabaseAdmin) {
    try {
      await supabaseAdmin
        .from("profiles")
        .update({ bound_device_id: null, transfer_requested: false })
        .eq("email", cleanEmail);
    } catch (err: any) {
      console.error("Failed to reset bound device in Supabase admin action:", err.message);
    }
  }

  saveLocalDB();
  res.json({ success: true, message: "Liaison de l'appareil mobile réinitialisée avec succès ! L'ancien téléphone a été détaché et réinitialisé." });
});

app.post("/api/admin/decline-transfer", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Accès refusé. Autorisation administrateur requise." });
  }
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Adresse email requise." });
  }
  const cleanEmail = email.trim().toLowerCase();

  // Update in-memory cache
  if (serverProfiles[cleanEmail]) {
    serverProfiles[cleanEmail].transferRequested = false;
  }

  // Update Supabase if active
  if (supabaseAdmin) {
    try {
      await supabaseAdmin
        .from("profiles")
        .update({ transfer_requested: false })
        .eq("email", cleanEmail);
    } catch (err: any) {
      console.error("Failed to decline transfer request in Supabase:", err.message);
    }
  }

  saveLocalDB();
  res.json({ success: true, message: "Demande de transfert d'appareil déclinée avec succès !" });
});

// Admin Route to manually manage Premium privileges of any candidate profile
app.post("/api/admin/promote", async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Accès refusé. Autorisation administrateur requise." });
  }

  const { email, isPremium } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Adresse email requise." });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Set memory cache status
  if (serverProfiles[cleanEmail]) {
    serverProfiles[cleanEmail].isPremium = !!isPremium;
  } else {
    // If they aren't fully registered in memory cache but we are promoting, create placeholder
    serverProfiles[cleanEmail] = {
      email: cleanEmail,
      name: cleanEmail.split("@")[0],
      isPremium: !!isPremium,
      registered: true,
      registrationDate: new Date().toISOString()
    };
  }

  // Set database status if live Supabase is active
  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ is_premium: !!isPremium })
        .eq("email", cleanEmail);

      if (error) throw error;
    } catch (err: any) {
      console.error("Supabase user manual promotion update failed:", err.message);
    }
  }

  res.json({ success: true, email: cleanEmail, isPremium: !!isPremium });
  saveLocalDB();
});

// A. Token validation endpoint for connection durability
app.post("/api/auth/token-sync", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Missing token" });

  const payload = verifyToken(token);
  if (!payload || !payload.email) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const email = payload.email.trim().toLowerCase();

  // Check if banned
  if (serverBannedEmails.includes(email)) {
    return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration" });
  }

  // Fetch profile
  let foundProfile: any = null;
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

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
          registered: true
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

  return res.json({ registered: true, profile: foundProfile, token });
});

// B. Secure Mobile Money credentials parameters dynamic fetch
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

// B.2. Secure Admin Login Verification API
app.post("/api/admin/login", (req, res) => {
  const { email, passcode } = req.body;
  if (!email || !passcode) {
    return res.status(400).json({ error: "Email et clé secrète réseau requis." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPasscode = passcode.trim();

  const correctAdminEmail = (process.env.ADMIN_EMAIL || "ibrahimsawadogo36@gmail.com").trim().toLowerCase();
  const correctAdminPasscode = (process.env.ADMIN_PASSCODE || "IBRAHIM_FASO_2026").trim();

  if (cleanEmail === correctAdminEmail && cleanPasscode === correctAdminPasscode) {
    const adminToken = generateToken({ email: correctAdminEmail, role: "admin" });
    return res.json({ success: true, token: adminToken });
  }

  return res.status(401).json({ error: "Identifiant administrateur ou clé secrète invalide. Accès refusé." });
});

// B.3. Password Security Recovery System (OTP code & Email reset flow)
const recoveryCodes = new Map<string, { code: string; expiresAt: number }>();

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = req.body.email ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    return res.status(400).json({ error: "Veuillez fournir une adresse e-mail valide." });
  }

  // Check if profile exists
  let userProfile = serverProfiles[email];
  if (!userProfile && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (data) {
        userProfile = {
          email: data.email,
          name: data.name,
          password: data.password || "123456",
          registered: true
        };
      }
    } catch (e: any) {
      console.error("Supabase forgot-password search error:", e.message);
    }
  }

  if (!userProfile) {
    return res.status(444).json({ error: "Aucun compte candidat n'existe avec cette adresse e-mail. Veuillez d'abord vous inscrire." });
  }

  // Generate 6-digit secure verification OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  recoveryCodes.set(email, {
    code: otpCode,
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes limit
  });

  let emailSent = false;
  let errorMsg = "";
  const transporter = getMailTransporter();

  if (transporter) {
    try {
      const senderUser = process.env.SMTP_USER || "votre-gmail-professionnel@gmail.com";
      const mailOptions = {
        from: `"Faso Educ - Support" <${senderUser}>`,
        to: email,
        subject: "🔑 Code de réinitialisation de votre mot de passe - Faso Educ",
        text: `Bonjour ${userProfile.name || "Candidat"},\n\nVous avez demandé la réinitialisation de votre mot de passe pour le portail d'études d'élite Faso Educ.\n\nVotre code confidentiel OTP est : ${otpCode}\n\nCe code expirera dans 15 minutes.\n\nCordialement,\nService d'assistance Faso Educ`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 30px; background-color: #f8fafc; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 25px;">
              <div style="display: inline-block; width: 50px; height: 50px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 12px; line-height: 50px; color: white; font-size: 24px; font-weight: bold;">F</div>
              <h2 style="color: #0f172a; margin-top: 15px; margin-bottom: 5px; font-weight: 800; font-size: 22px;">Réinitialisation de mot de passe</h2>
              <p style="color: #64748b; font-size: 13px; margin-top: 5px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Faso Educ - Révisions d'Élite</p>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
              Bonjour <strong>${userProfile.name || "Candidat"}</strong>,
              <br/><br/>
              Vous avez formulé une demande de renouvellement de votre mot de passe d'accès académique Faso Educ.
            </p>
            
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
               <p style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Votre code OTP unique temporaire</p>
               <div style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #3b82f6; font-family: 'Courier New', monospace; background-color: #f1f5f9; padding: 12px; border-radius: 8px; display: inline-block; width: fit-content; margin-bottom: 10px;">${otpCode}</div>
               <p style="font-size: 12px; color: #ef4444; margin: 0; font-weight: 600;">⚠️ Ce code confidentiel expirera dans 15 minutes.</p>
            </div>
            
            <p style="font-size: 13px; color: #475569; line-height: 1.5;">
              Saisissez ce code dans le formulaire d'application pour valider votre identité et définir votre nouveau mot de passe sécurisé.
              <br/><br/>
              Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité. Votre mot de passe actuel restera inchangé.
            </p>
            
            <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 25px 0;" />
            <p style="font-size: 11px; text-align: center; color: #94a3b8; line-height: 1.4; margin: 0;">
              Cet e-mail automatique a été envoyé par <strong>Faso Educ</strong>.
              <br/>
              Propulsé par le Réseau de Concours d'Ibrahim Sawadogo.
            </p>
          </div>
        `
      };
      await transporter.sendMail(mailOptions);
      emailSent = true;
    } catch (err: any) {
      console.error("Nodemailer SMTP forgot password dispatch failed:", err.message);
      errorMsg = err.message || "Failed to send SMTP email";
    }
  }

  if (emailSent) {
    return res.json({
      success: true,
      email,
      message: "Un code d'autorisation OTP de réinitialisation de 6 chiffres a été envoyé par e-mail avec succès."
    });
  } else {
    // If SMTP credentials were provided but sending failed, we let them know why while offering the OTP recovery code so they aren't blocked
    const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    let userMsg = "";
    if (smtpConfigured) {
      userMsg = `⚠️ Attention : L'envoi automatique de l'e-mail via votre serveur SMTP (${process.env.SMTP_HOST}) a échoué avec l'erreur : "${errorMsg}". Veuillez vérifier vos configurations de variables d'environnement SMTP sur Render (hôte, port, nom d'utilisateur, ou mot de passe d'application). Par mesure de secours pour poursuivre votre test, vous pouvez saisir ce code OTP de simulation : ${otpCode}`;
    } else {
      userMsg = `✅ [MODE SIMULATION SANS SMTP] Un code OTP de récupération a été généré avec succès ! Saisissez le code suivant pour réinitialiser le mot de passe : ${otpCode}`;
    }

    return res.json({
      success: true,
      email,
      simulation: true,
      code: otpCode,
      message: userMsg
    });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "Tous les champs (E-mail, Code d'autorisation, Nouveau mot de passe) sont obligatoires." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();
  const cleanPassword = newPassword.trim();

  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: "Votre nouveau mot de passe doit comporter au moins 6 caractères." });
  }

  const record = recoveryCodes.get(cleanEmail);
  if (!record) {
    return res.status(400).json({ error: "Aucun processus de récupération n'a été initié pourcet e-mail." });
  }

  if (record.code !== cleanCode) {
    return res.status(400).json({ error: "Le code d'autorisation OTP saisi est incorrect." });
  }

  if (record.expiresAt < Date.now()) {
    recoveryCodes.delete(cleanEmail);
    return res.status(400).json({ error: "Le code d'autorisation a expiré. Veuillez en générer un nouveau." });
  }

  // Update password in local and supabase database
  let success = false;
  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ password: cleanPassword })
        .eq("email", cleanEmail);
      if (error && error.message && error.message.includes("password")) {
        console.warn("Falling back db update on profiles table error");
      } else if (error) {
        throw error;
      }
      success = true;
    } catch (dbErr: any) {
      console.error("Supabase password update error, using local:", dbErr.message);
    }
  }

  if (serverProfiles[cleanEmail]) {
    serverProfiles[cleanEmail].password = cleanPassword;
    success = true;
  } else {
    // Initialize profile structure if not in cache
    serverProfiles[cleanEmail] = {
      email: cleanEmail,
      name: cleanEmail.split("@")[0],
      password: cleanPassword,
      registered: true,
      level: "Licence",
      isPremium: false,
      registrationDate: new Date().toISOString()
    };
    success = true;
  }

  if (success) {
    recoveryCodes.delete(cleanEmail);
    saveLocalDB(); // Persist changes immediately to file!
    return res.json({ success: true, message: "Félicitations ! Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter." });
  }

  return res.status(500).json({ error: "Une erreur interne s'est produite lors de l'enregistrement de votre nouveau mot de passe." });
});

// C. Dynamic Courses syncing & Community/Public directory sharing
app.get("/api/courses", async (req, res) => {
  const userEmail = req.query.email ? (req.query.email as string).trim().toLowerCase() : "";
  
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.from("courses").select("*");
      if (error) throw error;
      if (data) {
        const formatted = data.map((c: any) => ({
          id: c.id,
          title: c.title,
          category: c.category,
          description: c.description,
          chapters: typeof c.chapters === 'string' ? JSON.parse(c.chapters) : c.chapters,
          level: c.level,
          userEmail: c.user_email,
          isPublic: c.is_public
        }));
        
        // Return courses that are EITHER public OR owned by the active candidate
        const filtered = formatted.filter((c: any) => c.isPublic || (userEmail && c.userEmail === userEmail));
        return res.json(filtered);
      }
    } catch (err: any) {
      console.warn("Supabase courses fetch error, falling back to memory:", err.message);
    }
  }
  
  const filteredMemory = serverCourses.filter(c => c.isPublic || (userEmail && c.userEmail === userEmail));
  res.json(filteredMemory);
});

app.post("/api/courses", async (req, res) => {
  const { course } = req.body;
  if (!course || !course.id) {
    return res.status(400).json({ error: "Missing course details" });
  }
  
  const userEmail = course.userEmail ? course.userEmail.trim().toLowerCase() : "";
  const cleanCourse = {
    id: course.id,
    userEmail: userEmail,
    title: course.title,
    category: course.category,
    description: course.description,
    chapters: course.chapters,
    level: course.level,
    isPublic: course.isPublic !== undefined ? !!course.isPublic : false
  };
  
  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.from("courses").upsert({
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
    } catch (err: any) {
      console.error("Supabase courses upsert error, saved to cache:", err.message);
    }
  }
  
  serverCourses = serverCourses.filter(c => c.id !== cleanCourse.id);
  serverCourses.push(cleanCourse);
  saveLocalDB();
  res.json({ success: true, course: cleanCourse });
});

// D. Quiz Results History syncing saving and retrieval
app.get("/api/history", async (req, res) => {
  const userEmail = req.query.email ? (req.query.email as string).trim().toLowerCase() : "";
  if (!userEmail) {
    return res.status(400).json({ error: "Missing email parameter" });
  }
  
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("quiz_results")
        .select("*")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      if (data) {
        const list = data.map((h: any) => ({
          id: h.id,
          userEmail: h.user_email,
          authorName: h.author_name || h.authorName || "Candidat Élite",
          subjects: h.subjects,
          level: h.level,
          score: h.score,
          totalQuestions: h.total_questions,
          percentage: h.percentage,
          questions: typeof h.questions === 'string' ? JSON.parse(h.questions) : h.questions,
          mode: h.mode,
          date: h.created_at,
          isPublic: !!h.is_public || !!h.isPublic || false
        }));
        return res.json(list);
      }
    } catch (e: any) {
      console.warn("Supabase quiz results fetch error, falling back to cache:", e.message);
    }
  }
  
  const filtered = serverQuizResults.filter(q => q.userEmail === userEmail);
  res.json(filtered);
});

app.get("/api/public-quizzes", (req, res) => {
  const list = serverQuizResults.filter(q => q.isPublic);
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
    userEmail: userEmail,
    authorName: result.authorName || "Candidat Élite",
    subjects: result.subjects || [],
    level: result.level || "Licence",
    score: result.score || 0,
    totalQuestions: result.totalQuestions || 0,
    percentage: result.percentage || 0,
    questions: result.questions || [],
    mode: result.mode || "Entraînement",
    date: result.date || new Date().toISOString(),
    isPublic: result.isPublic !== undefined ? !!result.isPublic : false
  };
  
  if (supabaseAdmin) {
    try {
      let pgCreatedAt: string = cleanResult.date;
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
            // ignore
          }
        } else {
          try {
            const d = new Date(pgCreatedAt);
            if (!isNaN(d.getTime())) {
              pgCreatedAt = d.toISOString();
            }
          } catch (e) {
            // ignore
          }
        }
      } else {
        pgCreatedAt = new Date().toISOString();
      }

      const upsertData: any = {
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

      let { error } = await supabaseAdmin.from("quiz_results").upsert(upsertData, { onConflict: "id" });

      if (error && error.message && (error.message.includes("author_name") || error.message.includes("is_public") || error.message.includes("column"))) {
        console.warn("⚠️ Fallback: Supabase 'quiz_results' table does not have 'author_name' or 'is_public' columns. Syncing without them.");
        const { author_name, is_public, ...fallbackData } = upsertData;
        const resFallback = await supabaseAdmin.from("quiz_results").upsert(fallbackData, { onConflict: "id" });
        error = resFallback.error;
      }
      
      if (error) {
        console.warn("⚠️ Warning: Supabase table 'quiz_results' sync failed:", error.message, "| Details:", error.details, "| Hint:", error.hint);
        console.info("💡 Note: You can run the database setup script in DATABASE_SETUP.md in your Supabase SQL Editor to make sure all tables are created.");
      }
    } catch (err: any) {
      console.error("Supabase quiz result upsert error, saved to local cache:", err.message);
    }
  }
  
  serverQuizResults = serverQuizResults.filter(q => q.id !== cleanResult.id);
  serverQuizResults.push(cleanResult);
  saveLocalDB();
  res.json({ success: true, result: cleanResult });
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
