import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";
import nodemailer from "nodemailer";

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
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseAdmin: any = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);
    console.info("⚡ Supabase Admin integrated successfully on the Render server!");
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
    }
  });
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

Lien d'administration pour valider : ${process.env.APP_URL || 'https://refaso-educ.onrender.com'} (Ouvrez le menu Admin "🔑 Administration Réseau")

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
        <a href="${process.env.APP_URL || 'https://refaso-educ.onrender.com'}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
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
    
    const targetCount = settings.questionCount;
    const chunkLimit = 12;
    let allQuestions: any[] = [];
    let excludedList = [...(excludeQuestions || [])];
    const numChunks = Math.ceil(targetCount / chunkLimit);

    for (let c = 0; c < numChunks; c++) {
      const currentChunkCount = Math.min(chunkLimit, targetCount - allQuestions.length);
      if (currentChunkCount <= 0) break;

      const prompt = `Génère un quiz de préparation intensive aux CONCOURS PUBLICS (Burkina Faso) sur les sujets suivants : ${subjects.join(", ")}.
      Niveau d'études : ${settings.level}
      Difficulté : ${settings.difficulty}
      Nombre de questions : ${currentChunkCount}

      Règles de DIVERSITÉ et de QUALITÉ (CRITIQUE) :
      1. AUCUNE REDONDANCE : Ne pose pas deux fois la même question ou une question trop similaire.
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
      
      ${excludedList.length > 0 ? `10. EXCLUSION STRICTE : Ne répète ABSOLUMENT PAS ces questions déjà traitées : [${excludedList.slice(-60).join(" | ")}]. Propose de NOUVELLES questions sur des points de détail ou des thématiques non encore explorées.` : "10. Explore un large éventail de questions pour couvrir tout le sujet."}

      Retourne un tableau JSON d'objets :
      {
        "text": "La question (avec formules LaTeX $...$ ou $$...$$ si applicable)",
        "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
        "correctAnswer": index,
        "explanation": "Explication détaillée pour la préparation au concours, clarifiant les équations si applicables",
        "dimension": "Intellectuelle" | "Morale" | "Mémoire"
      }`;

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

      try {
        const parsedQuestions = JSON.parse(response.text || "[]");
        if (parsedQuestions && parsedQuestions.length > 0) {
          const formatted = parsedQuestions.map((q: any, i: number) => ({
            ...q,
            id: `q-${allQuestions.length + i}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
          }));
          allQuestions = [...allQuestions, ...formatted];
          excludedList = [...excludedList, ...formatted.map((q: any) => q.text)];
        }
      } catch (e) {
        console.error(`Failed to parse chunk ${c} of quiz questions`, e);
      }
    }

    res.json(allQuestions);
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

// 1. Dynamic Supabase Configuration Endpoint
app.get("/api/supabase-config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
  });
});

// 2. Profile Fetch / Sync Endpoints
app.get("/api/profiles/:email", async (req, res) => {
  const email = req.params.email ? req.params.email.trim().toLowerCase() : "";
  if (!email) {
    return res.status(400).json({ error: "Missing email parameter" });
  }

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const prof = {
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
        const token = generateToken({ email: prof.email });
        return res.json({ ...prof, token });
      }
    } catch (err: any) {
      console.error("Supabase profile get error, falling back:", err.message);
    }
  }

  // Fallback to memory
  if (serverProfiles[email]) {
    const token = generateToken({ email });
    return res.json({ ...serverProfiles[email], token });
  }

  return res.json({ registered: false, email });
});

app.post("/api/profiles/sync", async (req, res) => {
  const profile = req.body;
  const email = profile.email ? profile.email.trim().toLowerCase() : "";
  if (!email) {
    return res.status(400).json({ error: "Missing email in profile" });
  }

  // Check if banned
  if (serverBannedEmails.includes(email)) {
    return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration" });
  }

  if (supabaseAdmin) {
    try {
      const { data: checkBan } = await supabaseAdmin
        .from("profiles")
        .select("is_banned")
        .eq("email", email)
        .maybeSingle();

      if (checkBan && checkBan.is_banned) {
        if (!serverBannedEmails.includes(email)) {
          serverBannedEmails.push(email);
        }
        return res.status(403).json({ error: "banned", message: "Ce compte est suspendu par l'administration" });
      }

      const { error } = await supabaseAdmin.from("profiles").upsert({
        email: email,
        name: profile.name,
        level: profile.level,
        target_exam: profile.targetExam,
        region_name: profile.regionName,
        avatar: profile.avatar || "👨‍🎓",
        is_premium: profile.isPremium,
        points: profile.points || 0,
        learning_streak: profile.learningStreak || 0
      }, { onConflict: "email" });

      if (error) throw error;
    } catch (err: any) {
      console.error("Supabase profile sync error, falling back:", err.message);
    }
  }

  // Sync to memory
  serverProfiles[email] = { ...profile, registered: true };
  const token = generateToken({ email });
  res.json({ success: true, profile: serverProfiles[email], token });
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
  
  // Trigger non-blocking asynchronous email notification dispatch to administrator
  sendAdminPaymentMail(newTx).catch(e => console.error("Error dispatching admin email:", e));

  res.json({ success: true, tx: newTx });
});

app.post("/api/payments/status", async (req, res) => {
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
});

app.post("/api/users/unban", async (req, res) => {
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
      num: process.env.PAYMENT_NUM_ORANGE || "+226 76 00 11 22",
      name: "Ibrahim Sawadogo"
    },
    moov: {
      num: process.env.PAYMENT_NUM_MOOV || "+226 60 44 55 66",
      name: "Ibrahim Sawadogo"
    },
    wave: {
      num: process.env.PAYMENT_NUM_WAVE || "+226 55 88 99 00",
      name: "Ibrahim Sawadogo"
    }
  });
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
          subjects: h.subjects,
          level: h.level,
          score: h.score,
          totalQuestions: h.total_questions,
          percentage: h.percentage,
          questions: typeof h.questions === 'string' ? JSON.parse(h.questions) : h.questions,
          mode: h.mode,
          date: h.created_at
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

app.post("/api/history", async (req, res) => {
  const { result } = req.body;
  if (!result || !result.id || !result.userEmail) {
    return res.status(400).json({ error: "Invalid quiz result data" });
  }
  
  const userEmail = result.userEmail.trim().toLowerCase();
  const cleanResult = {
    id: result.id,
    userEmail: userEmail,
    subjects: result.subjects || [],
    level: result.level || "Licence",
    score: result.score || 0,
    totalQuestions: result.totalQuestions || 0,
    percentage: result.percentage || 0,
    questions: result.questions || [],
    mode: result.mode || "Entraînement",
    date: result.date || new Date().toISOString()
  };
  
  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.from("quiz_results").upsert({
        id: cleanResult.id,
        user_email: cleanResult.userEmail,
        subjects: cleanResult.subjects,
        level: cleanResult.level,
        score: cleanResult.score,
        total_questions: cleanResult.totalQuestions,
        percentage: cleanResult.percentage,
        questions: JSON.stringify(cleanResult.questions),
        mode: cleanResult.mode,
        created_at: cleanResult.date
      }, { onConflict: "id" });
      
      if (error) {
        console.warn("Warning: Supabase table 'quiz_results' not found. Storing in Server Cache fallback.");
      }
    } catch (err: any) {
      console.error("Supabase quiz result upsert error, saved to cache:", err.message);
    }
  }
  
  serverQuizResults = serverQuizResults.filter(q => q.id !== cleanResult.id);
  serverQuizResults.push(cleanResult);
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
