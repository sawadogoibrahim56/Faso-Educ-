import { Question, QuizSettings, Level } from "../types";
import { getApiUrl } from "../lib/api";

export async function generateQuizQuestions(
  subjects: string[],
  settings: QuizSettings,
  excludeQuestions: string[] = []
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
        excludeQuestions
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la génération de quiz (${response.status})`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Quiz generation fetch error:", error);
    throw error;
  }
}

export async function generateCourse(
  subject: string,
  level: Level
): Promise<{
  title: string;
  category: string;
  description: string;
  chapters: { title: string; content: string }[];
}> {
  try {
    const response = await fetch(getApiUrl("/api/gemini/course"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subject,
        level
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la génération du cours (${response.status})`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Course generation fetch error:", error);
    throw error;
  }
}

export async function generateForumAIResponse(
  postTitle: string,
  postContent: string
): Promise<string> {
  try {
    const response = await fetch(getApiUrl("/api/gemini/forum"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        postTitle,
        postContent
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la réponse du forum (${response.status})`);
    }
    
    const data = await response.json();
    return data.text || "Désolé, je ne parviens pas à formuler une réponse d'expert pour le moment.";
  } catch (error) {
    console.error("Forum reply fetch error:", error);
    return "Désolé, je ne parviens pas à formuler une réponse d'expert pour le moment.";
  }
}
