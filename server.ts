import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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
