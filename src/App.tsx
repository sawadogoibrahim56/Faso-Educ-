/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  X, 
  Settings as SettingsIcon, 
  History as HistoryIcon, 
  Home as HomeIcon, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Download, 
  ChevronRight, 
  Trophy, 
  BookOpen, 
  Target, 
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Loader2,
  Moon,
  Sun,
  Search as SearchIcon,
  Share as ShareIcon,
  Bookmark,
  Video,
  Trash2,
  Edit3,
  Award,
  User
} from 'lucide-react';
import { cn } from './lib/utils';
import { Level, Difficulty, QuizMode, Question, QuizSettings, QuizResult, CourseData, ForumPost, ForumReply, UserProfile, ManualPaymentTx } from './types';
import { generateQuizQuestions, generateCourse, generateForumAIResponse } from './services/geminiService';
import { generateQuizPDF, generateCoursePDF } from './lib/pdfGenerator';
import { precompiledCourses } from './data/precompiledCourses';
import { precompiledForum } from './data/precompiledForum';
import { MathRenderer } from './components/MathRenderer';
import { CompetitionArena } from './components/CompetitionArena';
import { FileText, Sparkles, BookOpenCheck, RefreshCw, MessageSquare, ThumbsUp, Eye, Send, Pin, CreditCard, ShieldAlert, BadgeCheck, Bell, Info, Copy } from 'lucide-react';

// --- Components ---

const ProgressBar = ({ progress, color = "bg-faso-blue" }: { progress: number, color?: string }) => (
  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
    <motion.div 
      className={cn("h-full rounded-full transition-all duration-300", color)}
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
    />
  </div>
);

