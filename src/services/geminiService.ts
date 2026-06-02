import { Question, QuizSettings, Level } from "../types";
import { getApiUrl } from "../lib/api";

export async function generateQuizQuestions(
  subjects: string[],
  settings: QuizSettings,
  excludeQuestions: string[] = [],
  userEmail: string = "",
  signal?: AbortSignal
): Promise<Question[]> {
  try {
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
  } catch (error) {
    console.error("Quiz generation fetch error:", error);
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
  } catch (error) {
    console.error("Course generation fetch error:", error);
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
  } catch (error) {
    console.error("Chapter generation fetch error:", error);
    throw error;
  }
}

export async function generateForumAIResponse(
  postTitle: string,
  postContent: string,
  userEmail: string = ""
): Promise<string> {
  try {
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
  } catch (error) {
    console.error("Forum reply fetch error:", error);
    return "Désolé, je ne parviens pas à formuler une réponse d'expert pour le moment.";
  }
}
