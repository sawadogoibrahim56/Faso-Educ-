import { Question, QuizSettings, Level } from "../types";
import { getApiUrl } from "../lib/api";

const OFFLINE_MESSAGE = "❌ Connexion internet requise. La génération de nouveaux cours, chapitres et QCM par l'IA nécessite une connexion internet active. Cependant, vos cours, chapitres et historiques déjà générés restent 100% accessibles hors ligne !";

function isOfflineError(error: any): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("network error") ||
    msg.includes("cors")
  );
}

export async function generateQuizQuestions(
  subjects: string[],
  settings: QuizSettings,
  excludeQuestions: string[] = [],
  userEmail: string = "",
  signal?: AbortSignal
): Promise<Question[]> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error(OFFLINE_MESSAGE);
    }

    const response = await fetch(getApiUrl("/api/gemini/quiz"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subjects,
        settings,
        excludeQuestions,
        userEmail
      }),
      signal
    });
    
    if (!response.ok) {
      let errorMessage = `Erreur lors de la génération de quiz (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) {
          errorMessage = errJson.message;
        }
      } catch (e) {
        // Silently ignore parsing failure
      }
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("Quiz generation fetch error:", error);
    if (isOfflineError(error)) {
      throw new Error(OFFLINE_MESSAGE);
    }
    throw error;
  }
}

export async function generateCourse(
  subject: string,
  level: Level,
  userEmail: string = ""
): Promise<{
  title: string;
  category: string;
  description: string;
  chapters: { title: string; summary: string; content: string }[];
}> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error(OFFLINE_MESSAGE);
    }

    const response = await fetch(getApiUrl("/api/gemini/course"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subject,
        level,
        userEmail
      })
    });
    
    if (!response.ok) {
      let errMsg = `Erreur lors de la génération du cours (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) errMsg = errJson.message;
        else if (errJson && errJson.error) errMsg = errJson.error;
      } catch (e) {}
      throw new Error(errMsg);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("Course generation fetch error:", error);
    if (isOfflineError(error)) {
      throw new Error(OFFLINE_MESSAGE);
    }
    throw error;
  }
}

export async function generateChapterContent(
  courseTitle: string,
  courseCategory: string,
  chapterTitle: string,
  chapterSummary: string,
  level: Level,
  subject: string,
  userEmail: string = ""
): Promise<string> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error(OFFLINE_MESSAGE);
    }

    const response = await fetch(getApiUrl("/api/gemini/course-chapter"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        courseTitle,
        courseCategory,
        chapterTitle,
        chapterSummary,
        level,
        subject,
        userEmail
      })
    });
    
    if (!response.ok) {
      let errMsg = `Erreur lors de la génération du chapitre (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) errMsg = errJson.message;
        else if (errJson && errJson.error) errMsg = errJson.error;
      } catch (e) {}
      throw new Error(errMsg);
    }
    
    const data = await response.json();
    return data.content || "";
  } catch (error: any) {
    console.error("Chapter generation fetch error:", error);
    if (isOfflineError(error)) {
      throw new Error(OFFLINE_MESSAGE);
    }
    throw error;
  }
}

export async function generateForumAIResponse(
  postTitle: string,
  postContent: string,
  userEmail: string = ""
): Promise<string> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return OFFLINE_MESSAGE;
    }

    const response = await fetch(getApiUrl("/api/gemini/forum"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        postTitle,
        postContent,
        userEmail
      })
    });
    
    if (!response.ok) {
      let errMsg = `Erreur lors de la réponse du forum (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) errMsg = errJson.message;
        else if (errJson && errJson.error) errMsg = errJson.error;
      } catch (e) {}
      throw new Error(errMsg);
    }
    
    const data = await response.json();
    return data.text || "Désolé, je ne parviens pas à formuler une réponse d'expert pour le moment.";
  } catch (error: any) {
    console.error("Forum reply fetch error:", error);
    if (isOfflineError(error)) {
      return OFFLINE_MESSAGE;
    }
    return "Désolé, je ne parviens pas à formuler une réponse d'expert pour le moment.";
  }
}