const TimerCircle = ({ timeLeft, totalTime, isPaused }: { timeLeft: number, totalTime: number, isPaused: boolean }) => {
  const percentage = (timeLeft / totalTime) * 100;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          className="text-gray-200 dark:text-gray-800"
        />
        <motion.circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          className={cn("text-faso-blue transition-all duration-1000", isPaused && "opacity-50")}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold font-mono dark:text-white">
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  // User Profile Support
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('faso_educ_user_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          return {
            registered: !!parsed.registered,
            name: parsed.name || '',
            email: parsed.email || '',
            level: parsed.level || 'Licence',
            registrationDate: parsed.registrationDate || new Date().toISOString(),
            isPremium: !!parsed.isPremium,
            simulatedTimeShiftDays: parsed.simulatedTimeShiftDays || 0,
          };
        }
      } catch (e) {
        // ignore
      }
    }
    return {
      registered: false,
      name: '',
      email: '',
      level: 'Licence',
      registrationDate: new Date().toISOString(),
      isPremium: false,
      simulatedTimeShiftDays: 0,
    };
  });

  // Full-Stack Synchronization & Admin Security States
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    return localStorage.getItem('faso_educ_admin_unlocked') === 'true';
  });
  const [adminInputEmail, setAdminInputEmail] = useState('');
  const [adminInputPasscode, setAdminInputPasscode] = useState('');
  const [adminUnlockError, setAdminUnlockError] = useState<string | null>(null);
  const [bannedEmails, setBannedEmails] = useState<string[]>([]);
  const [backendSyncStatus, setBackendSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [paymentCredentials, setPaymentCredentials] = useState<{
    orange: { num: string; name: string };
    moov: { num: string; name: string };
    wave: { num: string; name: string };
  } | null>(null);

  // Load backend variables and sync state
  useEffect(() => {
    let isActive = true;
    async function initFullStackEngine() {
      try {
        setBackendSyncStatus('syncing');
        // A. Load Supabase configuration if returned by Express backend
        const configRes = await fetch('/api/supabase-config');
        if (configRes.ok && isActive) {
          const config = await configRes.json();
          if (config.supabaseUrl && config.supabaseAnonKey) {
            const { initSupabaseClient } = await import('./lib/supabase');
            initSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
            console.log("⚡ Supabase Dynamic connection ready via backend environment.");
          }
        }

        // B. Fetch server-side banned list
        const banRes = await fetch('/api/users/banned');
        if (banRes.ok && isActive) {
          const banData = await banRes.json();
          if (Array.isArray(banData.bannedEmails)) {
            setBannedEmails(banData.bannedEmails);
          }
        }

        // C. Fetch server-side payments to synchronize across Render clients
        const payRes = await fetch('/api/payments');
        if (payRes.ok && isActive) {
          const payData = await payRes.json();
          if (Array.isArray(payData) && payData.length > 0) {
            setManualPayments(payData);
          }
        }

        // D. Fetch hidden payment operational parameters routing details
        try {
          const credsRes = await fetch('/api/payment-credentials');
          if (credsRes.ok && isActive) {
            const credsData = await credsRes.json();
            setPaymentCredentials(credsData);
          }
        } catch (e) {
          console.warn("Could not retrieve server-side payment credentials from parameters.");
        }

        // E. JWS durable session check
        let activeEmail = "";
        const cachedToken = localStorage.getItem('faso_educ_jwt_token');
        if (cachedToken) {
          try {
            const authRes = await fetch('/api/auth/token-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: cachedToken })
            });
            if (authRes.ok) {
              const authData = await authRes.json();
              if (authData.registered && authData.profile) {
                setProfile(authData.profile);
                activeEmail = authData.profile.email;
                if (authData.token) {
                  localStorage.setItem('faso_educ_jwt_token', authData.token);
                }
                console.log("🔒 Durable Session Authenticated via JWS Token:", activeEmail);
              }
            }
          } catch (e) {
            console.error("Token session sync error on load:", e);
          }
        }

        if (!activeEmail) {
          const localProf = localStorage.getItem('faso_educ_user_profile');
          if (localProf) {
            try {
              const parsed = JSON.parse(localProf);
              if (parsed.email) activeEmail = parsed.email;
            } catch (e) { /* ignore */ }
          }
        }

        // F. Sync courses and quiz history
        if (activeEmail && isActive) {
          try {
            const coursesRes = await fetch(`/api/courses?email=${encodeURIComponent(activeEmail)}`);
            if (coursesRes.ok) {
              const coursesData = await coursesRes.json();
              if (Array.isArray(coursesData) && coursesData.length > 0) {
                setGeneratedCourses(coursesData);
              }
            }
          } catch (e) {
            console.warn("Could not retrieve synchronized courses list:", e);
          }

          try {
            const historyRes = await fetch(`/api/history?email=${encodeURIComponent(activeEmail)}`);
            if (historyRes.ok) {
              const historyData = await historyRes.json();
              if (Array.isArray(historyData) && historyData.length > 0) {
                setHistory(historyData);
              }
            }
          } catch (e) {
            console.warn("Could not retrieve synchronized quiz results history:", e);
          }
        }

        if (isActive) setBackendSyncStatus('synced');
      } catch (err) {
        console.warn("⚠️ Standard offline container active (No full-stack backend).", err);
        if (isActive) setBackendSyncStatus('error');
      }
    }
    initFullStackEngine();
    return () => { isActive = false; };
  }, []);

  // Profile Server Synchronization Hook
  useEffect(() => {
    if (!profile.email || !profile.registered) return;
    let isActive = true;

    async function syncProfileWithBackend() {
      try {
        const res = await fetch(`/api/profiles/${encodeURIComponent(profile.email)}`);
        if (res.ok && isActive) {
          const serverProf = await res.json();
          if (serverProf && serverProf.registered) {
            setProfile(prev => ({
              ...prev,
              name: serverProf.name || prev.name,
              level: serverProf.level || prev.level,
              isPremium: !!serverProf.isPremium,
              registered: true
            }));
          }
        }

        // Send active properties to save on backend
        await fetch('/api/profiles/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile)
        });
      } catch (err) {
        console.warn("Syncing fallback local profile mode active.", err);
      }
    }
    
    syncProfileWithBackend();
    return () => { isActive = false; };
  }, [profile.email, profile.registered]);

  // Persist Profile
  useEffect(() => {
    localStorage.setItem('faso_educ_user_profile', JSON.stringify(profile));
  }, [profile]);

  // Helper calculation for trial days
  const getTrialDaysRemaining = (): number => {
    if (!profile.registrationDate) return 7;
    const regDate = new Date(profile.registrationDate);
    if (isNaN(regDate.getTime())) return 7;
    const now = new Date();
    const shift = profile.simulatedTimeShiftDays || 0;
    const elapsedMs = (now.getTime() - regDate.getTime()) + (shift * 24 * 60 * 60 * 1000);
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const remaining = 7 - elapsedDays;
    return Math.max(0, Math.ceil(remaining));
  };

  const isTrialExpired = (): boolean => {
    return !profile.isPremium && getTrialDaysRemaining() <= 0;
  };

  // State to trigger checkout pop-ups/modals
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<QuizMode | 'Accueil' | 'Historique' | 'Cours' | 'Forum' | 'Competition' | 'Paiement' | 'Espace'>('Accueil');
  const [showSettings, setShowSettings] = useState(false);
  
  // Forum State
  const [forumPosts, setForumPosts] = useState<ForumPost[]>(() => {
    const saved = localStorage.getItem('faso_educ_forum_posts');
    if (!saved) return precompiledForum;
    try {
      return JSON.parse(saved);
    } catch {
      return precompiledForum;
    }
  });
  
  const [forumCategoryFilter, setForumCategoryFilter] = useState<'Tous' | 'Économie' | 'Mathématiques' | 'Statistiques' | 'Conseils de révision' | 'Général' | 'Infos Concours'>('Tous');
  const [forumSearchQuery, setForumSearchQuery] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  
  // New thread states
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadCategory, setNewThreadCategory] = useState<ForumPost['category']>('Économie');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newThreadAuthor, setNewThreadAuthor] = useState('');
  const [askAIAfterCreation, setAskAIAfterCreation] = useState(false);
  
  // New comment states
  const [newCommentAuthor, setNewCommentAuthor] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');
  const [isGeneratingAIComment, setIsGeneratingAIComment] = useState(false);

  // Persist Forum Posts
  useEffect(() => {
    localStorage.setItem('faso_educ_forum_posts', JSON.stringify(forumPosts));
  }, [forumPosts]);
  
  // Courses variables
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [customCourseTopic, setCustomCourseTopic] = useState('');
  const [selectedCourseLevel, setSelectedCourseLevel] = useState<Level>('Licence');
  const [isGeneratingCourse, setIsGeneratingCourse] = useState(false);
  const [courseCategoryFilter, setCourseCategoryFilter] = useState<'Tous' | 'Microéconomie' | 'Macroéconomie' | 'Statistiques' | 'Mathématiques' | 'Personnalisés'>('Tous');
  const [generatedCourses, setGeneratedCourses] = useState<CourseData[]>(() => {
    const saved = localStorage.getItem('faso_educ_generated_courses');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  // Persist generated courses and sync to the backend
  useEffect(() => {
    localStorage.setItem('faso_educ_generated_courses', JSON.stringify(generatedCourses));
    if (profile.registered && profile.email && generatedCourses.length > 0) {
      generatedCourses.forEach(course => {
        fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            course: {
              ...course,
              userEmail: profile.email
            }
          })
        }).catch(err => console.error("Error syncing custom course:", err));
      });
    }
  }, [generatedCourses, profile.email, profile.registered]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<{
    id: string;
    questions: Question[];
    mode: QuizMode;
    settings: QuizSettings;
    subjects: string[];
  } | null>(null);
  const [quizState, setQuizState] = useState<{
    currentIndex: number;
    userAnswers: (number | null)[];
    timeLeft: number;
    isPaused: boolean;
    isFinished: boolean;
    showFeedback: boolean;
    selectedOption: number | null;
  } | null>(null);
  const isFinishingRef = useRef(false);
  const [history, setHistory] = useState<QuizResult[]>(() => {
    const saved = localStorage.getItem('faso_educ_history');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as QuizResult[];
      // Deduplicate by ID just in case
      const seen = new Set();
      return parsed.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    } catch (e) {
      return [];
    }
  });

  // Home State
  const [subjects, setSubjects] = useState<string[]>(['']);
  const [settings, setSettings] = useState<QuizSettings>(() => {
    const saved = localStorage.getItem('faso_educ_settings');
    return saved ? JSON.parse(saved) : {
      level: 'Licence',
      difficulty: 'Moyen',
      questionCount: 50,
      timePerQuestion: 119,
      soundEnabled: true,
      aiCompetition: false,
      aiDifficulty: 'Moyen',
      darkMode: false
    };
  });

  // Persist Settings & Dark Mode
  useEffect(() => {
    localStorage.setItem('faso_educ_settings', JSON.stringify(settings));
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  // Persist History and sync to the backend
  useEffect(() => {
    localStorage.setItem('faso_educ_history', JSON.stringify(history));
    if (profile.registered && profile.email && history.length > 0) {
      history.forEach(result => {
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            result: {
              ...result,
              userEmail: profile.email
            }
          })
        }).catch(err => console.error("Error syncing quiz history:", err));
      });
    }
  }, [history, profile.email, profile.registered]);

  // Timer Logic
  useEffect(() => {
    if (!quizState || quizState.isPaused || quizState.isFinished || quizState.showFeedback) return;

    const timer = setInterval(() => {
      if (quizState.timeLeft <= 0) {
        handleTimeout();
      } else {
        setQuizState(prev => prev ? { ...prev, timeLeft: prev.timeLeft - 1 } : null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [quizState?.isPaused, quizState?.isFinished, quizState?.showFeedback, quizState?.timeLeft]);

  const handleTimeout = () => {
    if (!currentQuiz || !quizState) return;
    
    if (currentQuiz.mode === 'Entraînement') {
      setQuizState(prev => prev ? { ...prev, showFeedback: true, selectedOption: null } : null);
    } else if (currentQuiz.mode === 'Test') {
      nextQuestion();
    } else if (currentQuiz.mode === 'Concours') {
      nextQuestion();
    }
  };

  const startQuiz = async (mode: QuizMode) => {
    if (isTrialExpired()) {
      setShowCheckoutModal(true);
      return;
    }
    const currentSubjects = subjects.filter(s => s.trim());
    if (currentSubjects.length === 0) return;
    
    setIsGenerating(true);
    const timePerQ = mode === 'Entraînement' ? 119 : mode === 'Test' ? 117 : 105;
    const count = settings.questionCount;
    
    // Récupérer les questions déjà posées pour ces sujets pour éviter les répétitions
    const previousQuestions = history
      .filter(h => h && h.subjects && Array.isArray(h.questions) && h.subjects.some(s => currentSubjects.includes(s)))
      .flatMap(h => h.questions.map(q => q ? q.text : ""))
      .filter(Boolean)
      .slice(0, 80); // Augmenté à 80 pour une meilleure diversité sur le long terme

    const questions = await generateQuizQuestions(currentSubjects, {
      ...settings,
      questionCount: count,
      timePerQuestion: timePerQ
    }, previousQuestions);

    if (questions.length > 0) {
      const quizId = `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      isFinishingRef.current = false;
      
      // Save to history immediately
      const initialResult: QuizResult = {
        id: quizId,
        subjects: subjects.filter(s => s.trim()),
        date: new Date().toLocaleDateString('fr-FR'),
        level: settings.level,
        score: 0,
        totalQuestions: questions.length,
        mode,
        questions,
        userAnswers: new Array(questions.length).fill(null)
      };
      
      setHistory(prev => [initialResult, ...prev]);

      setCurrentQuiz({
        id: quizId,
        questions,
        mode,
        settings: { ...settings, questionCount: count, timePerQuestion: timePerQ },
        subjects: subjects.filter(s => s.trim())
      });
      setQuizState({
        currentIndex: 0,
        userAnswers: new Array(questions.length).fill(null),
        timeLeft: timePerQ,
        isPaused: false,
        isFinished: false,
        showFeedback: false,
        selectedOption: null
      });
      setActiveTab(mode);
    }
    setIsGenerating(false);
  };

  // Audio synthesizer helper inside main app interface
  const playSound = (type: 'correct' | 'wrong' | 'finish') => {
    if (!settings.soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'correct') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'wrong') {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
        osc.frequency.setValueAtTime(147, audioCtx.currentTime + 0.1); // D3
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else if (type === 'finish') {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      }
    } catch (e) {
      console.warn("Audio Context blocked or unsupported:", e);
    }
  };

  const handleOptionSelect = (index: number) => {
    if (!quizState || !currentQuiz || quizState.showFeedback || quizState.isFinished) return;

    const isCorrect = index === currentQuiz.questions[quizState.currentIndex].correctAnswer;
    
    // Play sound if enabled
    playSound(isCorrect ? 'correct' : 'wrong');

    setQuizState(prev => {
      if (!prev) return null;
      const newAnswers = [...prev.userAnswers];
      newAnswers[prev.currentIndex] = index;
      
      if (currentQuiz.mode === 'Entraînement') {
        return { ...prev, userAnswers: newAnswers, showFeedback: true, selectedOption: index };
      } else if (currentQuiz.mode === 'Test') {
        return { ...prev, userAnswers: newAnswers, showFeedback: true, selectedOption: index };
      } else { // Concours
        // Immediate advance
        setTimeout(() => nextQuestion(newAnswers), 300);
        return { ...prev, userAnswers: newAnswers, selectedOption: index };
      }
    });

    if (currentQuiz.mode === 'Test') {
      setTimeout(() => nextQuestion(), 1000);
    }
  };

  const nextQuestion = (updatedAnswers?: (number | null)[]) => {
    if (!quizState || !currentQuiz) return;

    const nextIdx = quizState.currentIndex + 1;
    const answers = updatedAnswers || quizState.userAnswers;

    if (nextIdx >= currentQuiz.questions.length) {
      if (!quizState.isFinished && !isFinishingRef.current) {
        isFinishingRef.current = true;
        setQuizState(prev => prev ? { ...prev, isFinished: true } : null);
        finishQuiz(answers);
      }
      return;
    }

    setQuizState(prev => {
      if (!prev || !currentQuiz) return null;
      return {
        ...prev,
        currentIndex: nextIdx,
        timeLeft: currentQuiz.settings.timePerQuestion,
        showFeedback: false,
        selectedOption: null,
        userAnswers: answers
      };
    });
  };

  const finishQuiz = (finalAnswers: (number | null)[]) => {
    if (!currentQuiz) return;
    
    playSound('finish');
    const score = finalAnswers.reduce((acc, ans, idx) => {
      return acc + (ans === currentQuiz.questions[idx].correctAnswer ? 1 : 0);
    }, 0);

    // Dynamic scale-ready study rewards: 20 XP per correct answer + 100 XP bonus for completion
    const wonXP = (score * 20) + (score === currentQuiz.questions.length ? 100 : 30);
    setProfile(prev => ({
      ...prev,
      points: (prev.points || 0) + wonXP,
      learningStreak: (prev.learningStreak || 0) + 1
    }));

    // Update existing history entry
    setHistory(prev => prev.map(item => {
      if (item.id === currentQuiz.id) {
        return {
          ...item,
          score,
          userAnswers: finalAnswers,
          date: new Date().toLocaleDateString('fr-FR')
        };
      }
      return item;
    }));
  };

  const resetToHome = () => {
    setCurrentQuiz(null);
    setQuizState(null);
    setActiveTab('Accueil');
  };

  // --- Render Helpers ---

  const renderHome = () => (
    <div className="p-6 space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-faso-green">Faso Educ</h1>
        <p className="text-gray-600 dark:text-gray-400">Générez des quiz pédagogiques de haute qualité</p>
      </div>

      {/* Promo banner pour l'Arène de Concours d'Élite Live */}
      <div className="bg-gradient-to-tr from-faso-blue/10 via-transparent to-faso-green/10 border border-faso-green/20 rounded-3xl p-5 space-y-4 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-faso-green/10 text-faso-green rounded-2xl shrink-0">
            <Trophy size={28} className="animate-bounce" />
          </div>
          <div className="space-y-1 text-left">
            <span className="text-[10px] font-bold bg-faso-green/20 text-faso-green px-2.5 py-0.5 rounded-full uppercase tracking-wider">NOUVEAU - EN DIRECT</span>
            <h3 className="font-extrabold text-base dark:text-white mt-1">Arène de Concours Live</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Préparez-vous à l'excellence ! Invitez des réviseurs avec un lien d'évaluation ou affrontez jusqu'à 10 cerveaux d'IA en direct dans des épreuves minutées avec un tableau des scores dynamique.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setActiveTab('Competition');
            setSelectedPostId(null);
          }}
          className="w-full py-3 bg-faso-green hover:bg-green-600 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Sparkles size={14} />
          Rejoindre l'Arène de Concours d'Élite
        </button>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sujets du quiz</label>
        {subjects.map((subject, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={subject}
              onChange={(e) => {
                const newSubjects = [...subjects];
                newSubjects[idx] = e.target.value;
                setSubjects(newSubjects);
              }}
              placeholder="Ex: Histoire du Burkina Faso, Algèbre..."
              className="flex-1 p-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-faso-blue focus:border-transparent outline-none dark:text-white"
            />
            {subjects.length > 1 && (
              <button 
                onClick={() => setSubjects(subjects.filter((_, i) => i !== idx))}
                className="p-3 text-faso-red hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        ))}
        <button 
          onClick={() => setSubjects([...subjects, ''])}
          className="flex items-center gap-2 text-faso-blue font-medium hover:underline"
        >
          <Plus size={18} /> Ajouter un sujet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={() => startQuiz('Entraînement')}
          disabled={isGenerating || subjects.every(s => !s.trim())}
          className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-gray-900 border-2 border-faso-blue rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50"
        >
          <BookOpen className="text-faso-blue" size={32} />
          <span className="font-bold dark:text-white">Entraînement</span>
        </button>
        <button 
          onClick={() => startQuiz('Test')}
          disabled={isGenerating || subjects.every(s => !s.trim())}
          className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-gray-900 border-2 border-faso-yellow rounded-2xl hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all disabled:opacity-50"
        >
          <Target className="text-faso-yellow" size={32} />
          <span className="font-bold dark:text-white">Test</span>
        </button>
        <button 
          onClick={() => startQuiz('Concours')}
          disabled={isGenerating || subjects.every(s => !s.trim())}
          className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-gray-900 border-2 border-faso-green rounded-2xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-all disabled:opacity-50"
        >
          <Users className="text-faso-green" size={32} />
          <span className="font-bold dark:text-white">Concours</span>
        </button>
      </div>

      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl flex flex-col items-center gap-4 max-w-xs text-center">
            <Loader2 className="animate-spin text-faso-blue" size={48} />
            <p className="font-bold text-lg dark:text-white">Génération de votre quiz...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">L'IA prépare des questions nuancées et pédagogiques.</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="fixed inset-0 bg-white dark:bg-gray-950 z-50 overflow-y-auto">
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold dark:text-white">Paramètres</h2>
          <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full dark:text-gray-400">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <section className="space-y-3">
            <label className="font-bold dark:text-gray-200">Niveau d'études</label>
            <div className="grid grid-cols-2 gap-2">
              {['Premier cycle', 'Licence', 'Master', 'Doctorat'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSettings({ ...settings, level: lvl as Level })}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all",
                    settings.level === lvl ? "border-faso-blue bg-blue-50 dark:bg-blue-900/20 text-faso-blue" : "border-gray-200 dark:border-gray-800 dark:text-gray-400"
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <label className="font-bold dark:text-gray-200">Difficulté</label>
            <div className="flex gap-2">
              {['Facile', 'Moyen', 'Expert'].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSettings({ ...settings, difficulty: diff as Difficulty })}
                  className={cn(
                    "flex-1 p-3 rounded-xl border-2 transition-all",
                    settings.difficulty === diff ? "border-faso-blue bg-blue-50 dark:bg-blue-900/20 text-faso-blue" : "border-gray-200 dark:border-gray-800 dark:text-gray-400"
                  )}
                >
                  {diff}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex justify-between">
              <label className="font-bold dark:text-gray-200">Nombre de questions</label>
              <span className="text-faso-blue font-bold">{settings.questionCount}</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={settings.questionCount}
              onChange={(e) => setSettings({ ...settings, questionCount: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-faso-blue"
            />
          </section>

          <section className="flex flex-col p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="text-faso-green" />
                <span className="font-bold dark:text-white">Compétition contre l'IA</span>
              </div>
              <button
                onClick={() => setSettings({ ...settings, aiCompetition: !settings.aiCompetition })}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  settings.aiCompetition ? "bg-faso-green" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  settings.aiCompetition ? "left-7" : "left-1"
                )} />
              </button>
            </div>
            
            {settings.aiCompetition && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700"
              >
                <label className="text-sm font-bold text-gray-600 dark:text-gray-400">Difficulté de l'IA</label>
                <div className="flex gap-2">
                  {['Facile', 'Moyen', 'Expert'].map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setSettings({ ...settings, aiDifficulty: diff as Difficulty })}
                      className={cn(
                        "flex-1 p-2 rounded-lg border-2 text-sm transition-all",
                        settings.aiDifficulty === diff ? "border-faso-green bg-green-50 dark:bg-green-900/20 text-faso-green" : "border-gray-200 dark:border-gray-700 dark:text-gray-400"
                      )}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 italic">
                  L'IA sera plus rapide et plus précise en mode Expert.
                </p>
              </motion.div>
            )}
          </section>

          <section className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center gap-3">
              {settings.darkMode ? <Moon className="text-faso-blue" /> : <Sun className="text-faso-yellow" />}
              <span className="font-bold dark:text-white">Mode Sombre</span>
            </div>
            <button
              onClick={() => setSettings({ ...settings, darkMode: !settings.darkMode })}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                settings.darkMode ? "bg-faso-green" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                settings.darkMode ? "left-7" : "left-1"
              )} />
            </button>
          </section>

          <section className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center gap-3">
              {settings.soundEnabled ? <Volume2 className="text-faso-blue" /> : <VolumeX className="text-gray-400" />}
              <span className="font-bold dark:text-white">Effets sonores</span>
            </div>
            <button
              onClick={() => setSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                settings.soundEnabled ? "bg-faso-green" : "bg-gray-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                settings.soundEnabled ? "left-7" : "left-1"
              )} />
            </button>
          </section>
        </div>

        <div className="pt-6 space-y-3">
          <button 
            onClick={() => {
              setShowSettings(false);
              startQuiz('Entraînement');
            }}
            disabled={isGenerating || subjects.every(s => !s.trim())}
            className="w-full p-4 bg-faso-green text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            Lancer la génération (Entraînement)
          </button>
          <button 
            onClick={() => setShowSettings(false)}
            className="w-full p-3 text-gray-500 font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuiz = () => {
    if (!currentQuiz || !quizState) return null;
    const question = currentQuiz.questions[quizState.currentIndex];
    const progress = ((quizState.currentIndex + 1) / currentQuiz.questions.length) * 100;

    if (quizState.isFinished) {
      const result = history.find(h => h.id === currentQuiz.id) || history[0];
      return (
        <div className="p-6 max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 bg-faso-yellow/20 rounded-full">
              <Trophy className="text-faso-yellow" size={48} />
            </div>
            <h2 className="text-3xl font-bold dark:text-white">Quiz Terminé !</h2>
            <div className="text-5xl font-black text-faso-green">
              {result.score} / {result.totalQuestions}
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {Math.round((result.score / result.totalQuestions) * 100)}% de réussite
            </p>
          </div>

          {currentQuiz.mode === 'Concours' && (
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2 dark:text-white">
                <Users size={20} /> {currentQuiz.settings.aiCompetition ? "Duel contre l'IA" : "Classement (Simulé)"}
              </h3>
              <div className="space-y-2">
                {currentQuiz.settings.aiCompetition ? (
                  <>
                    <div className="flex justify-between p-4 bg-faso-blue/10 border border-faso-blue rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-faso-blue rounded-full flex items-center justify-center text-white font-bold">V</div>
                        <span className="font-bold dark:text-white">Vous</span>
                      </div>
                      <span className="font-black text-xl dark:text-white">{result.score} pts</span>
                    </div>
                    <div className="flex justify-between p-4 bg-faso-red/10 border border-faso-red rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-faso-red rounded-full flex items-center justify-center text-white font-bold">IA</div>
                        <div>
                          <span className="font-bold dark:text-white">Intelligence Artificielle</span>
                          <div className="text-[10px] uppercase font-bold text-faso-red opacity-70">{currentQuiz.settings.aiDifficulty}</div>
                        </div>
                      </div>
                      <span className="font-black text-xl dark:text-white">
                        {(() => {
                          const diff = currentQuiz.settings.aiDifficulty;
                          const accuracy = diff === 'Facile' ? 0.6 : diff === 'Moyen' ? 0.8 : 0.95;
                          const aiScore = Math.round(result.totalQuestions * accuracy + (Math.random() * 5 - 2.5));
                          return Math.min(result.totalQuestions, Math.max(0, aiScore));
                        })()} pts
                      </span>
                    </div>
                    <div className="text-center p-3 font-bold text-lg">
                      {result.score > (result.totalQuestions * (currentQuiz.settings.aiDifficulty === 'Facile' ? 0.6 : currentQuiz.settings.aiDifficulty === 'Moyen' ? 0.8 : 0.95)) ? (
                        <span className="text-faso-green italic">Félicitations ! Vous avez battu l'IA !</span>
                      ) : (
                        <span className="text-faso-red italic">L'IA a remporté ce duel. Continuez à vous entraîner !</span>
                      )}
                    </div>
                  </>
                ) : (
                  [1, 2, 3, 4, 5].map(rank => (
                    <div key={rank} className={cn(
                      "flex justify-between p-3 rounded-lg",
                      rank === 4 ? "bg-faso-blue/10 border border-faso-blue" : "bg-white dark:bg-gray-800"
                    )}>
                      <span className="font-medium dark:text-gray-200">{rank}. {rank === 4 ? "Vous" : `Participant #${rank * 123}`}</span>
                      <span className="font-bold dark:text-white">{rank === 4 ? result.score : result.totalQuestions - rank} pts</span>
                    </div>
                  ))
                )}
              </div>
              <div className="text-center p-3 bg-faso-green/10 text-faso-green font-bold rounded-lg">
                Statut: {result.score > result.totalQuestions * 0.7 ? "ADMIS" : "NON ADMIS"}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button 
              onClick={() => startQuiz(currentQuiz.mode)}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 p-4 bg-faso-green text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              <Plus size={20} /> Générer un nouveau quiz (mêmes sujets)
            </button>
            <button 
              onClick={() => generateQuizPDF(result)}
              className="w-full flex items-center justify-center gap-2 p-4 bg-faso-blue text-white font-bold rounded-xl"
            >
              <Download size={20} /> Télécharger le PDF corrigé
            </button>
            <button 
              onClick={resetToHome}
              className="w-full p-4 border-2 border-gray-200 dark:border-gray-800 font-bold rounded-xl dark:text-white"
            >
              Retour à l'accueil
            </button>
          </div>

          <div className="space-y-6 pt-8">
            <h3 className="text-xl font-bold border-b dark:border-gray-800 pb-2 dark:text-white">Correction détaillée</h3>
            {result.questions.map((q, idx) => (
              <div key={idx} className="space-y-2 p-4 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
                <div className="font-bold dark:text-white mb-2">
                  {idx + 1}. <MathRenderer text={q.text} />
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className={cn(
                      "p-2 rounded text-sm",
                      oIdx === q.correctAnswer ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400" : 
                      (oIdx === result.userAnswers[idx] ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400" : "bg-gray-50 dark:bg-gray-800 dark:text-gray-400")
                    )}>
                      <MathRenderer text={opt} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm dark:text-blue-300">
                  <span className="font-bold not-italic font-sans block mb-1">Explication :</span> 
                  <MathRenderer text={q.explanation} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-950">
        <div className="p-4 border-b dark:border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={resetToHome} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full dark:text-gray-400">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-4">
              <TimerCircle timeLeft={quizState.timeLeft} totalTime={currentQuiz.settings.timePerQuestion} isPaused={quizState.isPaused} />
              <button 
                onClick={() => setQuizState(prev => prev ? { ...prev, isPaused: !prev.isPaused } : null)}
                className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full dark:text-gray-400"
              >
                {quizState.isPaused ? <Play size={20} /> : <Pause size={20} />}
              </button>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Question</div>
              <div className="font-bold dark:text-white">{quizState.currentIndex + 1} / {currentQuiz.questions.length}</div>
            </div>
          </div>
          <ProgressBar progress={progress} color={currentQuiz.mode === 'Concours' ? 'bg-faso-green' : 'bg-faso-blue'} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-2 flex-1">
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                question.dimension === 'Intellectuelle' ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" :
                question.dimension === 'Morale' ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              )}>
                {question.dimension}
              </span>
              <h2 className="text-2xl font-bold leading-tight dark:text-white">
                <MathRenderer text={question.text} />
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                const subjectName = currentQuiz.subjects.join(', ');
                const isBookmarked = bookmarkedQuestions.some(q => q.text === question.text);
                if (isBookmarked) {
                  persistBookmarkedQuestions(bookmarkedQuestions.filter(q => q.text !== question.text));
                  playSound('wrong');
                } else {
                  const newQBookmark = { ...question, savedAt: new Date().toISOString(), subject: subjectName };
                  persistBookmarkedQuestions([...bookmarkedQuestions, newQBookmark]);
                  playSound('finish');
                }
              }}
              className={cn(
                "p-3 rounded-2xl border transition-all cursor-pointer shrink-0",
                bookmarkedQuestions.some(q => q.text === question.text)
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                  : "bg-gray-50 dark:bg-slate-900 border-gray-250 dark:border-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              )}
              title={bookmarkedQuestions.some(q => q.text === question.text) ? "Retirer de ma bibliothèque d'étude" : "Enregistrer dans ma bibliothèque d'étude"}
            >
              <Bookmark size={20} className={bookmarkedQuestions.some(q => q.text === question.text) ? "fill-current" : ""} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {question.options.map((option, idx) => {
              const isSelected = quizState.selectedOption === idx;
              const isCorrect = idx === question.correctAnswer;
              const showResult = quizState.showFeedback;

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(idx)}
                  disabled={showResult || quizState.isPaused}
                  className={cn(
                    "p-5 text-left rounded-2xl border-2 transition-all relative overflow-hidden",
                    !showResult && "hover:border-faso-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-[0.98] dark:border-gray-800 dark:text-gray-200",
                    !showResult && isSelected && "border-faso-blue bg-blue-50 dark:bg-blue-900/20",
                    showResult && isCorrect && "border-faso-green bg-green-50 dark:bg-green-900/20",
                    showResult && isSelected && !isCorrect && "border-faso-red bg-red-50 dark:bg-red-900/20",
                    showResult && !isSelected && !isCorrect && "opacity-50 border-gray-100 dark:border-gray-800"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 font-bold text-sm shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <div className="flex-1 font-medium text-left">
                      <MathRenderer text={option} />
                    </div>
                    {showResult && isCorrect && <CheckCircle2 className="text-faso-green shrink-0" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="text-faso-red" />}
                  </div>
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {quizState.showFeedback && currentQuiz.mode === 'Entraînement' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-3"
              >
                <h4 className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <BookOpen size={18} /> Explication pédagogique
                </h4>
                <div className="text-blue-900 dark:text-blue-100 leading-relaxed text-sm">
                  <MathRenderer text={question.explanation} />
                </div>
                <button 
                  onClick={() => nextQuestion()}
                  className="w-full p-4 bg-faso-blue text-white font-bold rounded-xl shadow-md"
                >
                  Question suivante
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {quizState.showFeedback && currentQuiz.mode !== 'Entraînement' && (
            <button 
              onClick={() => nextQuestion()}
              className="w-full p-4 bg-faso-blue text-white font-bold rounded-xl shadow-md"
            >
              Question suivante
            </button>
          )}
        </div>

        {quizState.isPaused && (
          <div className="absolute inset-0 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="text-center space-y-6">
              <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-full inline-block">
                <Pause size={48} className="text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold dark:text-white">Quiz en pause</h3>
              <button 
                onClick={() => setQuizState(prev => prev ? { ...prev, isPaused: false } : null)}
                className="px-8 py-4 bg-faso-green text-white font-bold rounded-2xl shadow-lg"
              >
                Reprendre le quiz
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold dark:text-white">Historique & Bibliothèque</h2>
        <HistoryIcon className="text-gray-400" />
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <BookOpen size={64} className="mx-auto text-gray-200 dark:text-gray-800" />
          <p className="text-gray-500 dark:text-gray-400">Aucun quiz sauvegardé pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((res) => (
            <div key={res.id} className="p-4 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg dark:text-white">{res.subjects.join(', ')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{res.date} • {res.level}</p>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  res.mode === 'Entraînement' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                  res.mode === 'Test' ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                )}>
                  {res.mode}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-faso-green">{res.score}</span>
                  <span className="text-gray-400">/ {res.totalQuestions}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setSubjects(res.subjects);
                      startQuiz(res.mode);
                    }}
                    className="p-2 text-faso-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    title="Générer un nouveau quiz avec ces sujets"
                  >
                    <Plus size={20} />
                  </button>
                  <button 
                    onClick={() => generateQuizPDF(res)}
                    className="p-2 text-faso-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                  >
                    <Download size={20} />
                  </button>
                  <button 
                    onClick={() => {
                      isFinishingRef.current = false;
                      setCurrentQuiz({
                        id: res.id,
                        questions: res.questions,
                        mode: res.mode,
                        settings: { ...settings, questionCount: res.totalQuestions },
                        subjects: res.subjects
                      });
                      setQuizState({
                        currentIndex: 0,
                        userAnswers: new Array(res.questions.length).fill(null),
                        timeLeft: res.mode === 'Entraînement' ? 119 : 117,
                        isPaused: false,
                        isFinished: false,
                        showFeedback: false,
                        selectedOption: null
                      });
                      setActiveTab(res.mode);
                    }}
                    className="p-2 text-faso-green hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                    title="Rejouer ce quiz"
                  >
                    <Play size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const handleCreateCustomCourse = async () => {
    if (isTrialExpired()) {
      setShowCheckoutModal(true);
      return;
    }
    if (!customCourseTopic.trim()) return;
    setIsGeneratingCourse(true);
    try {
      const newC = await generateCourse(customCourseTopic, selectedCourseLevel);
      const withId: CourseData = {
        ...newC,
        id: `course-custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        subject: customCourseTopic,
        level: selectedCourseLevel
      };
      setGeneratedCourses(prev => [withId, ...prev]);
      setSelectedCourse(withId);
      setActiveChapterIndex(0);
      setCustomCourseTopic('');
    } catch (e) {
      console.error(e);
      alert("Une erreur est survenue lors de la génération automatique du cours. Veuillez réessayer.");
    } finally {
      setIsGeneratingCourse(false);
    }
  };

  const handleGenerateCourseQuiz = async (course: CourseData) => {
    setIsGenerating(true);
    
    // Check previous questions to avoid repetitions
    const previousQuestions = history
      .flatMap(h => h.questions.map(q => q.text))
      .slice(0, 50);

    const questions = await generateQuizQuestions(
      [course.title, ...course.chapters.map(c => c.title)],
      {
        level: course.level,
        difficulty: 'Moyen',
        questionCount: 8,
        timePerQuestion: 120,
        soundEnabled: settings.soundEnabled,
      },
      previousQuestions
    );

    if (questions.length > 0) {
      const quizId = `res-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      isFinishingRef.current = false;
      
      const initialResult: QuizResult = {
        id: quizId,
        subjects: [course.title],
        date: new Date().toLocaleDateString('fr-FR'),
        level: course.level,
        score: 0,
        totalQuestions: questions.length,
        mode: 'Entraînement',
        questions,
        userAnswers: new Array(questions.length).fill(null)
      };
      
      setHistory(prev => [initialResult, ...prev]);
      setCurrentQuiz({
        id: quizId,
        questions,
        mode: 'Entraînement',
        settings: { ...settings, questionCount: questions.length, timePerQuestion: 120 },
        subjects: [course.title]
      });
      setQuizState({
        currentIndex: 0,
        userAnswers: new Array(questions.length).fill(null),
        timeLeft: 120,
        isPaused: false,
        isFinished: false,
        showFeedback: false,
        selectedOption: null
      });
      setActiveTab('Entraînement');
    }
    setIsGenerating(false);
  };

  const renderCourses = () => {
    // If a course is selected, render the Course Reader
    if (selectedCourse) {
      const chapter = selectedCourse.chapters[activeChapterIndex];
      return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Back Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b dark:border-gray-800 pb-4">
            <button 
              onClick={() => setSelectedCourse(null)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 font-bold hover:underline"
            >
              <ArrowLeft size={18} /> Retour à l'Académie
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => generateCoursePDF(selectedCourse)}
                className="flex items-center gap-1.5 px-4 py-2 bg-faso-blue hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
              >
                <Download size={14} /> Télécharger le polycopié PDF
              </button>
              <button
                onClick={() => handleGenerateCourseQuiz(selectedCourse)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-4 py-2 bg-faso-green hover:bg-green-600 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <BookOpenCheck size={14} />
                )}
                S'évaluer sur le cours (QCM)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left sidebar: Chapters index list */}
            <div className="lg:col-span-4 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-4 space-y-3">
              <div className="px-2">
                <span className="text-[10px] font-bold text-faso-blue uppercase tracking-wider">{selectedCourse.category}</span>
                <h3 className="font-bold text-md dark:text-white leading-snug">{selectedCourse.title}</h3>
                <p className="text-xs text-gray-500 mt-1">Niveau : {selectedCourse.level}</p>
              </div>
              <div className="border-t dark:border-gray-800 my-2 pt-2 space-y-1">
                {selectedCourse.chapters.map((ch, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveChapterIndex(idx)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl font-medium text-sm transition-all flex items-center justify-between",
                      activeChapterIndex === idx 
                        ? "bg-faso-blue/10 text-faso-blue border-l-4 border-faso-blue" 
                        : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    )}
                  >
                    <span>Chapitre {idx + 1} : {ch.title}</span>
                    <ChevronRight size={14} className="shrink-0 ml-2 animate-pulse" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right block: Chapter reader content */}
            <div className="lg:col-span-8 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <span className="px-2.5 py-1 bg-faso-blue/10 text-faso-blue rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Chapitre {activeChapterIndex + 1} / {selectedCourse.chapters.length}
                </span>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                  {chapter.title}
                </h2>
              </div>

              {/* Course Chapter Text Content Renderer */}
              <div className="prose prose-blue dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed space-y-4">
                {chapter.content.split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx}>
                    <MathRenderer text={paragraph} />
                  </p>
                ))}
              </div>

              {/* Chapter Footer Navigation */}
              <div className="flex justify-between items-center pt-6 border-t dark:border-gray-800">
                <button
                  onClick={() => setActiveChapterIndex(prev => Math.max(0, prev - 1))}
                  disabled={activeChapterIndex === 0}
                  className="px-4 py-2 border dark:border-gray-800 text-sm font-semibold rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-all"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setActiveChapterIndex(prev => Math.min(selectedCourse.chapters.length - 1, prev + 1))}
                  disabled={activeChapterIndex === selectedCourse.chapters.length - 1}
                  className="px-4 py-2 bg-faso-blue text-white text-sm font-bold rounded-xl hover:bg-blue-600 disabled:opacity-30 transition-all"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Main Courses Listing and Creation Interface
    const allCourses = [...precompiledCourses, ...generatedCourses];
    const filteredCourses = courseCategoryFilter === 'Tous' 
      ? allCourses 
      : courseCategoryFilter === 'Personnalisés' 
        ? generatedCourses 
        : allCourses.filter(c => c.category === courseCategoryFilter);

    return (
      <div className="p-6 space-y-8 max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-faso-green/10 rounded-full text-faso-green">
            <BookOpen size={36} />
          </div>
          <h2 className="text-3xl font-black dark:text-white tracking-tight">Académie & Cours de Préparation</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Étudiez les théories fondamentales, les formules et les modèles nécessaires aux concours d'État du Burkina Faso.
          </p>
        </div>

        {/* Dynamic AI Course Creator */}
        <div className="bg-gradient-to-tr from-faso-blue/5 via-transparent to-faso-green/5 border border-faso-blue/20 rounded-3xl p-6 space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 opacity-10">
            <Sparkles size={120} className="text-faso-blue" />
          </div>
          <div className="space-y-1 relative">
            <div className="flex items-center gap-2 text-faso-blue font-bold text-xs uppercase tracking-wider">
              <Sparkles size={14} className="animate-pulse" />
              Générateur de Cours Autonome (IA)
            </div>
            <h3 className="font-bold text-lg dark:text-white">Vous préparez un concours sur mesure ?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Saisissez un sujet précis de microéconomie, macroéconomie, statistiques, droit public, fiscalité nationale ou mathématiques financières. L'IA générera un cours universitaire structuré intégrant de rigoureuses formules LaTeX de qualité.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 pt-2">
            <input
              type="text"
              value={customCourseTopic}
              onChange={(e) => setCustomCourseTopic(e.target.value)}
              placeholder="Ex: Équilibre de Nash, Comptabilité Générale, Politiques Publiques de l'UEMOA..."
              className="flex-1 p-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 rounded-xl outline-none focus:ring-2 focus:ring-faso-blue focus:border-transparent dark:text-white text-sm"
              disabled={isGeneratingCourse}
            />
            <div className="flex gap-2">
              <select
                value={selectedCourseLevel}
                onChange={(e) => setSelectedCourseLevel(e.target.value as Level)}
                className="p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-sm dark:text-white"
                disabled={isGeneratingCourse}
              >
                <option value="Licence">Licence</option>
                <option value="Master">Master</option>
                <option value="Premier cycle">Premier cycle</option>
              </select>
              <button
                onClick={handleCreateCustomCourse}
                disabled={isGeneratingCourse || !customCourseTopic.trim()}
                className="px-5 py-3 bg-faso-blue hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 shrink-0"
              >
                {isGeneratingCourse ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Curation en cours...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Générer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Library Filters */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-xl dark:text-white flex items-center gap-2 flex-wrap">
              <FileText size={20} className="text-faso-green" />
              Bibliothèque de Cours
            </h3>
            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold px-2.5 py-1 rounded-full">{filteredCourses.length} disponibles</span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {(['Tous', 'Microéconomie', 'Macroéconomie', 'Statistiques', 'Personnalisés'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCourseCategoryFilter(cat)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border",
                  courseCategoryFilter === cat 
                    ? "bg-faso-green text-white border-faso-green shadow-xs" 
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Cards list */}
          {filteredCourses.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-800 p-8 rounded-2xl">
              <BookOpen size={40} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Aucun cours trouvé dans cette catégorie.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCourses.map((course) => (
                <div 
                  key={course.id}
                  className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider",
                        course.category === 'Microéconomie' ? "bg-yellow-105 text-yellow-700 dark:bg-yellow-950/20" :
                        course.category === 'Macroéconomie' ? "bg-blue-105 text-blue-700 dark:bg-blue-950/20" :
                        course.category === 'Statistiques' ? "bg-green-105 text-green-700 dark:bg-green-950/20" : "bg-purple-105 text-purple-700 dark:bg-purple-950/20"
                      )}>
                        {course.category}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">{course.level}</span>
                    </div>
                    <h4 className="font-bold text-base dark:text-white leading-tight">{course.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mt-1">
                      {course.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t dark:border-gray-800 mt-4 pt-3 text-xs">
                    <span className="text-gray-400 font-semibold">{course.chapters.length} chapitres</span>
                    <button
                      onClick={() => {
                        setSelectedCourse(course);
                        setActiveChapterIndex(0);
                      }}
                      className="flex items-center gap-1 text-faso-blue font-bold hover:underline"
                    >
                      Commencer à étudier <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleLikePost = (postId: string) => {
    setForumPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, upvotes: p.upvotes + 1 };
      }
      return p;
    }));
  };

  const handleLikeReply = (postId: string, replyId: string) => {
    setForumPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          replies: p.replies.map(r => r.id === replyId ? { ...r, upvotes: r.upvotes + 1 } : r)
        };
      }
      return p;
    }));
  };

  const handleCreateThread = async () => {
    if (!newThreadTitle.trim() || !newThreadContent.trim()) return;
    const authorName = newThreadAuthor.trim() || 'Candidat Anonyme';
    
    setIsCreatingThread(true);
    
    const newPost: ForumPost = {
      id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: newThreadTitle,
      author: authorName,
      authorRole: 'Vous',
      category: newThreadCategory,
      content: newThreadContent,
      date: new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }) + " à 12:00",
      upvotes: 1,
      views: 1,
      replies: []
    };

    let updatedReplies: ForumReply[] = [];
    if (askAIAfterCreation) {
      try {
        const aiAnswer = await generateForumAIResponse(newThreadTitle, newThreadContent);
        updatedReplies.push({
          id: `reply-ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          author: 'Professeur Émérite (IA)',
          authorRole: 'Expert',
          content: aiAnswer,
          date: new Date().toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }) + " à 12:01",
          upvotes: 4
        });
      } catch (err) {
        console.error("AI comment generation failed", err);
      }
    }

    newPost.replies = updatedReplies;
    
    setForumPosts(prev => [newPost, ...prev]);
    setSelectedPostId(newPost.id);
    
    // Clear forms
    setNewThreadTitle('');
    setNewThreadContent('');
    setNewThreadAuthor('');
    setAskAIAfterCreation(false);
    setIsCreatingThread(false);
  };

  const handleAddComment = () => {
    if (!selectedPostId || !newCommentContent.trim()) return;
    const authorName = newCommentAuthor.trim() || 'Candidat';
    
    const newReply: ForumReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      author: authorName,
      authorRole: 'Vous',
      content: newCommentContent,
      date: new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }) + " à l'instant",
      upvotes: 0
    };

    setForumPosts(prev => prev.map(p => {
      if (p.id === selectedPostId) {
        return {
          ...p,
          replies: [...p.replies, newReply]
        };
      }
      return p;
    }));

    setNewCommentContent('');
    setNewCommentAuthor('');
  };

  const handleRequestAIComment = async () => {
    if (isTrialExpired()) {
      setShowCheckoutModal(true);
      return;
    }
    if (!selectedPostId) return;
    const post = forumPosts.find(p => p.id === selectedPostId);
    if (!post) return;

    setIsGeneratingAIComment(true);
    try {
      const aiReplyText = await generateForumAIResponse(post.title, post.content);
      const aiReply: ForumReply = {
        id: `reply-ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        author: 'Professeur Émérite (IA)',
        authorRole: 'Expert',
        content: aiReplyText,
        date: new Date().toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }) + " à l'instant",
        upvotes: 2
      };

      setForumPosts(prev => prev.map(p => {
        if (p.id === selectedPostId) {
          return {
            ...p,
            replies: [...p.replies, aiReply]
          };
        }
        return p;
      }));
    } catch (err) {
      console.error(err);
      alert("Une erreur est survenue lors de l'appel à l'IA d'apprentissage.");
    } finally {
      setIsGeneratingAIComment(false);
    }
  };

  const renderForum = () => {
    // If a specific thread is selected, show discussion details
    if (selectedPostId) {
      const post = forumPosts.find(p => p.id === selectedPostId);
      if (!post) {
        setSelectedPostId(null);
        return null;
      }

      return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <button 
            onClick={() => setSelectedPostId(null)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 font-bold hover:underline mb-2"
          >
            <ArrowLeft size={18} /> Retour aux discussions
          </button>

          {/* Original Post */}
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs relative">
            {post.isPinned && (
              <div className="absolute top-4 right-4 text-amber-500 flex items-center gap-1 text-[10px] font-bold">
                <Pin size={12} /> Épinglé
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider",
                post.category === 'Économie' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20" :
                post.category === 'Mathématiques' ? "bg-blue-100 text-blue-800 dark:bg-blue-950/20" :
                post.category === 'Statistiques' ? "bg-purple-105 text-purple-700 dark:bg-purple-950/20" :
                post.category === 'Conseils de révision' ? "bg-orange-100 text-orange-800 dark:bg-orange-950/20" : "bg-gray-100 text-gray-700"
              )}>
                {post.category}
              </span>
              <span className="text-xs text-gray-400 font-medium">{post.date}</span>
            </div>

            <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
              <MathRenderer text={post.title} />
            </h2>

            <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-sm whitespace-pre-wrap pt-2">
              {post.content.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="mb-3">
                  <MathRenderer text={paragraph} />
                </p>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t dark:border-gray-800 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-faso-blue/10 flex items-center justify-center font-bold text-faso-blue text-xs uppercase">
                  {post.author.slice(0, 2)}
                </div>
                <div>
                  <span className="font-extrabold dark:text-white block">{post.author}</span>
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase",
                    post.authorRole === 'Modérateur' ? "bg-red-100 text-red-700" :
                    post.authorRole === 'Expert' ? "bg-blue-100 text-blue-700" :
                    post.authorRole === 'Vous' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  )}>{post.authorRole}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleLikePost(post.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl transition-all"
                >
                  <ThumbsUp size={13} />
                  <span>{post.upvotes}</span>
                </button>
                <span className="flex items-center gap-1 text-gray-400">
                  <Eye size={13} />
                  <span>{post.views}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="border-t dark:border-gray-800 pt-4" />

          {/* AI Helper banner inside thread */}
          <div className="bg-gradient-to-tr from-faso-green/10 via-transparent to-faso-blue/5 border border-faso-green/20 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-faso-green/10 text-faso-green rounded-full shrink-0">
                <Sparkles size={20} className="animate-spin-slow" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm dark:text-white">Besoin d'une explication académique instantanée ?</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Faites appel à notre modèle de raisonnement IA. Il va résoudre d'un seul clic les mathématiques, l'économie ou les théories avancées demandées dans ce sujet.
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestAIComment}
              disabled={isGeneratingAIComment}
              className="w-full sm:w-auto px-4 py-2 bg-faso-green text-white font-bold text-xs rounded-xl hover:bg-green-600 transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              {isGeneratingAIComment ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Rédaction de l'explication...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Interroger l'Expert IA
                </>
              )}
            </button>
          </div>

          {/* Comments list */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-lg dark:text-white flex items-center gap-2">
              <MessageSquare size={18} className="text-faso-blue" />
              {post.replies.length} contribution{post.replies.length > 1 ? 's' : ''}
            </h3>

            {post.replies.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 border border-dashed rounded-2xl text-gray-400 text-sm">
                Soyez le premier à ajouter une contribution claire à ce sujet de révision !
              </div>
            ) : (
              <div className="space-y-3">
                {post.replies.map((reply) => (
                  <div key={reply.id} className="bg-white dark:bg-gray-900 border dark:border-gray-800 p-5 rounded-2xl space-y-3 relative shadow-xs">
                    <div className="flex items-center justify-between text-xs pb-2 border-b dark:border-gray-800/50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-[10px] uppercase">
                          {reply.author.slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-extrabold dark:text-white">{reply.author}</span>
                          <span className={cn(
                            "ml-2 text-[8px] font-bold px-1.5 py-0.1 rounded-full uppercase tracking-wider",
                            reply.authorRole === 'Expert' ? "bg-amber-100 text-amber-800" :
                            reply.authorRole === 'Vous' ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                          )}>{reply.authorRole}</span>
                        </div>
                      </div>
                      <span className="text-gray-400 font-medium">{reply.date}</span>
                    </div>

                    <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-sm whitespace-pre-wrap">
                      {reply.content.split('\n\n').map((par, pIdx) => (
                        <p key={pIdx} className="mb-2">
                          <MathRenderer text={par} />
                        </p>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => handleLikeReply(post.id, reply.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 hover:text-faso-blue rounded-lg transition-all text-gray-500"
                      >
                        <ThumbsUp size={11} />
                        <span>{reply.upvotes}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add a reply form */}
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-5 space-y-4 shadow-sm">
            <h4 className="font-bold text-sm dark:text-white mb-2 flex items-center gap-2">
              <Send size={14} className="text-faso-blue" />
              Ajouter votre contribution
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Votre nom/pseudonyme d'étudiant"
                value={newCommentAuthor}
                onChange={(e) => setNewCommentAuthor(e.target.value)}
                className="p-3 border rounded-xl outline-none focus:ring-1.5 focus:ring-faso-blue dark:bg-gray-950 dark:border-gray-800 text-xs dark:text-white"
              />
            </div>

            <textarea
              placeholder="Écrivez votre réponse argumentée ou vos calculs. Vous pouvez inclure des équations au format standard LaTeX comme $ y = f(x) $ ou des blocs centrés $$ x^2 + y^2 = r^2 $$."
              rows={4}
              value={newCommentContent}
              onChange={(e) => setNewCommentContent(e.target.value)}
              className="w-full p-4 border rounded-xl outline-none focus:ring-1.5 focus:ring-faso-blue dark:bg-gray-950 dark:border-gray-800 text-sm dark:text-white"
            />

            <button
              onClick={handleAddComment}
              disabled={!newCommentContent.trim()}
              className="w-full px-5 py-3 bg-faso-blue hover:bg-blue-600 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              Publier ma contribution
            </button>
          </div>
        </div>
      );
    }

    // Main Forum List view
    const filteredPosts = forumPosts.filter(post => {
      const matchCategory = forumCategoryFilter === 'Tous' || post.category === forumCategoryFilter;
      const matchSearch = post.title.toLowerCase().includes(forumSearchQuery.toLowerCase()) || 
                          post.content.toLowerCase().includes(forumSearchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });

    // Sort to put Pinned posts first
    const sortedPosts = [...filteredPosts].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.upvotes - a.upvotes; // then sort by upvotes
    });

    return (
      <div className="p-6 space-y-8 max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-faso-blue/10 rounded-full text-faso-blue">
            <Users size={36} />
          </div>
          <h2 className="text-3xl font-black dark:text-white tracking-tight">Forum d'Entraide & Peer-learning</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Discutez des sujets des concours, posez des questions de révision, déposez des équations et apprenez ensemble !
          </p>
        </div>

        {/* Categories Bar & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b dark:border-gray-800 pb-4">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none max-w-full">
            {(['Tous', 'Économie', 'Mathématiques', 'Statistiques', 'Conseils de révision', 'Infos Concours'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setForumCategoryFilter(cat)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border",
                  forumCategoryFilter === cat 
                    ? "bg-faso-blue text-white border-faso-blue shadow-xs" 
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsCreatingThread(!isCreatingThread)}
            className="px-4 py-2 bg-faso-green hover:bg-green-600 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            {isCreatingThread ? <X size={14} /> : <Plus size={14} />}
            {isCreatingThread ? "Fermer le formulaire" : "Lancer un débat / Poser une question"}
          </button>
        </div>

        {/* Thread creation block */}
        <AnimatePresence>
          {isCreatingThread && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-6 space-y-4 shadow-sm overflow-hidden"
            >
              <h3 className="font-extrabold text-base dark:text-white">Créer un nouveau sujet de débat</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Catégorie</label>
                  <select
                    value={newThreadCategory}
                    onChange={(e) => setNewThreadCategory(e.target.value as any)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-950 border dark:border-gray-800 rounded-xl outline-none text-xs dark:text-white"
                  >
                    <option value="Économie">Économie</option>
                    <option value="Mathématiques">Mathématiques</option>
                    <option value="Statistiques">Statistiques</option>
                    <option value="Conseils de révision">Conseils de révision</option>
                    <option value="Général">Général</option>
                    <option value="Infos Concours">Infos Concours</option>
                  </select>
                </div>
                
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase font-sans">Votre nom d'étudiant</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Ibrahim Sawadogo"
                    value={newThreadAuthor}
                    onChange={(e) => setNewThreadAuthor(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-950 border dark:border-gray-800 rounded-xl outline-none text-xs dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Sujet de discussion</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Comment calculer l'équilibre macroéconomique de Solow ?"
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-950 border dark:border-gray-800 rounded-xl outline-none text-sm dark:text-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Description / Problème (LaTeX accepté)</label>
                <textarea
                  required
                  placeholder="Décrivez votre question de manière détaillée ou partagez un conseil de révision clé avec des équations. Exemple: la fonction de Cobb-Douglas $Y = A K^\\alpha L^\\beta$"
                  rows={5}
                  value={newThreadContent}
                  onChange={(e) => setNewThreadContent(e.target.value)}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-950 border dark:border-gray-800 rounded-xl outline-none text-sm dark:text-white"
                />
              </div>

              {/* Dynamic expert companion check */}
              <label className="flex items-center gap-2 p-3 bg-faso-blue/5 border border-faso-blue/10 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={askAIAfterCreation}
                  onChange={(e) => setAskAIAfterCreation(e.target.checked)}
                  className="rounded text-faso-blue focus:ring-faso-blue"
                />
                <div className="text-xs">
                  <span className="font-bold dark:text-white block flex items-center gap-1.5 text-faso-blue">
                    <Sparkles size={12} />
                    Activer l'explication instantanée par l'IA d'apprentissage (Professeur IA)
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    L'IA va automatiquement analyser votre question et déposer sa contribution d'expert directement après la publication !
                  </p>
                </div>
              </label>

              <button
                onClick={handleCreateThread}
                disabled={!newThreadTitle.trim() || !newThreadContent.trim()}
                className="w-full py-3 bg-faso-blue hover:bg-blue-600 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isCreatingThread && askAIAfterCreation ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Création du sujet et rédaction de la réponse de l'IA...
                  </>
                ) : (
                  <>
                    <ShareIcon size={14} />
                    Publier le sujet dans la communauté
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Discussion listing block and search */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher une question ou un terme de révision (ex: Keynes, variance, UEMOA)..."
              value={forumSearchQuery}
              onChange={(e) => setForumSearchQuery(e.target.value)}
              className="w-full p-3.5 pl-10 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl outline-none focus:ring-1.5 focus:ring-faso-blue dark:text-white text-xs shadow-xs"
            />
            <div className="absolute left-3.5 top-4.5 text-gray-400">
              <SearchIcon size={14} />
            </div>
            {forumSearchQuery && (
              <button 
                onClick={() => setForumSearchQuery('')}
                className="absolute right-3.5 top-3 p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs"
              >
                Effacer
              </button>
            )}
          </div>

          {sortedPosts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-10">
              <Users size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="font-bold dark:text-white text-base">Aucun sujet trouvé</p>
              <p className="text-xs text-gray-400 mt-1">N'hésitez pas à poser vous-même votre première question sur ce sujet ! Spécifiez les équations LaTeX si nécessaires de sorte à obtenir des réponses rigoureuses de l'IA ou de vos pairs.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post) => (
                <div 
                  key={post.id}
                  onClick={() => {
                    setSelectedPostId(post.id);
                    // Add standard view increments slightly
                    setForumPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: p.views + 1 } : p));
                  }}
                  className={cn(
                    "bg-white dark:bg-gray-900 border rounded-3xl p-6 shadow-xs hover:shadow-md hover:scale-[1.005] transition-all cursor-pointer flex flex-col justify-between space-y-4 relative",
                    post.isPinned ? "border-amber-200 dark:border-amber-900/30" : "dark:border-gray-800"
                  )}
                >
                  {post.isPinned && (
                    <div className="absolute top-6 right-6 text-amber-500 flex items-center gap-1 text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full">
                      <Pin size={10} /> Épinglé
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider",
                        post.category === 'Économie' ? "bg-emerald-100/75 text-emerald-800 dark:bg-emerald-950/20" :
                        post.category === 'Mathématiques' ? "bg-blue-105 text-blue-700 dark:bg-blue-950/20" :
                        post.category === 'Statistiques' ? "bg-purple-105 text-purple-700 dark:bg-purple-950/20" :
                        post.category === 'Conseils de révision' ? "bg-orange-100 text-orange-805 dark:bg-orange-950/20" : "bg-gray-100/75 text-gray-700"
                      )}>
                        {post.category}
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold">{post.date}</span>
                    </div>

                    <h4 className="font-extrabold text-lg dark:text-white leading-tight">
                      <MathRenderer text={post.title} />
                    </h4>

                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">
                      <MathRenderer text={post.content} />
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t dark:border-gray-800/60 pt-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-400">
                        {post.author.slice(0, 2)}
                      </div>
                      <span className="text-gray-500 font-bold">{post.author}</span>
                      <span className="text-[9px] text-gray-400">({post.authorRole})</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-gray-400">
                        <ThumbsUp size={11} />
                        <span>{post.upvotes}</span>
                      </span>
                      <span className="flex items-center gap-1 text-gray-400">
                        <MessageSquare size={11} />
                        <span>{post.replies.length} réponse{post.replies.length > 1 ? 's' : ''}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regLevel, setRegLevel] = useState<Level>('Licence');
  const [regSimTime, setRegSimTime] = useState<'normal' | 'expired'>('normal');

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) return;

    const date = new Date();
    if (regSimTime === 'expired') {
      date.setDate(date.getDate() - 8);
    }
    
    setProfile({
      registered: true,
      name: regName.trim(),
      email: regEmail.trim(),
      level: regLevel,
      registrationDate: date.toISOString(),
      isPremium: false,
      simulatedTimeShiftDays: 0
    });

    playSound('finish');
  };

  const renderRegistration = () => {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-faso-green/10 rounded-full filter blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-faso-blue/10 rounded-full filter blur-[100px]" />

        <div className="w-full max-w-lg bg-slate-950/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 relative z-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-faso-green to-faso-blue rounded-2xl flex items-center justify-center shadow-md mx-auto mb-4">
              <span className="text-white font-black text-3xl">F</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-faso-green via-faso-yellow to-faso-blue bg-clip-text text-transparent">
              ReFaso Educ
            </h1>
            <p className="text-xs text-gray-400 mt-2 font-medium uppercase tracking-wider">
              Portail de Révisions & Concours d'Élite
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 mb-6 text-xs text-gray-300 space-y-2 leading-relaxed">
            <p className="font-semibold text-faso-blue flex items-center gap-1 text-sm bg-gradient-to-r from-faso-green via-faso-yellow to-faso-blue bg-clip-text text-transparent underline decoration-faso-blue/30 text-start font-black">
              ✨ Votre Port d'Inscription Académique
            </p>
            <p className="text-start">
              Inscrivez-vous instantanément pour bénéficier d'une <strong>période d'essai gratuite de 7 jours</strong>. Accédez à la génération automatique de quiz intelligents, à l'arène de compétition, et aux fiches récapitulatives d'élite.
            </p>
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-5 text-start">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                Nom complet
              </label>
              <input
                type="text"
                required
                placeholder="Ex. Ibrahim Sawadogo"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl focus:border-faso-blue outline-none text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                Adresse Email
              </label>
              <input
                type="email"
                required
                placeholder="votre.nom@compte.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl focus:border-faso-blue outline-none text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider text-ellipsis overflow-hidden">
                  Niveau Académique
                </label>
                <select
                  value={regLevel}
                  onChange={(e) => setRegLevel(e.target.value as Level)}
                  className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl focus:border-faso-blue outline-none text-xs text-white"
                >
                  <option value="Premier cycle">Premier cycle</option>
                  <option value="Licence">Licence</option>
                  <option value="Master">Master</option>
                  <option value="Doctorat">Doctorat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                  Test & Simulation
                </label>
                <select
                  value={regSimTime}
                  onChange={(e) => setRegSimTime(e.target.value as 'normal' | 'expired')}
                  className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl focus:border-faso-blue outline-none text-xs text-amber-400 font-extrabold"
                >
                  <option value="normal">Essai actif (7 jours)</option>
                  <option value="expired">Déjà expiré (8 jours avant)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4.5 bg-gradient-to-r from-faso-green via-faso-yellow to-faso-blue font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] mt-2 cursor-pointer text-sm text-slate-950 font-black uppercase tracking-wider"
            >
              Créer mon compte & Débuter l'essai
            </button>
          </form>

          <div className="mt-6 text-center text-[10px] text-gray-500 font-medium">
            En continuant, vous acceptez d'alimenter votre intellect avec notre IA générative d'excellence. Référentiels d'examens officiels du Burkina Faso et de la sous-région UEMOA.
          </div>
        </div>
      </div>
    );
  };

  const [checkoutStep, setCheckoutStep] = useState<'info' | 'payment_form' | 'manual_form' | 'manual_confirmation' | 'processing' | 'success'>('info');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [selectedMethod, setSelectedMethod] = useState<'orange' | 'moov' | 'wave' | 'card'>('orange');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Manual payment states
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualReference, setManualReference] = useState('');
  const [manualAmount, setManualAmount] = useState<number>(2500);
  const [manualOperator, setManualOperator] = useState<'orange' | 'moov' | 'wave'>('orange');

  // Admin access state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminModalTab, setAdminModalTab] = useState<'transactions' | 'emails' | 'banList'>('transactions');
  const [paymentAlertMessage, setPaymentAlertMessage] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // --- Personal Space / Library States (Scale-ready, keyed dynamically by active user email) ---
  const [savedVideos, setSavedVideos] = useState<{ id: string; title: string; url: string; duration: string; category: string; savedAt: string; isCustom?: boolean }[]>([]);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<(Question & { savedAt: string; subject: string })[]>([]);
  
  // Custom states for editing profile in Espace
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfileTargetExam, setEditProfileTargetExam] = useState('');
  const [editProfileRegion, setEditProfileRegion] = useState('');
  const [editProfileAvatar, setEditProfileAvatar] = useState('👨‍🎓');

  // List of precompiled/suggested Burkina Faso study tutorials
  const [precompiledVideos] = useState([
    {
      id: "vid-bf-1",
      title: "Finances Publiques du Burkina Faso : Principes et Budget de l'État (LOLF)",
      url: "https://www.youtube.com/watch?v=0_uE-O16n-k",
      duration: "45 min",
      category: "Droit & Administration"
    },
    {
      id: "vid-bf-2",
      title: "Dissertation Littéraire aux concours : Trucs pour avoir 18/20 à l'ENA",
      url: "https://www.youtube.com/watch?v=F07_q8R27kU",
      duration: "30 min",
      category: "Culture Générale"
    },
    {
      id: "vid-bf-3",
      title: "Tests Psychotechniques : Secrets de calcul de l'ENAREF et du Trésor",
      url: "https://www.youtube.com/watch?v=R9K1uM5-6X0",
      duration: "52 min",
      category: "Tests de Logique"
    },
    {
      id: "vid-bf-4",
      title: "Histoire-Géographie du Faso : Des indépendances à la Révolution de 1983",
      url: "https://www.youtube.com/watch?v=vV7-q-qf31E",
      duration: "40 min",
      category: "Histoire & Géo"
    },
    {
      id: "vid-bf-5",
      title: "Culture Générale : Les symboles nationaux et le constitutionnalisme burkinabè",
      url: "https://www.youtube.com/watch?v=9_D1aW-9BNo",
      duration: "35 min",
      category: "Culture Générale"
    }
  ]);

  // Form states for adding custom external video
  const [showAddVideoForm, setShowAddVideoForm] = useState(false);
  const [customVideoTitle, setCustomVideoTitle] = useState('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [customVideoDuration, setCustomVideoDuration] = useState('15 min');
  const [customVideoCategory, setCustomVideoCategory] = useState('Culture Générale');

  // Sub-navigation inside Personal Space
  const [espaceTab, setEspaceTab] = useState<'profile' | 'videos' | 'questions' | 'history'>('profile');

  // Dynamic user-scoped data synchronizer (for multi-user support & extreme scaling)
  useEffect(() => {
    if (profile.registered && profile.email) {
      const emailScope = profile.email.trim().toLowerCase();
      
      // Load saved videos
      const localVids = localStorage.getItem(`faso_educ_saved_vids_${emailScope}`);
      if (localVids) {
        try { setSavedVideos(JSON.parse(localVids)); } catch { setSavedVideos([]); }
      } else {
        setSavedVideos([]);
      }

      // Load bookmarked questions
      const localQuest = localStorage.getItem(`faso_educ_bookmarked_questions_${emailScope}`);
      if (localQuest) {
        try { setBookmarkedQuestions(JSON.parse(localQuest)); } catch { setBookmarkedQuestions([]); }
      } else {
        setBookmarkedQuestions([]);
      }

      // Setup inputs
      setEditProfileName(profile.name || '');
      setEditProfileTargetExam(profile.targetExam || 'Concours d\'Élite');
      setEditProfileRegion(profile.regionName || 'Centre (Ouagadougou)');
      setEditProfileAvatar(profile.avatar || '👨‍🎓');
    }
  }, [profile.email, profile.registered, profile.name, profile.targetExam, profile.regionName, profile.avatar]);

  // Persists changes to the current user's isolated video folder
  const persistSavedVideos = (updated: typeof savedVideos) => {
    setSavedVideos(updated);
    if (profile.email) {
      const emailScope = profile.email.trim().toLowerCase();
      localStorage.setItem(`faso_educ_saved_vids_${emailScope}`, JSON.stringify(updated));
    }
  };

  // Persists changes to the current user's isolated question bank
  const persistBookmarkedQuestions = (updated: typeof bookmarkedQuestions) => {
    setBookmarkedQuestions(updated);
    if (profile.email) {
      const emailScope = profile.email.trim().toLowerCase();
      localStorage.setItem(`faso_educ_bookmarked_questions_${emailScope}`, JSON.stringify(updated));
    }
  };

  const handleCopyText = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2505);
    } catch {
      // ignore
    }
  };

  // Formateur de date ultra-sécurisé pour éviter tout crash de rendu
  const safeFormatDate = (dateStr?: string, isFull: boolean = false) => {
    if (!dateStr) return "Date non disponible";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Format date inconnu";
      if (isFull) {
        return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR')}`;
      }
      return d.toLocaleString('fr-FR');
    } catch {
      return dateStr || "Date non disponible";
    }
  };

  const [manualPayments, setManualPayments] = useState<ManualPaymentTx[]>(() => {
    const saved = localStorage.getItem('faso_educ_manual_payments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((tx: any) => ({
            id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            userEmail: tx.userEmail || '',
            userName: tx.userName || 'Candidat Anonyme',
            operator: tx.operator || 'orange',
            phone: tx.phone || '',
            amount: typeof tx.amount === 'number' ? tx.amount : 2500,
            reference: tx.reference || '',
            date: tx.date || new Date().toISOString(),
            status: tx.status || 'pending'
          }));
        }
      } catch {
        return [];
      }
    }
    return [];
  });

  // Synchronise automatiquement le statut Premium de l'utilisateur avec ses paiements validés
  useEffect(() => {
    if (profile.email) {
      const hasApprovedTx = manualPayments.some(tx => 
        tx.userEmail.trim().toLowerCase() === profile.email.trim().toLowerCase() && 
        tx.status === 'approved'
      );
      if (hasApprovedTx && !profile.isPremium) {
        setProfile(prev => ({ ...prev, isPremium: true }));
      }
    }
  }, [manualPayments, profile.email, profile.isPremium]);

  // Watch for plan changes to automatically sync the manual amount
  useEffect(() => {
    setManualAmount(selectedPlan === 'monthly' ? 2500 : 15000);
  }, [selectedPlan]);

  // Persist manual payments of Faso Educ
  useEffect(() => {
    localStorage.setItem('faso_educ_manual_payments', JSON.stringify(manualPayments));
  }, [manualPayments]);

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutStep('processing');
    
    setTimeout(() => {
      setCheckoutStep('success');
      playSound('finish');
      setProfile(prev => ({ ...prev, isPremium: true }));
    }, 2500);
  };

  const handleManualPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim() || !manualName.trim() || !manualReference.trim()) return;

    const newTx: ManualPaymentTx = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userEmail: profile.email,
      userName: profile.name,
      operator: manualOperator,
      phone: manualPhone.trim(),
      amount: manualAmount,
      reference: manualReference.trim().toUpperCase(),
      date: new Date().toISOString(),
      status: 'pending'
    };

    setManualPayments(prev => [newTx, ...prev]);
    
    // Server synchronization
    fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx: newTx })
    }).then(res => {
      if (!res.ok) console.warn("Could not synchronize payment declaration on server.");
    }).catch(err => {
      console.warn("Server connection offline for payment sync:", err);
    });

    playSound('finish');
    setCheckoutStep('manual_confirmation');
  };


  const renderCheckoutModal = () => {
    return (
      <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-md">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-left relative text-white">
          
          {/* Header Banner */}
          <div className="relative p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black bg-gradient-to-r from-faso-green to-faso-blue bg-clip-text text-transparent">
                Abonnement Elite Premium
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Investissez dans votre succès académique
              </p>
            </div>
            {checkoutStep !== 'processing' && (
              <button 
                onClick={() => {
                  setShowCheckoutModal(false);
                  setCheckoutStep('info');
                }}
                className="p-2 hover:bg-slate-800 rounded-full text-gray-400 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="p-6">
            {checkoutStep === 'info' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-widest mb-3">
                    Avantages exclusifs du compte Premium :
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex gap-2.5 p-3 rounded-xl bg-slate-950/45 border border-slate-800/60">
                      <Sparkles className="text-faso-green shrink-0 mt-0.5 animate-pulse" size={16} />
                      <div>
                        <strong className="text-white block">Quizz Génératifs Infinis</strong>
                        <span className="text-gray-400">Aucune limitation sur la quantité de sujets générés par l'IA Gemini.</span>
                      </div>
                    </div>
                    <div className="flex gap-2.5 p-3 rounded-xl bg-slate-950/45 border border-slate-800/60">
                      <BookOpenCheck className="text-faso-blue shrink-0 mt-0.5" size={16} />
                      <div>
                        <strong className="text-white block">Cours d'Elite Complets</strong>
                        <span className="text-gray-400">Export PDF instantané de toutes les fiches récapitulatives et cours structurés.</span>
                      </div>
                    </div>
                    <div className="flex gap-2.5 p-3 rounded-xl bg-slate-950/45 border border-slate-800/60">
                      <MessageSquare className="text-faso-yellow shrink-0 mt-0.5" size={16} />
                      <div>
                        <strong className="text-white block">Support IA Intégral</strong>
                        <span className="text-gray-400">Réponses instantanées et explications pas-à-pas sur les questions complexes du forum.</span>
                      </div>
                    </div>
                    <div className="flex gap-2.5 p-3 rounded-xl bg-slate-950/45 border border-slate-800/60">
                      <Trophy className="text-faso-red shrink-0 mt-0.5" size={16} />
                      <div>
                        <strong className="text-white block">Arène des Champions</strong>
                        <span className="text-gray-400">Inscription prioritaire aux concours en direct, classements et certificats de mérite.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Plan Selector */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-widest mb-3">
                    Sélectionnez votre forfait :
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      onClick={() => setSelectedPlan('monthly')}
                      className={cn(
                        "p-4 rounded-2xl border-2 cursor-pointer transition-all",
                        selectedPlan === 'monthly' ? "border-faso-green bg-faso-green/5" : "border-slate-800 bg-slate-950/20 hover:border-slate-750"
                      )}
                    >
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block">Forfait Mensuel</span>
                      <strong className="text-lg font-black mt-1 block w-fit">2 500 FCFA <span className="text-xs font-normal text-gray-400">/ mois</span></strong>
                      <span className="text-[10px] text-gray-400 mt-2 block w-fit">Sans engagement. Annulable à tout moment.</span>
                    </div>

                    <div 
                      onClick={() => setSelectedPlan('annual')}
                      className={cn(
                        "p-4 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden",
                        selectedPlan === 'annual' ? "border-faso-blue bg-faso-blue/5" : "border-slate-800 bg-slate-950/20 hover:border-slate-750"
                      )}
                    >
                      <div className="absolute top-0 right-0 bg-faso-blue text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-bl">
                        Économisez 40%
                      </div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block">Forfait Forcé</span>
                      <strong className="text-lg font-black mt-1 block">15 000 FCFA <span className="text-xs font-normal text-gray-400">/ an</span></strong>
                      <span className="text-[10px] text-amber-300 mt-2 block font-medium">Recommandé pour les concours d'élite !</span>
                    </div>
                  </div>
                </div>

                {/* Dual choice buttons */}
                <div className="pt-2 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-widest mb-1 text-start">
                    Sélectionnez votre méthode d'activation :
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
                    <button
                      onClick={() => {
                        setCheckoutStep('payment_form');
                        playSound('correct');
                      }}
                      className="py-4 px-4 bg-gradient-to-r from-faso-green to-emerald-500 font-extrabold rounded-xl shadow-md hover:scale-[1.01] transition-all cursor-pointer text-slate-950 uppercase tracking-wider flex flex-col items-center justify-center text-center group"
                    >
                      <span className="font-black text-sm flex items-center gap-1">🚀 En ligne (Automatique)</span>
                      <span className="text-[10px] font-bold opacity-80 mt-1">Activation immédiate en 3 secondes</span>
                    </button>

                    <button
                      onClick={() => {
                        setCheckoutStep('manual_form');
                        setManualPhone(paymentPhone || '');
                        setManualName(profile.name || '');
                        playSound('correct');
                      }}
                      className="py-4 px-4 bg-slate-800 border-2 border-slate-700 hover:border-faso-blue hover:bg-slate-755 font-extrabold rounded-xl shadow-md hover:scale-[1.01] transition-all cursor-pointer text-white uppercase tracking-wider flex flex-col items-center justify-center text-center"
                    >
                      <span className="font-black text-sm text-faso-blue flex items-center gap-1">✍️ Dépôt Mobile (Manuel)</span>
                      <span className="text-[10px] font-bold text-gray-400 mt-1">Validation par mail ou admin sous 24h</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center italic">
                    Note : Pour le paiement manuel, l'activation sera faite manuellement par l'administrateur de l'application.
                  </p>
                </div>
              </div>
            )}

            {checkoutStep === 'payment_form' && (
              <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-widest mb-3">
                    Mode de paiement sécurisé local :
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'orange', name: 'Orange Money' },
                      { id: 'moov', name: 'Moov Money' },
                      { id: 'wave', name: 'Wave Cash' },
                      { id: 'card', name: 'Carte Bancaire' }
                    ].map(meth => (
                      <div
                        key={meth.id}
                        onClick={() => setSelectedMethod(meth.id as any)}
                        className={cn(
                          "p-3 rounded-xl border text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[75px]",
                          selectedMethod === meth.id ? "border-faso-blue bg-faso-blue/10 scale-95" : "border-slate-800 bg-slate-950/20"
                        )}
                      >
                        <span className="text-[10px] font-black leading-tight text-white">{meth.name}</span>
                        {selectedMethod === meth.id && <div className="w-1.5 h-1.5 bg-faso-blue rounded-full mt-1.5" />}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedMethod !== 'card' ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider text-start">
                      Numéro de téléphone mobile payeur
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3.5 text-xs font-bold text-gray-500">+226</span>
                      <input
                        type="text"
                        required
                        placeholder="70 00 00 00"
                        value={paymentPhone}
                        onChange={(e) => setPaymentPhone(e.target.value)}
                        className="w-full p-3.5 pl-14 bg-slate-950 border border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs text-white tracking-widest font-mono"
                      />
                    </div>
                    <div className="mt-2 text-start flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentPhone('76001122')}
                        className="text-[10px] text-faso-green hover:underline cursor-pointer w-fit"
                      >
                        💡 Cliquer pour pré-remplir un numéro valide de test (76 00 11 22)
                      </button>
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        Une demande d'autorisation de débit de <strong>{selectedPlan === 'monthly' ? '2 500' : '15 000'} FCFA</strong> sera immédiatement émise sur votre mobile contenant les fonds. Saisissez votre code PIN secret sur l'invite mobile pour certifier l'achat.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-start">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                        Numéro de Carte de Crédit
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="4242 4242 4242 4242"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                          Expiration (MM/AA)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="12/28"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                          Code CVV / CVC
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="345"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('info')}
                    className="py-3.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 rounded-xl font-bold text-xs cursor-pointer text-center"
                  >
                    Retour aux forfaits
                  </button>
                  <button
                    type="submit"
                    className="py-3.5 bg-gradient-to-r from-faso-green to-faso-blue rounded-xl font-extrabold text-xs cursor-pointer text-center text-slate-950 font-black uppercase tracking-wider"
                  >
                    Simuler le Paiement Sécurisé
                  </button>
                </div>
              </form>
            )}

            {checkoutStep === 'manual_form' && (
              <form onSubmit={handleManualPaymentSubmit} className="space-y-5 text-start">
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-widest mb-1.5">
                    📢 Instructions pour le Dépôt :
                  </h4>
                  <div className="bg-slate-955/80 border border-slate-800 p-4 rounded-xl space-y-2 text-xs leading-relaxed text-gray-300">
                    <p>
                      Envoyez la somme exacte de <strong className="text-amber-300">{selectedPlan === 'monthly' ? '2 500 FCFA' : '15 000 FCFA'}</strong> par dépôt/transfert direct vers l'un des comptes officiels :
                    </p>
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <div className="flex justify-between items-center p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <span className="font-bold text-orange-400">Orange Money :</span>
                        <code className="bg-slate-950 px-2 py-0.5 rounded font-bold text-white tracking-wider">+226 76 00 11 22</code>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                        <span className="font-bold text-indigo-400">Moov Money :</span>
                        <code className="bg-slate-950 px-2 py-0.5 rounded font-bold text-white tracking-wider">+226 60 44 55 66</code>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-sky-500/10 border border-sky-500/30">
                        <span className="font-bold text-sky-400">Wave Cash :</span>
                        <code className="bg-slate-950 px-2 py-0.5 rounded font-bold text-white tracking-wider">+226 55 88 99 00</code>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 italic mt-1.5">
                      Une fois le transfert effectué, veuillez remplir la déclaration ci-dessous pour validation par l'administrateur.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'orange', name: 'Orange', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
                    { id: 'moov', name: 'Moov', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' },
                    { id: 'wave', name: 'Wave', color: 'bg-sky-500/20 text-sky-400 border-sky-500/40' }
                  ].map(op => (
                    <div
                      key={op.id}
                      onClick={() => setManualOperator(op.id as any)}
                      className={cn(
                        "p-2.5 rounded-xl border text-center cursor-pointer transition-all flex flex-col items-center justify-center text-xs font-bold",
                        manualOperator === op.id ? "bg-faso-blue/20 border-faso-blue text-faso-blue font-black" : "bg-slate-950/20 border-slate-800"
                      )}
                    >
                      {op.name}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Numéro de téléphone expéditeur
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. 76001122"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Nom complet de l'expéditeur
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. Ibrahim Sawadogo"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Montant envoyé (FCFA)
                    </label>
                    <input
                      type="number"
                      disabled
                      value={manualAmount}
                      className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-gray-400 opacity-85"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Référence / ID du transfert
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex. TX-83921-226"
                      value={manualReference}
                      onChange={(e) => setManualReference(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs text-white uppercase tracking-wider font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="mt-2 text-start flex flex-col gap-1.5 bg-slate-950/30 p-2.5 rounded-lg border border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setManualPhone('76123456');
                      setManualName(profile.name);
                      setManualReference(`TXF-${Math.floor(Math.random() * 90000 + 10000)}`);
                    }}
                    className="text-[10px] text-faso-green hover:underline cursor-pointer w-fit font-bold"
                  >
                    💡 Cliquer pour simuler de fausses informations de paiement de test
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('info')}
                    className="py-3 bg-slate-950 border border-slate-800 hover:bg-slate-900 rounded-xl font-bold text-xs cursor-pointer text-center"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    className="py-3 bg-gradient-to-r from-faso-green to-faso-blue rounded-xl font-extrabold text-xs cursor-pointer text-center text-slate-950 font-black uppercase tracking-wider"
                  >
                    Soumettre le récépissé
                  </button>
                </div>
              </form>
            )}

            {checkoutStep === 'manual_confirmation' && (
              <div className="p-4 space-y-6 text-center">
                <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 mx-auto animate-pulse scale-110">
                  <Clock size={32} />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-amber-500">
                    Déclaration de Dépôt Soumise !
                  </h4>
                  <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
                    Votre récépissé a bien été enregistré. L'administrateur a reçu un e-mail avec les détails pour vérification de la réception sur le réseau mobile.
                  </p>
                </div>

                {/* Print confirmation details nicely */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl text-left text-xs space-y-2 max-w-sm mx-auto font-mono">
                  <div className="flex justify-between border-b border-slate-800/60 pb-1.5 mb-1.5">
                    <span className="text-gray-400">Expéditeur :</span>
                    <span className="text-white font-bold">{manualName} ({manualPhone})</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1.5 mb-1.5">
                    <span className="text-gray-400">Opérateur :</span>
                    <span className="text-white font-bold uppercase">{manualOperator} Money</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1.5 mb-1.5">
                    <span className="text-gray-400">Montant reçu :</span>
                    <span className="text-faso-green font-bold">{manualAmount} FCFA</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1.5 mb-1.5">
                    <span className="text-gray-400">Réf. Transfert :</span>
                    <span className="text-faso-blue font-bold">{manualReference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Statut :</span>
                    <span className="text-rose-450 font-bold flex items-center gap-1">🔴 En attente</span>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-center text-[11px] text-blue-400 max-w-sm mx-auto">
                  💡 <strong>Comment tester ?</strong> Ouvrez le bouton <strong>🛠️ Admin</strong> en haut à droite du header principal pour valider cette transaction avec l'espace administration !
                </div>

                <button
                  onClick={() => {
                    setShowCheckoutModal(false);
                    setCheckoutStep('info');
                  }}
                  className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl text-xs hover:bg-slate-750 cursor-pointer"
                >
                  Fermer & Retourner aux révisions
                </button>
              </div>
            )}

            {checkoutStep === 'processing' && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="animate-spin text-faso-blue" size={48} />
                <div>
                  <h4 className="font-bold text-base text-white">Prélèvement en cours sur votre compte...</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Nous sollicitons la passerelle sécurisée de l'opérateur de paiement {selectedMethod.toUpperCase()} pour enregistrer votre souscription... Veuillez valider sur votre téléphone s'il y a lieu.
                  </p>
                </div>
              </div>
            )}

            {checkoutStep === 'success' && (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-5">
                <div className="w-14 h-14 bg-faso-green/20 border border-faso-green/40 rounded-full flex items-center justify-center text-faso-green scale-110">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h4 className="font-black text-lg bg-gradient-to-r from-faso-green to-faso-blue bg-clip-text text-transparent w-fit mx-auto">
                    Félicitations, Académicien Premium !
                  </h4>
                  <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
                    Votre paiement a été traité avec succès dans notre système. Vous bénéficiez désormais d'une licence d'utilisation illimitée aux quiz et cours d'élite ReFaso Educ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheckoutModal(false);
                    setCheckoutStep('info');
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-faso-green to-faso-blue rounded-xl font-bold text-xs cursor-pointer text-slate-950 font-black"
                >
                  Suivant & Commencer à réviser
                </button>
              </div>
            )}
          </div>
          
        </div>
      </div>
    );
  };

  const handlePageManualPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim() || !manualName.trim() || !manualReference.trim()) {
      setPaymentAlertMessage("⚠️ Veuillez remplir tous les champs du formulaire.");
      return;
    }

    const newTx: ManualPaymentTx = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userEmail: profile.email || 'candidat@test.bf',
      userName: manualName.trim(),
      operator: manualOperator,
      phone: manualPhone.trim(),
      amount: manualAmount,
      reference: manualReference.trim().toUpperCase(),
      date: new Date().toISOString(),
      status: 'pending'
    };

    setManualPayments(prev => [newTx, ...prev]);
    playSound('finish');
    setPaymentAlertMessage("✨ Déclaration enregistrée avec succès ! Votre dépôt manuel est en attente de validation par l'administrateur (Ibrahim Sawadogo). Vous pouvez l'approuver ou le rejeter directement depuis l'onglet raccourci 🛠️ Admin en haut à droite !");
    
    // Clear only transaction reference
    setManualReference('');
  };

  const handleProfileUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile(prev => ({
      ...prev,
      name: editProfileName.trim(),
      targetExam: editProfileTargetExam.trim(),
      regionName: editProfileRegion.trim(),
      avatar: editProfileAvatar
    }));
    setIsEditingProfile(false);
    playSound('finish');
  };

  const handleAddCustomVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customVideoTitle.trim() || !customVideoUrl.trim()) return;
    
    const newCustomVid = {
      id: `vid-custom-${Date.now()}`,
      title: customVideoTitle.trim(),
      url: customVideoUrl.trim(),
      duration: customVideoDuration,
      category: customVideoCategory,
      savedAt: new Date().toISOString(),
      isCustom: true
    };

    persistSavedVideos([newCustomVid, ...savedVideos]);
    setCustomVideoTitle('');
    setCustomVideoUrl('');
    setShowAddVideoForm(false);
    playSound('finish');
  };

  const toggleVideoRecommendation = (vid: { id: string; title: string; url: string; duration: string; category: string }) => {
    const isSaved = savedVideos.some(v => v.id === vid.id);
    if (isSaved) {
      persistSavedVideos(savedVideos.filter(v => v.id !== vid.id));
      playSound('wrong');
    } else {
      const savedItem = {
        ...vid,
        savedAt: new Date().toISOString(),
        isCustom: false
      };
      persistSavedVideos([savedItem, ...savedVideos]);
      playSound('finish');
    }
  };

  const renderEspace = () => {
    const emailScope = profile.email || 'candidat@test.bf';
    const totalPoints = profile.points || 0;
    const currentStreak = profile.learningStreak || 0;
    const badgeTier = totalPoints > 1000 ? 'Élite Légendaire 🏆' : totalPoints > 500 ? 'Lauréat Émérite 🏅' : totalPoints > 100 ? 'Initié Assidu 🧠' : 'Candidat Motivé 🌱';
    
    const totalQuizzes = history.length;
    const correctAnswersCount = history.reduce((acc, h) => acc + h.score, 0);
    const totalQuestionsCount = history.reduce((acc, h) => acc + h.totalQuestions, 0);
    const globalAccuracy = totalQuestionsCount > 0 ? Math.round((correctAnswersCount / totalQuestionsCount) * 100) : 0;

    return (
      <div className="p-6 space-y-8 max-w-3xl mx-auto dark:text-gray-100">
        
        {/* Banner with customized profile card */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden text-white shadow-xl">
          <div className="absolute top-0 right-0 p-3 bg-faso-green/10 text-faso-green font-mono uppercase text-[9px] tracking-widest rounded-bl border-l border-b border-slate-800/80">
            Éléments privés isolés • Sécurisé 🔑
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            {/* Avatar block */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-faso-green via-faso-yellow to-faso-blue p-1 shadow-2xl">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-4xl group-hover:scale-105 transition-all">
                  {profile.avatar || '👨‍🎓'}
                </div>
              </div>
              <span className="absolute bottom-0 right-0 bg-amber-500 text-slate-950 rounded-full w-7 h-7 flex items-center justify-center text-xs font-black shadow-lg">
                🔥{currentStreak}
              </span>
            </div>

            {/* Candidate Identity details */}
            <div className="space-y-2 flex-1 text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <h2 className="text-2xl font-black">{profile.name || "Candidat Admissible"}</h2>
                {profile.isPremium && (
                  <span className="self-center md:self-start bg-amber-500/10 border border-amber-500/30 text-amber-500 uppercase font-black text-[9px] tracking-widest px-2 py-0.5 rounded-full">
                    👑 Elite Premium
                  </span>
                )}
              </div>
              
              <p className="text-gray-400 text-xs font-mono">
                Compte : <span className="text-teal-400 font-bold">{emailScope}</span> • Enregistré le {safeFormatDate(profile.registrationDate, false)}
              </p>

              {/* Badges/Vocation target */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                <span className="bg-slate-800 border border-slate-700 text-[11px] font-medium px-3 py-1 rounded-xl flex items-center gap-1.5 text-gray-300">
                  🎯 Concours visé : <strong className="text-faso-blue">{profile.targetExam || "Non spécifié"}</strong>
                </span>
                <span className="bg-slate-800 border border-slate-700 text-[11px] font-medium px-3 py-1 rounded-xl flex items-center gap-1.5 text-gray-300">
                  🗺️ Région : <strong className="text-faso-green">{profile.regionName || "Centre (Ouagadougou)"}</strong>
                </span>
                <span className="bg-slate-800 border border-slate-700 text-[11px] font-medium px-3 py-1 rounded-xl flex items-center gap-1.5 text-gray-300">
                  🎓 Niveau : <strong className="text-faso-yellow">{profile.level}</strong>
                </span>
              </div>
            </div>

            {/* Edit Profile Button quick action */}
            <button
              onClick={() => {
                setIsEditingProfile(!isEditingProfile);
                playSound('correct');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white border border-slate-700 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Edit3 size={14} />
              <span>Modifier mon profil</span>
            </button>
          </div>

          {/* Gamified performance dashboard bars inside profile card */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-center md:text-left">
            <div>
              <span className="text-[9px] font-bold text-gray-550 uppercase tracking-wider block">XP d'apprentissage</span>
              <strong className="text-xl font-black text-amber-500">{totalPoints} <span className="text-[10px] text-gray-400 font-normal">pts</span></strong>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-550 uppercase tracking-wider block">Niveau d'élite</span>
              <strong className="text-[11px] font-black text-emerald-400 uppercase tracking-tight block mt-1 truncate">{badgeTier}</strong>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-550 uppercase tracking-wider block">Fréquence de révision</span>
              <strong className="text-xl font-black text-faso-green">{currentStreak} <span className="text-[10px] text-gray-400 font-normal">jours</span></strong>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-550 uppercase tracking-wider block">Précision globale</span>
              <strong className="text-xl font-black text-faso-blue">{globalAccuracy}% <span className="text-[10px] text-gray-400 font-normal">succès</span></strong>
            </div>
          </div>
        </div>

        {/* Modal/Form for editing profile detail details */}
        {isEditingProfile && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 rounded-3xl p-5 space-y-4 shadow-sm text-left"
          >
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2.5">
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider">
                Mettre à jour vos paramètres d'admissibilité
              </h3>
              <button 
                onClick={() => setIsEditingProfile(false)} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleProfileUpdateSubmit} className="space-y-4">
              {/* Avatar options */}
              <div>
                <label className="block text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase mb-2">Choisir votre avatar académique</label>
                <div className="flex flex-wrap gap-2.5">
                  {['👨‍🎓', '👩‍🎓', '🧠', '🎖️', '🦁', '📚', '🖊️', '💼', '🚀', '🔥'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setEditProfileAvatar(emoji);
                        playSound('correct');
                      }}
                      className={cn(
                        "w-11 h-11 text-xl rounded-xl border flex items-center justify-center transition-all cursor-pointer",
                        editProfileAvatar === emoji 
                          ? "bg-faso-green/10 border-faso-green scale-110 shadow-sm" 
                          : "bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 hover:bg-gray-100"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* Full name edit */}
                <div className="sm:col-span-1 border-0">
                  <label className="block text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={editProfileName}
                    onChange={(e) => setEditProfileName(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white font-medium"
                    placeholder="Votre nom"
                  />
                </div>

                {/* Target exam edit */}
                <div className="sm:col-span-1 border-0">
                  <label className="block text-xs font-extrabold text-gray-500 dark:text-gray-450 uppercase mb-1.5 font-sans">Concours ou examen visé</label>
                  <input
                    type="text"
                    required
                    value={editProfileTargetExam}
                    onChange={(e) => setEditProfileTargetExam(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white font-medium"
                    placeholder="Ex: Concours Inspecteur des Douanes"
                  />
                </div>

                {/* Region selection */}
                <div className="sm:col-span-1 border-0">
                  <label className="block text-xs font-extrabold text-gray-500 dark:text-gray-450 uppercase mb-1.5">Région du Burkina Faso</label>
                  <select
                    value={editProfileRegion}
                    onChange={(e) => setEditProfileRegion(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white font-medium"
                  >
                    {[
                      "Centre (Ouagadougou)",
                      "Hauts-Bassins (Bobo-Dioulasso)",
                      "Nord (Ouahigouya)",
                      "Est (Fada N'gourma)",
                      "Sahel (Dori)",
                      "Centre-Est (Tenkodogo)",
                      "Centre-Ouest (Koudougou)",
                      "Centre-Sud (Manga)",
                      "Boucle du Mouhoun (Dédougou)",
                      "Cascades (Banfora)",
                      "Plateau-Central (Ziniaré)",
                      "Sud-Ouest (Gaoua)",
                      "Centre-Nord (Kaya)"
                    ].map(reg => (
                      <option key={reg} value={reg}>{reg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 bg-gray-105 hover:bg-gray-200 dark:bg-slate-950 dark:hover:bg-slate-900 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-faso-green to-faso-blue hover:from-green-600 hover:to-blue-600 rounded-xl cursor-pointer"
                >
                  Sauvegarder l'identité Élite 💾
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Outer Tabs Menu with icons */}
        <div className="flex border-b dark:border-slate-800 pb-px gap-1 justify-start overflow-x-auto scroller-none max-w-full">
          {[
            { id: 'profile', label: 'Espace Identité', icon: User },
            { id: 'videos', label: 'Ma Vidéothèque d’Élite', icon: Video },
            { id: 'questions', label: 'Mes Favoris Révision', icon: Bookmark },
            { id: 'history', label: 'Historique d’Examens', icon: HistoryIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setEspaceTab(tab.id as any);
                playSound('correct');
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap",
                espaceTab === tab.id 
                  ? "border-faso-green text-faso-green" 
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-200"
              )}
            >
              <tab.icon size={15} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: PROFILE SUMMARY & USER DETAILS */}
        {espaceTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Quick action card for subscription info */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-gray-250 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-xs">
              <h3 className="text-sm font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5 border-b dark:border-slate-800 pb-2">
                <Award size={15} className="text-faso-green animate-pulse" />
                <span>Statut de votre abonnement et admissibilité</span>
              </h3>
              
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block font-mono">Accès Premium en cours</span>
                  <div className="flex items-center gap-1.5">
                    {profile.isPremium ? (
                      <span className="text-lg font-black text-amber-500 flex items-center gap-1">👑 Elite Premium Illimité</span>
                    ) : (
                      <span className="text-lg font-black text-faso-green flex items-center gap-1">✨ Offre d'évaluation active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-normal max-w-sm font-medium">
                    {profile.isPremium 
                      ? "Votre compte dispose de l'accès infini aux questionnaires d'excellence de l'IA Gemini et de la gestion de téléchargement." 
                      : `Il vous reste ${getTrialDaysRemaining()} jours d'essai pour explorer librement l'arène de préparation.`}
                  </p>
                </div>
                {!profile.isPremium ? (
                  <button
                    onClick={() => {
                      setActiveTab('Paiement');
                      playSound('correct');
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-faso-green to-faso-blue hover:from-green-600 hover:to-blue-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
                  >
                    S'abonner maintenant 👑
                  </button>
                ) : (
                  <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-black text-xs uppercase text-center shrink-0">
                    Compte Actif ✅
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-extrabold uppercase text-gray-400">Pourquoi votre espace est conçu pour le Burkina Faso ?</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-gray-600 dark:text-gray-350 font-medium font-sans">
                  <div className="p-3 bg-gray-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl space-y-1">
                    <span className="text-faso-blue font-bold tracking-tight block">Fiches thématiques adaptées</span>
                    <p className="text-[10px] text-gray-500 leading-relaxed font-light">Le système extrait les annales de l’UEMOA et de l’ENA de Ouagadougou.</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl space-y-1">
                    <span className="text-faso-green font-bold tracking-tight block">Analyses d'admissibilité</span>
                    <p className="text-[10px] text-gray-500 leading-relaxed font-light">Vos performances cumulées simulent si vous dépassez la barre d’admissibilité.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar with mini progress stats or quick reminders */}
            <div className="bg-white dark:bg-slate-900 border border-gray-250 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-xs text-left">
              <h3 className="text-sm font-black uppercase text-gray-400 tracking-wider pb-2 border-b dark:border-slate-800">
                🚀 Objectifs de Révision
              </h3>

              <div className="space-y-3.5 divide-y dark:divide-slate-800">
                <div className="space-y-1.5 pt-1 border-0">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold font-mono">Séances d'évaluation</span>
                  <div className="flex justify-between text-xs font-bold">
                    <span>Quiz terminés</span>
                    <span className="text-faso-blue">{totalQuizzes} / Infini</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-faso-blue h-full" style={{ width: `${Math.min(100, (totalQuizzes * 20))}%` }} />
                  </div>
                </div>

                <div className="space-y-1.5 pt-3">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold font-mono">Vidéothèque consultée</span>
                  <div className="flex justify-between text-xs font-bold">
                    <span>Playlist d'étude</span>
                    <span className="text-faso-green">{savedVideos.length} enregistrées</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-faso-green h-full" style={{ width: `${Math.min(100, (savedVideos.length * 20))}%` }} />
                  </div>
                </div>

                <div className="space-y-1.5 pt-3">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold font-mono">Questions favorites</span>
                  <div className="flex justify-between text-xs font-bold">
                    <span>Révision ciblée</span>
                    <span className="text-amber-500">{bookmarkedQuestions.length} questions</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, (bookmarkedQuestions.length * 10))}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VIDEOTHEQUE D'ELITE / DYNAMIC PLAYLISTS */}
        {espaceTab === 'videos' && (
          <div className="space-y-6 text-left">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black bg-gradient-to-r from-faso-green to-faso-blue bg-clip-text text-transparent">
                  Votre Vidéothèque Privée & Portails de Révisions
                </h3>
                <p className="text-xs text-gray-500 leading-normal max-w-xl font-medium">
                  Consultez des cours vidéo officiels d'admissibilité ou ajoutez vos propres tutoriels YouTube favoris pour réviser à votre rythme sans les mélanger avec le forum de la communauté.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowAddVideoForm(!showAddVideoForm);
                  playSound('correct');
                }}
                className="px-4 py-2 bg-faso-blue hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition-all flex items-center gap-1.5"
              >
                {showAddVideoForm ? <X size={15} /> : <Plus size={15} />}
                <span>Ajouter un cours vidéo externe</span>
              </button>
            </div>

            {/* Form for adding external custom YouTube links */}
            {showAddVideoForm && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 border border-gray-250 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm"
              >
                <div className="border-b dark:border-slate-800 pb-2 flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">
                    Déclarer une nouvelle vidéo de cours / révision
                  </h4>
                  <button onClick={() => setShowAddVideoForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                    <X size={15} />
                  </button>
                </div>

                <form onSubmit={handleAddCustomVideoSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border-0">
                      <label className="block text-xs font-bold text-gray-550 uppercase tracking-wider mb-1 font-mono">
                        Titre descriptif de la vidéo académique
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Statistiques descriptives appliquées"
                        value={customVideoTitle}
                        onChange={(e) => setCustomVideoTitle(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white"
                      />
                    </div>

                    <div className="border-0">
                      <label className="block text-xs font-bold text-gray-550 uppercase tracking-wider mb-1 font-mono">
                        Catégorie principale
                      </label>
                      <select
                        value={customVideoCategory}
                        onChange={(e) => setCustomVideoCategory(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white"
                      >
                        <option value="Droit & Administration">Droit & Administration</option>
                        <option value="Économie & Finance">Économie & Finance</option>
                        <option value="Culture Générale">Culture Générale</option>
                        <option value="Tests de Logique">Tests de Logique</option>
                        <option value="Histoire & Géo">Histoire & Géo</option>
                        <option value="Anglais Académique">Anglais Académique</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border-0">
                      <label className="block text-xs font-bold text-gray-550 uppercase tracking-wider mb-1 font-mono">
                        URL du Tutoriel (ex: YouTube, Vimeo)
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={customVideoUrl}
                        onChange={(e) => setCustomVideoUrl(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white font-mono"
                      />
                    </div>

                    <div className="border-0">
                      <label className="block text-xs font-bold text-gray-550 uppercase tracking-wider mb-1 font-mono">
                        Durée estimative du cours
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: 45 min"
                        value={customVideoDuration}
                        onChange={(e) => setCustomVideoDuration(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-faso-green to-faso-blue hover:from-green-600 hover:to-blue-600 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Enregistrer la vidéo dans ma vidéothèque privée 📥
                  </button>
                </form>
              </motion.div>
            )}

            {/* List of custom videos added by user */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                🎥 Vos vidéos enregistrées et playlists personnelles ({savedVideos.length})
              </h4>

              {savedVideos.length === 0 ? (
                <div className="py-12 bg-gray-50 dark:bg-slate-900/50 border border-dashed border-gray-200 dark:border-slate-800 rounded-3xl text-center">
                  <Video size={48} className="mx-auto text-gray-300 dark:text-gray-750 mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-bold max-w-md mx-auto">
                    Aucune vidéo enregistrée dans votre vidéothèque personnelle.
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 max-w-sm mx-auto leading-normal">
                    Utilisez le bouton ci-dessus pour ajouter vos cours vidéo favoris ou mémorisez les recommandations ci-dessous !
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedVideos.map(vid => (
                    <div 
                      key={vid.id} 
                      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:shadow-xs transition-shadow relative"
                    >
                      <button
                        onClick={() => {
                          persistSavedVideos(savedVideos.filter(v => v.id !== vid.id));
                          playSound('wrong');
                        }}
                        className="absolute top-3 right-3 text-gray-400 hover:text-red-500 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Retirer de mes favoris"
                      >
                        <Trash2 size={13} />
                      </button>

                      <div className="space-y-1.5 pr-6">
                        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-extrabold text-faso-blue font-mono">
                          <span>{vid.category}</span>
                          {vid.isCustom && <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-1.5 py-px rounded">Perso 🔑</span>}
                        </div>
                        <h5 className="font-bold text-xs text-gray-900 dark:text-gray-105 line-clamp-2">
                          {vid.title}
                        </h5>
                        <p className="text-[10px] text-gray-500">Durée : {vid.duration}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t dark:border-slate-800/85 flex items-center justify-between">
                        <span className="text-[9px] font-mono text-gray-400">
                          Enregistrée : {safeFormatDate(vid.savedAt, false)}
                        </span>
                        <a 
                          href={vid.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-faso-blue border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <Play size={10} className="fill-current" />
                          <span>Lancer le cours</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CURATED SUGGESTIONS FOR THE CANDIDATE */}
            <div className="space-y-4 pt-4 border-t dark:border-slate-800">
              <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider font-mono">
                💡 Recommandations Élite Faso Educ (Séminaires et Corrections en Vidéo)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {precompiledVideos.map(rec => {
                  const isSaved = savedVideos.some(v => v.id === rec.id);
                  return (
                    <div 
                      key={rec.id} 
                      className="bg-slate-100/40 dark:bg-slate-900/40 border border-gray-200/60 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="text-[9px] font-black uppercase text-faso-green tracking-wider font-mono">{rec.category}</div>
                        <h5 className="font-bold text-xs text-gray-800 dark:text-gray-100 line-clamp-2">{rec.title}</h5>
                        <p className="text-[10px] text-gray-500 font-medium">Durée : {rec.duration}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => toggleVideoRecommendation(rec)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex-1 text-center",
                            isSaved 
                              ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20" 
                              : "bg-faso-green text-slate-950 font-black hover:bg-green-600"
                          )}
                        >
                          {isSaved ? "Sauvegardé ✓" : "Sauvegarder ⭐️"}
                        </button>
                        
                        <a 
                          href={rec.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-gray-100 dark:bg-slate-950 rounded-lg text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-mono font-bold hover:shadow-xs cursor-pointer border border-transparent dark:border-slate-850"
                        >
                          Lien direct 🔗
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: QUESTIONS FAVORITES / SMART REVISION CARD ENGINE */}
        {espaceTab === 'questions' && (
          <div className="space-y-6 text-left">
            <div>
              <h3 className="text-lg font-black bg-gradient-to-r from-faso-yellow to-faso-blue bg-clip-text text-transparent">
                Votre Pile Personnelle de Questions Favorites ({bookmarkedQuestions.length})
              </h3>
              <p className="text-xs text-gray-505 leading-normal max-w-xl font-medium">
                Retrouvez toutes les questions complexes issues de vos quiz que vous avez choisi de mémoriser. Révisez-les en format carte-mémoire (Flashcard) haute vitesse.
              </p>
            </div>

            {bookmarkedQuestions.length === 0 ? (
              <div className="py-16 bg-gray-50 dark:bg-slate-900/50 border border-dashed border-gray-200 dark:border-slate-800 rounded-3xl text-center space-y-3">
                <Bookmark size={48} className="mx-auto text-gray-300 dark:text-gray-700 font-mono" />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium max-w-sm mx-auto">
                  Aucune question favorite n'est enregistrée pour le moment.
                </p>
                <p className="text-[10px] text-gray-400 px-4 max-w-xs mx-auto leading-normal">
                  Pendant que vous passez des quiz d'évaluation, cliquez sur l'icône de signet (Marque-page) en haut à droite des énoncés pour les capturer ici !
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookmarkedQuestions.map((q, idx) => (
                  <div 
                    key={`${q.id || idx}-${idx}`} 
                    className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl relative shadow-2xs space-y-3"
                  >
                    {/* Delete action button */}
                    <button
                      onClick={() => {
                        persistBookmarkedQuestions(bookmarkedQuestions.filter((_, qIdx) => qIdx !== idx));
                        playSound('wrong');
                      }}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-500 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Retirer de mes favoris"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-faso-blue tracking-wider block font-mono">
                        📚 Sujet : {q.subject || "Suivi de révision"}
                      </span>
                      <h4 className="font-bold text-sm text-gray-950 dark:text-gray-50 tracking-tight leading-relaxed select-text mt-1 max-w-[90%]">
                        <MathRenderer text={q.text} />
                      </h4>
                    </div>

                    {/* Show alternative options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = oIdx === q.correctAnswer;
                        return (
                          <div 
                            key={oIdx}
                            className={cn(
                              "p-3 rounded-xl border text-xs font-semibold select-text",
                              isCorrect 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                                : "bg-gray-50/50 dark:bg-slate-950/40 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-gray-400"
                            )}
                          >
                            <span className="font-bold mr-1.5 text-[10px] uppercase font-mono">{String.fromCharCode(65 + oIdx)}.</span>
                            <MathRenderer text={opt} />
                          </div>
                        );
                      })}
                    </div>

                    {/* Educational explanation badge */}
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 border dark:border-slate-800/80 rounded-xl text-xs dark:text-sky-200 leading-relaxed font-normal whitespace-pre-line text-slate-800">
                      <span className="font-extrabold text-blue-700 dark:text-indigo-400 block mb-1">💡 Méthode & Justification d'Excellence :</span>
                      <MathRenderer text={q.explanation} />
                    </div>

                    <div className="text-[10px] text-gray-400 pt-1 flex items-center justify-between font-mono">
                      <span>Sauvegardée le : {safeFormatDate(q.savedAt, false)}</span>
                      <span className="font-semibold text-amber-500 font-bold uppercase">{q.dimension || "Morale & Mémoire"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ENTIRE HISTORY MANAGED PRIVATELY */}
        {espaceTab === 'history' && (
          <div className="space-y-6 text-left">
            <div>
              <h3 className="text-lg font-black bg-gradient-to-r from-faso-green via-faso-yellow to-faso-blue bg-clip-text text-transparent">
                Votre Archive d'Examens & Médiathèque de Scores
              </h3>
              <p className="text-xs text-gray-500 leading-normal max-w-xl font-medium">
                Retrouvez l’ensemble des évaluations passées, relancez les anciens quiz, observez vos corrections et exportez vos fiches d'étude ou les questionnaires corrigés au format PDF officiel.
              </p>
            </div>

            {history.length === 0 ? (
              <div className="py-16 bg-gray-55 dark:bg-slate-900/50 border border-dashed border-gray-250 dark:border-slate-800 rounded-2xl text-center space-y-4">
                <BookOpen size={64} className="mx-auto text-gray-200 dark:text-gray-800" />
                <p className="text-gray-500 dark:text-gray-400 font-medium font-sans">Aucun quiz sauvegardé pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((res) => (
                  <div key={res.id} className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-base dark:text-white">{res.subjects.join(', ')}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{res.date} • {res.level}</p>
                      </div>
                      <div className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider font-mono",
                        res.mode === 'Entraînement' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                        res.mode === 'Test' ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      )}>
                        {res.mode}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-faso-green">{res.score}</span>
                        <span className="text-xs text-gray-400">/ {res.totalQuestions} correct{res.totalQuestions > 1 ? 's' : ''}</span>
                        <span className={cn(
                          "ml-2 text-[10px] font-bold px-2 py-0.5 rounded font-mono",
                          (res.score / res.totalQuestions) >= 0.7 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {(res.score / res.totalQuestions) >= 0.7 ? "Excellent ✅" : "À réviser ⚠️"}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            setSubjects(res.subjects);
                            startQuiz(res.mode);
                          }}
                          className="p-2 text-faso-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer"
                          title="Générer un nouveau quiz avec ces sujets"
                        >
                          <Plus size={18} />
                        </button>
                        <button 
                          onClick={() => generateQuizPDF(res)}
                          className="p-2 text-faso-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer"
                          title="Télécharger le PDF"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            isFinishingRef.current = false;
                            setCurrentQuiz({
                              id: res.id,
                              questions: res.questions,
                              mode: res.mode,
                              settings: { ...settings, questionCount: res.totalQuestions },
                              subjects: res.subjects
                            });
                            setQuizState({
                              currentIndex: 0,
                              userAnswers: new Array(res.questions.length).fill(null),
                              timeLeft: res.mode === 'Entraînement' ? 119 : 117,
                              isPaused: false,
                              isFinished: false,
                              showFeedback: false,
                              selectedOption: null
                            });
                            setActiveTab(res.mode);
                          }}
                          className="p-2 text-faso-green hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg cursor-pointer"
                          title="Rejouer ce quiz"
                        >
                          <Play size={18} fill="currentColor" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPaiement = () => {
    const userTxs = manualPayments.filter(tx => tx.userEmail.trim().toLowerCase() === profile.email.trim().toLowerCase());
    const daysLeft = getTrialDaysRemaining();

    return (
      <div className="p-6 space-y-8 max-w-2xl mx-auto dark:text-gray-100">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black bg-gradient-to-r from-faso-green via-faso-yellow to-faso-blue bg-clip-text text-transparent w-fit mx-auto">
            Procédures de Paiement & Abonnement
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Configurez et enregistrez votre accès Premium Elite pour débloquer toutes les fonctionnalités.
          </p>
        </div>

        {/* Status card */}
        <div className="bg-white dark:bg-slate-905 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left space-y-1">
            <span className="text-[10px] font-bold text-gray-505 uppercase tracking-widest">Votre Statut Actuel</span>
            <div className="flex items-center gap-2">
              {profile.isPremium ? (
                <>
                  <span className="text-xl font-black text-amber-500">👑 Elite Premium Actif</span>
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
                </>
              ) : (
                <>
                  <span className="text-xl font-black text-faso-green">✨ Version d'Évaluation</span>
                  <span className="text-xs text-gray-500 font-bold">({daysLeft} jours restants)</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {profile.isPremium 
                ? "Toutes nos félicitations ! Votre accès est actif, vous disposez des quiz Gemini infinis et des exports PDF de cours d'élite."
                : "Abonnez-vous pour lever les restrictions d'évaluation quotidiennes et réussir vos examens."}
            </p>
          </div>
          {profile.isPremium ? (
            <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl font-black text-xs uppercase shrink-0">
              Compte Actif ✅
            </div>
          ) : (
            <div className="px-4 py-2 bg-faso-green/10 border border-faso-green/20 text-faso-green rounded-xl font-black text-xs uppercase shrink-0">
              En attente d'activation
            </div>
          )}
        </div>

        {/* Display Alert Message if there is one */}
        {paymentAlertMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs space-y-1 font-medium text-left"
          >
            {paymentAlertMessage}
          </motion.div>
        )}

        {/* Forfait Selector */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold uppercase text-gray-400 tracking-wider text-left">
            1. Choisissez votre forfait de révision
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div 
              onClick={() => {
                setSelectedPlan('monthly');
                playSound('correct');
              }}
              className={cn(
                "p-4 rounded-2xl border-2 cursor-pointer transition-all text-left bg-white dark:bg-slate-900/50",
                selectedPlan === 'monthly' ? "border-faso-green bg-faso-green/5 dark:bg-faso-green/5" : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
              )}
            >
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block">Option Mensuelle</span>
              <strong className="text-lg font-black mt-1 block dark:text-white">2 500 FCFA <span className="text-xs font-normal text-gray-400">/ mois</span></strong>
              <span className="text-[10px] text-gray-500 mt-2 block">Sans engagement. Forfait récurrent annulable à tout moment.</span>
            </div>

            <div 
              onClick={() => {
                setSelectedPlan('annual');
                playSound('correct');
              }}
              className={cn(
                "p-4 rounded-2xl border-2 cursor-pointer transition-all text-left bg-white dark:bg-slate-900/50 relative overflow-hidden",
                selectedPlan === 'annual' ? "border-faso-blue bg-faso-blue/5 dark:bg-faso-blue/5" : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
              )}
            >
              <div className="absolute top-0 right-0 bg-faso-blue text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-bl">
                RECOMMANDÉ -40%
              </div>
              <span className="text-xs font-bold text-gray-505 uppercase tracking-wide block">Option Annuelle d'Élite</span>
              <strong className="text-lg font-black mt-1 block dark:text-white">15 000 FCFA <span className="text-xs font-normal text-gray-400">/ an</span></strong>
              <span className="text-[10px] text-amber-550 dark:text-amber-300 mt-2 block font-medium">Recommandé pour un succès garanti aux concours !</span>
            </div>
          </div>
        </div>

        {/* Payment Procedures instructions */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold uppercase text-gray-400 tracking-wider text-left">
            2. Procédures de Règlement Mobile Money
          </h3>
          
          <div className="bg-white dark:bg-slate-905 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 text-left">
            <p className="text-xs text-gray-600 dark:text-gray-350 leading-relaxed font-medium">
              Veuillez effectuer le dépôt correspondant au forfait choisi (<strong className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded font-black">{selectedPlan === 'monthly' ? '2 500' : '15 000'} FCFA</strong>) sur l'un de nos numéros officiels Burkina Faso désignés ci-après :
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Orange Money Account */}
              <div className="p-3 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 block">Orange Money</span>
                  <span className="text-[9px] text-gray-500 font-medium block">Nom: {paymentCredentials?.orange?.name || "Ibrahim Sawadogo"}</span>
                  <code className="bg-white dark:bg-black/40 border dark:border-transparent px-2 py-1 rounded-md text-xs font-mono font-black text-gray-800 dark:text-white tracking-widest block mt-2 text-center">
                    {paymentCredentials?.orange?.num || "+226 76 00 11 22"}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText((paymentCredentials?.orange?.num || "76001122").replace(/\D/g, ''), 'orange')}
                  className="mt-3.5 py-1.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs self-stretch"
                >
                  {copiedText === 'orange' ? "Copié ✓" : (
                    <>
                      <Copy size={11} />
                      <span>Copier le numéro</span>
                    </>
                  )}
                </button>
              </div>

              {/* Moov Money Account */}
              <div className="p-3 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">Moov Money</span>
                  <span className="text-[9px] text-gray-500 font-medium block">Nom: {paymentCredentials?.moov?.name || "Ibrahim Sawadogo"}</span>
                  <code className="bg-white dark:bg-black/40 border dark:border-transparent px-2 py-1 rounded-md text-xs font-mono font-black text-gray-800 dark:text-white tracking-widest block mt-2 text-center">
                    {paymentCredentials?.moov?.num || "+226 60 44 55 66"}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText((paymentCredentials?.moov?.num || "60445566").replace(/\D/g, ''), 'moov')}
                  className="mt-3.5 py-1.5 px-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs self-stretch"
                >
                  {copiedText === 'moov' ? "Copié ✓" : (
                    <>
                      <Copy size={11} />
                      <span>Copier le numéro</span>
                    </>
                  )}
                </button>
              </div>

              {/* Wave Account */}
              <div className="p-3 bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">Wave Transfer</span>
                  <span className="text-[9px] text-gray-500 font-medium block">Nom: {paymentCredentials?.wave?.name || "Ibrahim Sawadogo"}</span>
                  <code className="bg-white dark:bg-black/40 border dark:border-transparent px-2 py-1 rounded-md text-xs font-mono font-black text-gray-800 dark:text-white tracking-widest block mt-2 text-center">
                    {paymentCredentials?.wave?.num || "+226 55 88 99 00"}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText((paymentCredentials?.wave?.num || "55889900").replace(/\D/g, ''), 'wave')}
                  className="mt-3.5 py-1.5 px-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs self-stretch"
                >
                  {copiedText === 'wave' ? "Copié ✓" : (
                    <>
                      <Copy size={11} />
                      <span>Copier le numéro</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-[11px] text-yellow-700 dark:text-yellow-400 font-medium flex gap-2">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Note importante :</strong> Après validation du transfert mobile, relevez impérativement le <strong>code de référence / Transaction ID</strong> contenu dans le SMS de confirmation reçu de votre opérateur. Saisissez-le ci-dessous pour que l'enregistrement de votre reçu soit normalisé.
              </span>
            </div>
          </div>
        </div>

        {/* Declaration and Registration form */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold uppercase text-gray-400 tracking-wider text-left">
            3. Enregistrer et Déclarer votre paiement d'abonnement
          </h3>

          <form onSubmit={handlePageManualPaymentSubmit} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs text-left">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider border-b dark:border-slate-800 pb-2 mb-2">
              Formulaire officiel d'enregistrement de reçu
            </h4>

            {/* Selector operator */}
            <div>
              <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">1. Opérateur mobile utilisé</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'orange', name: 'Orange Money' },
                  { id: 'moov', name: 'Moov Money' },
                  { id: 'wave', name: 'Wave Cash' }
                ].map(op => (
                  <div
                    key={op.id}
                    onClick={() => {
                      setManualOperator(op.id as any);
                      playSound('correct');
                    }}
                    className={cn(
                      "p-3 rounded-xl border text-center cursor-pointer transition-all flex flex-col items-center justify-center text-xs font-black",
                      manualOperator === op.id 
                        ? "bg-faso-green/10 border-faso-green text-faso-green dark:text-faso-green" 
                        : "bg-gray-50 dark:bg-slate-950/20 border-gray-200 dark:border-slate-800 dark:text-gray-400 hover:border-gray-300"
                    )}
                  >
                    {op.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Sender Phone and Full Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                  2. Votre numéro de téléphone payeur
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">+226</span>
                  <input
                    type="text"
                    required
                    placeholder="76 00 11 22"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="w-full p-2.5 pl-12 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                  3. Nom complet déclaré de l'expéditeur
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ibrahim Sawadogo"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white"
                />
              </div>
            </div>

            {/* Reference & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                  4. Montant envoyé (FCFA)
                </label>
                <input
                  type="number"
                  disabled
                  value={manualAmount}
                  className="w-full p-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-500 dark:text-gray-400 opacity-80"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                  5. Code de référence / ID de transaction
                </label>
                <input
                  type="text"
                  required
                  placeholder="Saisissez la référence du SMS d'envoi"
                  value={manualReference}
                  onChange={(e) => setManualReference(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-250 dark:border-slate-800 rounded-xl focus:border-faso-blue outline-none text-xs dark:text-white uppercase tracking-wider font-mono font-bold"
                />
              </div>
            </div>

            {/* Simulate test buttons */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-slate-100 dark:bg-slate-950/40 rounded-xl border border-gray-200/50 dark:border-slate-850">
              <button
                type="button"
                onClick={() => {
                  setManualPhone('76123456');
                  setManualName(profile.name || 'Ibrahim Sawadogo');
                  setManualReference(`OMF-${Math.floor(Math.random() * 90000 + 10000)}`);
                  playSound('correct');
                }}
                className="text-[10px] text-faso-green hover:underline cursor-pointer w-fit font-bold"
              >
                💡 Cliquer pour simuler des données de dépôt test cohérentes
              </button>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-faso-green to-faso-blue hover:from-green-600 hover:to-blue-600 font-extrabold rounded-xl shadow-md transition-all text-slate-950 uppercase text-xs tracking-wider cursor-pointer font-black"
            >
              Enregistrer mon reçu & déclarer mon paiement 📥
            </button>
          </form>
        </div>

        {/* Transaction History Logs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase text-gray-400 tracking-wider">
              4. Vos déclarations de règlement enregistrées
            </h3>
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 font-mono">
              ({userTxs.length} déclarée{userTxs.length > 1 ? 's' : ''})
            </span>
          </div>

          {userTxs.length === 0 ? (
            <div className="py-12 bg-white dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl text-center space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium max-w-sm mx-auto flex items-center justify-center gap-1.5">
                <span>Aucun dépôt manuel déclaré pour votre adresse e-mail.</span>
              </p>
              <p className="text-[10px] text-gray-400 max-w-sm mx-auto leading-normal px-4">
                Configurez le forfait ci-dessus, effectuez l'envoi mobile puis déclarez le reçu en remplissant le formulaire ci-dessus pour activation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {userTxs.map(tx => (
                <div 
                  key={tx.id}
                  className={cn(
                    "p-4 rounded-xl border transition-all text-xs font-mono relative bg-white dark:bg-slate-900 text-left",
                    tx.status === 'pending' ? "border-amber-500/30 dark:bg-amber-500/5 bg-amber-50/20" :
                    tx.status === 'approved' ? "border-faso-green/30 dark:bg-faso-green/5 bg-emerald-50/20" : "border-slate-800 bg-slate-950/40"
                  )}
                >
                  <div className="absolute top-4 right-4 text-[10px] font-black uppercase">
                    {tx.status === 'pending' && <span className="text-amber-600 bg-amber-500/15 px-2.5 py-1 rounded-md">🟡 En attente</span>}
                    {tx.status === 'approved' && <span className="text-emerald-600 bg-faso-green/15 px-2.5 py-1 rounded-md">✅ Validé</span>}
                    {tx.status === 'rejected' && <span className="text-rose-500 bg-rose-500/15 px-2.5 py-1 rounded-md">❌ Rejeté</span>}
                  </div>

                  <div className="space-y-1 whitespace-pre-line text-xs font-medium dark:text-sky-100 text-gray-800">
                    <div>
                      <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">Bénéficiaire Faso Educ</span>
                      <strong className="text-gray-900 dark:text-white">{tx.userName}</strong> ({tx.userEmail})
                    </div>
                    <div className="pt-1.5">
                      <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">Mode dépôt déclaré</span>
                      <span className="font-bold text-gray-700 dark:text-gray-200 uppercase">{tx.operator} Money</span> • {tx.phone}
                    </div>
                    <div className="pt-1.5">
                      <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">Montant et ID de transac</span>
                      <strong className="text-amber-600 dark:text-amber-300 font-black text-sm">{tx.amount} FCFA</strong> • <code className="bg-gray-100 dark:bg-slate-950 border dark:border-transparent px-1.5 py-0.5 rounded text-faso-blue font-bold">{tx.reference}</code>
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 pt-2 font-light text-left">
                      Date déclaration : {safeFormatDate(tx.date, true)}
                    </div>
                  </div>

                  {tx.status === 'pending' && (
                    <div className="mt-3.5 pt-2.5 border-t border-gray-100 dark:border-slate-800/80 text-[10px] text-indigo-500 dark:text-indigo-400 font-bold bg-indigo-500/5 p-2 rounded-lg leading-relaxed text-left">
                      💡 <strong>Raccourci Démo :</strong> Ouvrez l'espace <strong>🛠️ Admin</strong> en haut à droite du header principal pour confirmer/approuver ce dépôt !
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdminModal = () => {
    // If Admin is locked, show a highly secure login panel
    if (!isAdminUnlocked) {
      const handleAdminUnlockSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const emailClean = adminInputEmail.trim().toLowerCase();
        const codeClean = adminInputPasscode.trim();

        if (emailClean === 'ibrahimsawadogo36@gmail.com' && codeClean === 'IBRAHIM_FASO_2026') {
          setIsAdminUnlocked(true);
          setAdminUnlockError(null);
          localStorage.setItem('faso_educ_admin_unlocked', 'true');
          playSound('finish');
        } else {
          setAdminUnlockError("Identifiants ou code d'activation réseau incorrect. Accès refusé.");
          playSound('wrong');
        }
      };

      return (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-violet-500/30 rounded-3xl overflow-hidden shadow-2xl p-8 relative space-y-6">
            <button 
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-full text-gray-400 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-violet-600/10 border border-violet-500/30 text-violet-400 rounded-full flex items-center justify-center text-3xl mx-auto shadow-lg">
                🔐
              </div>
              <h3 className="text-xl font-black bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent">
                Administration Réseau
              </h3>
              <p className="text-xs text-gray-400 leading-normal font-medium max-w-xs mx-auto">
                Espace privé réservé exclusivement à l'administrateur de <strong>Faso Educ</strong> pour l'activation manuelle des privilèges.
              </p>
            </div>

            <form onSubmit={handleAdminUnlockSubmit} className="space-y-4 text-start">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                  Email Administrateur
                </label>
                <input 
                  type="email" 
                  required
                  placeholder="ibrahimsawadogo36@gmail.com"
                  value={adminInputEmail}
                  onChange={(e) => setAdminInputEmail(e.target.value)}
                  className="w-full p-3.5 bg-slate-950 text-white rounded-xl border border-slate-800 focus:border-violet-500 text-xs outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                  Clé Réseau Confidentielle (Code)
                </label>
                <input 
                  type="password" 
                  required
                  placeholder="Mot de passe d'usine"
                  value={adminInputPasscode}
                  onChange={(e) => setAdminInputPasscode(e.target.value)}
                  className="w-full p-3.5 bg-slate-950 text-white rounded-xl border border-slate-800 focus:border-violet-500 text-xs outline-none font-mono"
                />
              </div>

              {adminUnlockError && (
                <p className="text-[11px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                  {adminUnlockError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl cursor-pointer hover:scale-[1.01] transition-all shadow-md"
              >
                Vérifier & Ouvrir le Portail ✔
              </button>
            </form>
            
            <div className="pt-2 text-center text-[9px] text-gray-500 tracking-wide leading-normal">
              Note : Seul Ibrahim en tant que gérant peut valider ou suspendre les comptes étudiants de la plateforme depuis le serveur Render.
            </div>
          </div>
        </div>
      );
    }

    const handleBanAction = async (emailToBan: string) => {
      const cleanEmail = emailToBan.trim().toLowerCase();
      if (!cleanEmail) return;

      if (confirm(`Voulez-vous vraiment suspendre / bannir définitivement le candidat ${cleanEmail} ?`)) {
        setBannedEmails(prev => Array.from(new Set([...prev, cleanEmail])));
        playSound('wrong');

        try {
          await fetch('/api/users/ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail })
          });
        } catch (e) {
          console.warn("Offline fallback for banning registered:", e);
        }
      }
    };

    const handleUnbanAction = async (emailToUnban: string) => {
      const cleanEmail = emailToUnban.trim().toLowerCase();
      if (!cleanEmail) return;

      setBannedEmails(prev => prev.filter(e => e !== cleanEmail));
      playSound('finish');

      try {
        await fetch('/api/users/unban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail })
        });
      } catch (e) {
        console.warn("Offline fallback for unbanning registered:", e);
      }
    };

    const handleTransactionStatusUpdate = async (txId: string, status: 'approved' | 'rejected', userEmail?: string) => {
      setManualPayments(prev => prev.map(p => p.id === txId ? { ...p, status } : p));
      
      if (status === 'approved' && userEmail) {
        if (profile.email.toLowerCase() === userEmail.toLowerCase()) {
          setProfile(prev => ({ ...prev, isPremium: true }));
        }
        playSound('finish');
      } else {
        playSound('wrong');
      }

      try {
        await fetch('/api/payments/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: txId, status })
        });
      } catch (err) {
        console.warn("Status transmission error:", err);
      }
    };

    return (
      <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4 backdrop-blur-md">
        <div className="w-full max-w-2xl bg-slate-900 border border-violet-500/30 rounded-3xl overflow-hidden shadow-2xl text-left text-white flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-violet-500/20 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400 font-extrabold text-base">
                🛠️
              </div>
              <div>
                <h3 className="text-lg font-black bg-gradient-to-r from-violet-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
                  Administration Faso Educ Actif
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Simulateur cloud connecté à Supabase • Rôle : Gérant Ibrahim Sawadogo
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setIsAdminUnlocked(false);
                  localStorage.removeItem('faso_educ_admin_unlocked');
                  setShowAdminModal(false);
                  playSound('wrong');
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-gray-400 hover:text-white font-bold text-[9px] uppercase cursor-pointer transition-colors"
                title="Verrouiller le portail"
              >
                🔐 Retirer Clé
              </button>
              <button 
                onClick={() => setShowAdminModal(false)}
                className="p-2 hover:bg-slate-800 rounded-full text-gray-400 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Tab bar Selector */}
          <div className="px-6 pt-3 bg-slate-950/60 border-b border-slate-800 shrink-0 flex gap-1.5 overflow-x-auto select-none no-scrollbar">
            <button
              onClick={() => {
                setAdminModalTab('transactions');
                playSound('correct');
              }}
              className={cn(
                "px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap",
                adminModalTab === 'transactions' ? "border-violet-500 text-violet-400" : "border-transparent text-gray-400 hover:text-white"
              )}
            >
              📂 Récépissés Dépôts ({manualPayments.length})
            </button>
            <button
              onClick={() => {
                setAdminModalTab('emails');
                playSound('correct');
              }}
              className={cn(
                "px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap",
                adminModalTab === 'emails' ? "border-violet-500 text-violet-400" : "border-transparent text-gray-400 hover:text-white"
              )}
            >
              📧 Boîte de Réception
              {manualPayments.filter(tx => tx.status === 'pending').length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              )}
            </button>
            <button
              onClick={() => {
                setAdminModalTab('banList');
                playSound('correct');
              }}
              className={cn(
                "px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                adminModalTab === 'banList' ? "border-violet-500 text-violet-400" : "border-transparent text-gray-400 hover:text-white"
              )}
            >
              🚫 Bannissements ({bannedEmails.length})
            </button>
          </div>

          {/* Modal content body */}
          <div className="p-6 overflow-y-auto flex-1 bg-slate-900/50 space-y-4">
            {adminModalTab === 'transactions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Répertoire des transactions de dépôt manuel</span>
                  <button
                    onClick={() => {
                      if (confirm("Voulez-vous réinitialiser toutes les transactions ?")) {
                        setManualPayments([]);
                        localStorage.removeItem('faso_educ_manual_payments');
                      }
                    }}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer font-bold"
                  >
                    Effacer l'historique admin
                  </button>
                </div>

                {manualPayments.length === 0 ? (
                  <div className="py-12 text-center space-y-2 border border-dashed border-slate-800 rounded-2xl">
                    <p className="text-xs text-gray-400 max-w-sm mx-auto text-center">
                      Aucun dépôt manuel enregistré pour l'instant. 
                    </p>
                    <p className="text-[11px] text-indigo-400 max-w-md mx-auto text-center font-medium px-4 leading-normal">
                      💡 Cliquez sur l'option <strong>"Premium d'Élite"</strong> en haut ou au bas, choisissez <strong>"Dépôt Mobile (Manuel)"</strong>, puis soumettez une déclaration pour l'approuver ou la rejeter ici !
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {manualPayments.map(tx => (
                      <div 
                        key={tx.id}
                        className={cn(
                          "p-4 rounded-xl border transition-all text-xs font-mono relative",
                          tx.status === 'pending' ? "border-amber-500/30 bg-amber-500/5" :
                          tx.status === 'approved' ? "border-faso-green/30 bg-faso-green/5" : "border-slate-800 bg-slate-950/40"
                        )}
                      >
                        {/* Transaction status float */}
                        <div className="absolute top-4 right-4 text-[10px] font-black uppercase">
                          {tx.status === 'pending' && <span className="text-amber-500 bg-amber-500/15 px-2.5 py-1 rounded-md">🔴 En attente</span>}
                          {tx.status === 'approved' && <span className="text-faso-green bg-faso-green/15 px-2.5 py-1 rounded-md mb-2 block text-center">✅ Validé</span>}
                          {tx.status === 'rejected' && <span className="text-red-400 bg-red-400/15 px-2.5 py-1 rounded-md text-center block">❌ Rejeté</span>}
                        </div>

                        <div className="space-y-1.5 text-left max-w-[70%] text-sky-100">
                          <div>
                            <span className="text-[10px] text-gray-400 block">Candidat :</span>
                            <span className="font-extrabold text-white text-xs">{tx.userName}</span> ({tx.userEmail})
                          </div>
                          <div className="pt-1">
                            <span className="text-[10px] text-gray-400 block">Détails Dépôt Manuel :</span>
                            <span className="font-bold text-gray-205 uppercase">{tx.operator} Money</span> • {tx.phone}
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 block">Montant / Référence :</span>
                            <strong className="text-amber-300 font-black text-sm">{tx.amount} FCFA</strong> • <code className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-faso-blue font-bold">{tx.reference}</code>
                          </div>
                          <div className="text-[9px] text-gray-500 pt-1">
                            Soumis le : {safeFormatDate(tx.date)}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap gap-2 justify-end">
                          {/* Ban directly from transaction tab option */}
                          {!bannedEmails.includes(tx.userEmail.trim().toLowerCase()) ? (
                            <button
                              type="button"
                              onClick={() => handleBanAction(tx.userEmail)}
                              className="px-2.5 py-1.5 bg-slate-950 text-red-400 hover:bg-red-500/10 border border-red-500/10 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer"
                            >
                              🚫 Bannir Candidat
                            </button>
                          ) : (
                            <span className="text-red-500 bg-red-500/10 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider">
                              Suspension Active 🔒
                            </span>
                          )}

                          {tx.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleTransactionStatusUpdate(tx.id, 'rejected')}
                                className="px-3 py-1.5 bg-slate-950 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold hover:bg-rose-500/10 cursor-pointer"
                              >
                                Rejeter
                              </button>
                              <button
                                onClick={() => handleTransactionStatusUpdate(tx.id, 'approved', tx.userEmail)}
                                className="px-4 py-1.5 bg-gradient-to-r from-faso-green to-emerald-500 text-slate-950 font-black rounded-lg text-[10px] hover:scale-[1.01] cursor-pointer"
                              >
                                Valider & Activer Premium ✔
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {adminModalTab === 'emails' && (
              <div className="space-y-4">
                <p className="text-xs text-start text-gray-400 font-medium leading-normal">
                  Ce simulateur de messagerie reproduit l'e-mail de notification automatique de Faso-Educ reçu par l'administrateur de l'application (Ibrahim Sawadogo). Vous pouvez cliquer sur "Valider le paiement" directement depuis l'e-mail reçu pour activer l'abonnement du candidat !
                </p>

                {manualPayments.filter(tx => tx.status === 'pending').length === 0 ? (
                  <div className="py-12 text-center space-y-2 border border-dashed border-slate-800 rounded-2xl">
                    <p className="text-xs text-gray-400 max-w-sm mx-auto text-center font-medium">
                      Boîte de messagerie vide. Aucun e-mail de paiement en attente.
                    </p>
                    <p className="text-[11px] text-indigo-400 max-w-md mx-auto text-center font-medium px-4">
                      Lorsqu'un candidat soumet un formulaire de validation de dépôt, un e-mail apparaît instantanément ici avec un bouton de validation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {manualPayments.filter(tx => tx.status === 'pending').map(tx => (
                      <div key={`email-${tx.id}`} className="bg-slate-950 border border-violet-500/20 rounded-2xl overflow-hidden shadow-lg">
                        
                        {/* Simulated Mail Header */}
                        <div className="bg-slate-900 border-b border-slate-800 p-4 font-sans text-xs flex flex-col gap-2.5 text-start">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-300">De :</span>
                            <span className="text-gray-400 font-mono">system@faso-educ.net</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-800/50 pt-1.5">
                            <span className="font-bold text-gray-300">À :</span>
                            <span className="text-faso-green font-mono">ibrahimsawadogo36@gmail.com</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-800/50 pt-1.5">
                            <span className="font-bold text-gray-300">Objet :</span>
                            <span className="text-white font-black">🔔 [ADMIN ACTION] Nouveau dépôt manuel de {tx.userName} à valider</span>
                          </div>
                          <div className="text-[10px] text-gray-500 text-right mt-1">
                            Reçu le : {safeFormatDate(tx.date, true)}
                          </div>
                        </div>

                        {/* Simulated Mail Content Box */}
                        <div className="p-6 bg-slate-950 text-left text-xs leading-relaxed space-y-4">
                          <p className="text-slate-300">
                            Bonjour <strong>Ibrahim</strong>,
                          </p>
                          <p className="text-slate-400">
                            Un candidat vient de soumettre une preuve de transfert d'argent mobile pour valider son forfait <strong>{tx.amount === 2500 ? 'Mensuel' : 'Annuel'}</strong>.
                          </p>

                          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2 text-slate-300">
                            <p className="text-xs font-bold border-b border-slate-805 pb-1.5 text-violet-400 uppercase tracking-wider">
                              📋 Récépissé de règlement :
                            </p>
                            <p>🧑‍💻 <strong>Candidat :</strong> {tx.userName} ({tx.userEmail})</p>
                            <p>📱 <strong>Téléphone Payeur :</strong> +226 {tx.phone}</p>
                            <p>💵 <strong>Montant Estimé :</strong> {tx.amount} FCFA</p>
                            <p>🔑 <strong>Réseau Opérateur :</strong> <strong className="uppercase">{tx.operator} Money</strong></p>
                            <p>🔢 <strong>Code Transac ID :</strong> <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-300">{tx.reference}</code></p>
                          </div>

                          <div className="py-2">
                            <button
                              type="button"
                              onClick={() => handleTransactionStatusUpdate(tx.id, 'approved', tx.userEmail)}
                              className="w-full py-3.5 bg-gradient-to-r from-faso-green to-emerald-500 text-slate-950 font-black uppercase text-xs rounded-xl hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                            >
                              <span>✔ Valider l'accès de ce profil</span>
                            </button>
                            <p className="text-[10px] text-gray-500 text-center mt-2 italic">
                              En cliquant ci-dessus, vous confirmez que les fonds de <strong>{tx.amount} FCFA</strong> ont bien été reçus sur votre mobile money.
                            </p>
                          </div>

                          <div className="border-t border-slate-800 pt-4 text-gray-500 text-[11px]">
                            Cordialement,<br />
                            <strong>L'équipe d'Automatisation Faso-Educ Net</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {adminModalTab === 'banList' && (
              <div className="space-y-4">
                <div className="bg-slate-950/60 border border-red-500/20 rounded-2xl p-4 text-xs text-slate-300 space-y-1.5">
                  <p className="font-black text-red-400 uppercase">🛡️ Gestion de sécurité & Suspensions</p>
                  <p className="text-gray-400 text-[11px] leading-relaxed">
                    Les candidats figurant sur cette liste sont immédiatement bloqués lors de leur authentification au service Faso Educ. Pratique en cas de faux reçus de mobile money ou de spams frauduleux sur le forum.
                  </p>
                </div>

                {/* Form to ban manually */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = (e.currentTarget.elements.namedItem('banEmail') as HTMLInputElement);
                    const val = input.value.trim();
                    if (val) {
                      handleBanAction(val);
                      input.value = '';
                    }
                  }}
                  className="flex gap-2"
                >
                  <input 
                    name="banEmail"
                    type="email" 
                    required 
                    placeholder="Saisir l'e-mail du candidat à bannir (ex. fraudeur@domain.com)"
                    className="flex-1 p-3 bg-slate-950 text-white border border-slate-800 focus:border-red-500 text-xs rounded-xl outline-none text-left"
                  />
                  <button
                    type="submit"
                    className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer"
                  >
                    🚫 Bannir l'adresse
                  </button>
                </form>

                <div className="space-y-2 pt-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-start">Comptes actuellement suspendus ({bannedEmails.length}) :</p>
                  {bannedEmails.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-4 text-center border border-dashed border-slate-800 rounded-2xl">Aucun utilisateur banni pour le moment. Félicitations pour la probité des bénéficiaires !</p>
                  ) : (
                    <div className="space-y-2">
                      {bannedEmails.map(bEmail => (
                        <div key={bEmail} className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-805 rounded-xl font-mono text-xs">
                          <span className="text-red-300 font-bold">{bEmail}</span>
                          <button
                            onClick={() => handleUnbanAction(bEmail)}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-faso-green rounded-lg text-[10px] font-black uppercase cursor-pointer"
                          >
                            🔓 Réhabiliter (Débannir)
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5.5 bg-slate-950 border-t border-slate-800 text-center text-[11px] text-gray-500 shrink-0">
            Faso-Educ Security Module • Validation d'abonnements certifiée
          </div>

        </div>
      </div>
    );
  };


  const renderTrialInfoAlert = () => {
    const daysLeft = getTrialDaysRemaining();
    if (profile.isPremium) {
      return (
        <div className="bg-gradient-to-r from-faso-green/10 via-faso-blue/10 to-faso-green/10 border-y border-faso-green/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 bg-faso-green rounded-full animate-ping" />
            <span className="text-xs font-black text-faso-green uppercase tracking-wider flex items-center gap-1.5">
              👑 Abonnement Premium Actif
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:inline">
              | Générations illimitées d'IA & Certifications de concours déverrouillées.
            </span>
          </div>
          <div className="text-xs font-mono font-bold text-faso-blue">
            Licence d'Élite
          </div>
        </div>
      );
    }

    if (daysLeft <= 0) {
      return (
        <div className="bg-gradient-to-r from-faso-red/10 via-amber-500/10 to-faso-red/10 border-y border-faso-red/20 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2">
            <XCircle className="text-faso-red shrink-0" size={16} />
            <div>
              <span className="text-xs font-extrabold text-faso-red uppercase tracking-wider block sm:inline">
                ⚠️ Période d'essai expirée
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium ml-1">
                Vos 7 jours d'essai gratuits sont terminés. Passez au premium pour débloquer de nouveau l'arène et les quiz.
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowCheckoutModal(true)}
            className="px-4 py-2 bg-faso-blue hover:bg-faso-blue/80 text-white font-extrabold text-[10px] uppercase rounded-lg shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            S'abonner maintenant
          </button>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-r from-faso-yellow/10 via-faso-green/10 to-faso-yellow/10 border-y border-faso-yellow/20 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="text-faso-green shrink-0" size={16} />
          <div>
            <span className="text-xs font-black text-faso-green uppercase tracking-wider">
              ✨ Version d'évaluation : {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium ml-1">
              Profitez sereinement de Faso Educ. Vous pouvez à tout moment passer au Premium.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setProfile(prev => ({
                ...prev,
                simulatedTimeShiftDays: (prev.simulatedTimeShiftDays || 0) + 7
              }));
              playSound('correct');
            }}
            className="px-2.5 py-1.5 bg-gray-200 dark:bg-gray-800 text-gray-750 dark:text-gray-300 font-bold text-[9px] uppercase rounded-md border border-gray-300/30 hover:border-gray-300 cursor-pointer"
            title="Simule le passage d'une semaine entière pour tester l'expiry et le paiement"
          >
            Passer 7 jours ⏩
          </button>
          <button
            onClick={() => {
              setActiveTab('Paiement');
              playSound('correct');
            }}
            className="px-4 py-1.5 bg-linear-to-r from-faso-green to-faso-blue text-white font-extrabold text-[10px] uppercase rounded-lg shadow-sm transition-all hover:scale-[1.01] cursor-pointer"
          >
            Premium d'Élite
          </button>
        </div>
      </div>
    );
  };

  if (!profile.registered) {
    return renderRegistration();
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-300">
      {/* Premium Transparent Glass Header */}
      <header className="glass-panel border-b border-gray-200/50 dark:border-gray-800/50 p-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-linear-to-br from-faso-green to-faso-blue rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-xl">F</span>
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight dark:text-white block leading-none">ReFaso Educ</span>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mt-1">Préparation d'Élite</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs font-black dark:text-white leading-none">{profile.name}</span>
            <span className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-wider">{profile.level}</span>
          </div>
          {profile.isPremium ? (
            <div className="px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-500 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              👑 Premium
            </div>
          ) : (
            <button 
              onClick={() => {
                setActiveTab('Paiement');
                playSound('correct');
              }}
              className="px-2.5 py-1.5 bg-faso-green/10 border border-faso-green/35 hover:bg-faso-green/20 rounded-lg text-faso-green text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all animate-pulse"
            >
              Essai
            </button>
          )}
          <button 
            onClick={() => {
              setShowAdminModal(true);
              playSound('correct');
            }}
            className="px-3 py-2.5 bg-violet-500/10 hover:bg-violet-500/25 text-violet-500 dark:text-violet-400 font-extrabold text-[10px] uppercase rounded-xl transition-all border border-violet-500/20 cursor-pointer flex items-center gap-1.5"
            title="Espace de validation d'abonnements"
          >
            <span>🛠️ Admin</span>
            {manualPayments.filter(tx => tx.status === 'pending').length > 0 && (
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
            )}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-3 bg-gray-100/50 dark:bg-gray-900/50 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-all border border-gray-200/20 cursor-pointer"
            title="Paramètres de l'application"
          >
            <SettingsIcon size={20} className="text-gray-650 dark:text-gray-350" />
          </button>
        </div>
      </header>

      {/* Trial period Alert Indicator Banner */}
      {renderTrialInfoAlert()}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'Accueil' && renderHome()}
        {activeTab === 'Historique' && renderHistory()}
        {activeTab === 'Cours' && renderCourses()}
        {activeTab === 'Forum' && renderForum()}
        {activeTab === 'Paiement' && renderPaiement()}
        {activeTab === 'Espace' && renderEspace()}
        {activeTab === 'Competition' && (
          <CompetitionArena 
            onBack={() => setActiveTab('Accueil')}
            onSaveToHistory={(res) => setHistory(prev => [res, ...prev])}
            soundEnabled={settings.soundEnabled}
          />
        )}
        {(activeTab === 'Entraînement' || activeTab === 'Test' || activeTab === 'Concours') && renderQuiz()}
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && renderSettings()}
      </AnimatePresence>

      {/* Advanced Bottom Navigation Glass Panel */}
      {!quizState && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-800/50 p-2 flex justify-around items-center z-30 shadow-lg">
          <button 
            onClick={() => setActiveTab('Accueil')}
            className={cn(
              "flex flex-col items-center p-2.5 rounded-2xl transition-all cursor-pointer",
              activeTab === 'Accueil' ? "text-faso-green bg-faso-green/10" : "text-gray-400 dark:text-gray-600 hover:text-gray-605"
            )}
          >
            <HomeIcon size={22} />
            <span className="text-[10px] font-bold uppercase mt-1">Accueil</span>
          </button>
          <button 
            onClick={() => {
              setActiveTab('Cours');
              setSelectedCourse(null);
            }}
            className={cn(
              "flex flex-col items-center p-2.5 rounded-2xl transition-all cursor-pointer",
              activeTab === 'Cours' ? "text-faso-green bg-faso-green/10" : "text-gray-400 dark:text-gray-600 hover:text-gray-605"
            )}
          >
            <BookOpen size={22} />
            <span className="text-[10px] font-bold uppercase mt-1">Académie</span>
          </button>
          <button 
            onClick={() => {
              setActiveTab('Competition');
            }}
            className={cn(
              "flex flex-col items-center p-2.5 rounded-2xl transition-all cursor-pointer",
              activeTab === 'Competition' ? "text-faso-green bg-faso-green/10" : "text-gray-400 dark:text-gray-600 hover:text-gray-605"
            )}
          >
            <Trophy size={22} />
            <span className="text-[10px] font-bold uppercase mt-1">Arène Live</span>
          </button>
          <button 
            onClick={() => {
              setActiveTab('Forum');
              setSelectedPostId(null);
            }}
            className={cn(
              "flex flex-col items-center p-2.5 rounded-2xl transition-all cursor-pointer",
              activeTab === 'Forum' ? "text-faso-green bg-faso-green/10" : "text-gray-400 dark:text-gray-600 hover:text-gray-605"
            )}
          >
            <Users size={22} />
            <span className="text-[10px] font-bold uppercase mt-1">Communauté</span>
          </button>
          <button 
            onClick={() => {
              setActiveTab('Paiement');
              playSound('correct');
            }}
            className={cn(
              "flex flex-col items-center p-2.5 rounded-2xl transition-all cursor-pointer",
              activeTab === 'Paiement' ? "text-faso-green bg-faso-green/10" : "text-gray-400 dark:text-gray-600 hover:text-gray-605"
            )}
          >
            <CreditCard size={22} />
            <span className="text-[10px] font-bold uppercase mt-1">Abonnement</span>
          </button>
          <button 
            onClick={() => {
              setActiveTab('Espace');
              playSound('correct');
            }}
            className={cn(
              "flex flex-col items-center p-2.5 rounded-2xl transition-all cursor-pointer",
              activeTab === 'Espace' ? "text-faso-green bg-faso-green/10" : "text-gray-400 dark:text-gray-600 hover:text-gray-605"
            )}
          >
            <User size={22} />
            <span className="text-[10px] font-bold uppercase mt-1">Mon Espace</span>
          </button>
          <button 
            onClick={() => setActiveTab('Historique')}
            className={cn(
              "flex flex-col items-center p-2.5 rounded-2xl transition-all cursor-pointer",
              activeTab === 'Historique' ? "text-faso-green bg-faso-green/10" : "text-gray-400 dark:text-gray-600 hover:text-gray-605"
            )}
          >
            <HistoryIcon size={22} />
            <span className="text-[10px] font-bold uppercase mt-1">Bibliothèque</span>
          </button>
        </nav>
      )}

      {/* Checkout selection modal */}
      {showCheckoutModal && renderCheckoutModal()}

      {/* Admin management modal */}
      {showAdminModal && renderAdminModal()}
    </div>
  );
}
