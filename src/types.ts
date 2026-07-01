export type Level = 'BPC' | 'Baccalauréat' | 'Premier cycle' | 'Second cycle' | 'Licence' | 'Master' | 'Doctorat';
export type Difficulty = 'Facile' | 'Moyen' | 'Expert';
export type QuizMode = 'Entraînement' | 'Test' | 'Concours';

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number; // index
  explanation: string;
  dimension: 'Intellectuelle' | 'Morale' | 'Mémoire';
}

export interface QuizSettings {
  level: Level;
  difficulty: Difficulty;
  questionCount: number;
  timePerQuestion: number;
  soundEnabled: boolean;
  aiCompetition?: boolean;
  aiDifficulty?: Difficulty;
  darkMode?: boolean;
  bgTheme?: 'slate' | 'green' | 'blue';
  fontSize?: 'normal' | 'large' | 'xlarge';
}

export interface QuizResult {
  id: string;
  subjects: string[];
  date: string;
  level: Level;
  score: number;
  totalQuestions: number;
  mode: QuizMode;
  questions: Question[];
  userAnswers: (number | null)[];
  isPublic?: boolean;
  authorName?: string;
  authorEmail?: string;
}

export interface CourseData {
  id: string;
  title: string;
  category: string;
  subject: string;
  level: Level;
  description: string;
  chapters: {
    title: string;
    content: string;
    summary?: string;
  }[];
  userEmail?: string;
  isPublic?: boolean;
}

export interface ForumReply {
  id: string;
  author: string;
  authorRole: 'Candidat' | 'Professeur' | 'Expert' | 'Modérateur' | 'Vous';
  content: string;
  date: string;
  upvotes: number;
}

export interface ForumPost {
  id: string;
  title: string;
  author: string;
  authorRole: 'Candidat' | 'Professeur' | 'Expert' | 'Modérateur' | 'Vous';
  category: 'Économie' | 'Mathématiques' | 'Statistiques' | 'Conseils de révision' | 'Général' | 'Infos Concours';
  content: string;
  date: string;
  upvotes: number;
  views: number;
  replies: ForumReply[];
  isPinned?: boolean;
}

export interface UserProfile {
  registered: boolean;
  name: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  level: Level;
  registrationDate: string; // ISO string
  isPremium: boolean;
  simulatedTimeShiftDays?: number; // to allow user to simulate days passing
  avatar?: string;
  targetExam?: string;
  regionName?: string;
  learningStreak?: number;
  points?: number;
  password?: string;
  boundDeviceId?: string;
  transferRequested?: boolean;
}

export interface ManualPaymentTx {
  id: string;
  userEmail: string;
  userName: string;
  operator: string;
  phone: string;
  amount: number;
  reference: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}




