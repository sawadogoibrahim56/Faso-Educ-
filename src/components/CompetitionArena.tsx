import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  UserPlus, 
  Settings, 
  Play, 
  Sparkles, 
  Clock, 
  Check, 
  Volume2, 
  VolumeX, 
  Download, 
  ArrowLeft, 
  Loader2, 
  Share2, 
  User, 
  Plus, 
  X, 
  ArrowRight,
  ChevronRight,
  MessageSquare,
  Award,
  Zap,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Question, Level, QuizSettings, Difficulty } from '../types';
import { generateQuizQuestions } from '../services/geminiService';
import { MathRenderer } from './MathRenderer';
import { jsPDF } from 'jspdf';
import { getApiUrl } from '../lib/api';

const ProgressBar = ({ progress, color = "bg-faso-blue" }: { progress: number, color?: string }) => (
  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
    <motion.div 
      className={cn("h-full rounded-full transition-all duration-300", color)}
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
    />
  </div>
);

// Simulated names of Burkinabè peers for realism
const SIMULATED_NAMES = [
  'Adama Ouédraogo',
  'Fatoumata Barro',
  'Inoussa Sawadogo',
  'Mariam Diallo',
  'Kader Traoré',
  'Salif Sanou',
  'Sita Coulibaly',
  'Ousmane Kambou',
  'Sonia Bamogo',
  'Bernadette Somé',
  'Seydou Zongo',
  'Chantal Ilboudo',
  'Fousseni Barry',
  'Alassane Nacoulma',
  'Yacouba Tall'
];

// Fun realistic phrases candidates say based on their correct or wrong answers
const REACTION_PHRASES_CORRECT = [
  "Ouf, l'équilibre de marché est validé !",
  "Excellent ! La formule du multiplicateur est tellement logique.",
  "Oui ! C'était bien la proposition correcte.",
  "La dérivée première s'annule bien en ce point maximum.",
  "C'est exactement la doctrine administrative !",
  "Facile, j'avais révisé cette formule hier soir sur Faso Educ.",
  "Génial ! Ça me fait de précieux points."
];

const REACTION_PHRASES_WRONG = [
  "Mince, j'ai confondu la dérivée première et seconde...",
  "Ah ! J'ai choisi l'option inverse par manque de temps.",
  "Oups, j'ai lu trop vite la contrainte budgétaire.",
  "Le temps file trop vite sous stress...",
  "Je me suis fait avoir par le distracteur B !",
  "Aïe, ce modèle de Solow mérite que je reprenne mes cours.",
  "C'est rageant, l'erreur d'inadvertance est fatale."
];

interface Participant {
  id: string;
  name: string;
  isAI: boolean;
  score: number;
  accuracy: number; // 0.4 to 0.85
  speed: number;    // average seconds taken to answer
  status: 'thinking' | 'answered' | 'waiting';
  lastTimeTaken?: number;
  lastSelectedOption?: number | null;
  lastAnswerCorrect?: boolean;
}

interface ChatMessage {
  id: string;
  senderName: string;
  isAI: boolean;
  isUser: boolean;
  text: string;
  time: string;
}

interface CompetitionArenaProps {
  onBack: () => void;
  onSaveToHistory: (result: any) => void;
  soundEnabled: boolean;
  profile: any;
  initialSharedRoomNumber?: number | null;
  initialSharedInviteId?: string | null;
  onlineUsers?: any[];
}

export const CompetitionArena: React.FC<CompetitionArenaProps> = ({ 
  onBack, 
  onSaveToHistory,
  soundEnabled: initialSoundEnabled,
  profile,
  initialSharedRoomNumber,
  initialSharedInviteId,
  onlineUsers = []
}) => {
  // Stage: 'setup' | 'lobby' | 'active' | 'podium'
  const [stage, setStage] = useState<'setup' | 'lobby' | 'active' | 'podium'>('setup');
  const [arenaType, setArenaType] = useState<'solo' | 'robots' | 'multiplayer'>('solo');
  
  // Settings
  const [subject, setSubject] = useState<string>("Microéconomie Moderne (Cobb-Douglas & Cournot)");
  const [level, setLevel] = useState<Level>("Licence");
  const [difficulty, setDifficulty] = useState<Difficulty>("Moyen");
  const [questionCount, setQuestionCount] = useState<number>(8);
  const [timeLimit, setTimeLimit] = useState<number>(45); // seconds per question
  const [aiCount, setAiCount] = useState<number>(5);
  const [aiCompetition, setAiCompetition] = useState<boolean>(true);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("Moyen");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(initialSoundEnabled);
  
  // Human inviting
  const [customInvitations, setCustomInvitations] = useState<string[]>([]);
  const [newInviteName, setNewInviteName] = useState<string>("");
  const [searchCompetitorQuery, setSearchCompetitorQuery] = useState<string>("");
  const [searchedCompetitors, setSearchedCompetitors] = useState<any[]>([]);
  const [isSearchingCompetitors, setIsSearchingCompetitors] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [roomNumber, setRoomNumber] = useState<number>(() => {
    return initialSharedRoomNumber || Math.floor(Math.random() * 90000 + 10000);
  });
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(!!initialSharedRoomNumber);
  const [multiplayerRole, setMultiplayerRole] = useState<'host' | 'invitee' | null>(() => {
    if (initialSharedRoomNumber) return 'invitee';
    return null;
  });
  const [invitationStatus, setInvitationStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected'>(() => {
    if (initialSharedRoomNumber) return 'accepted';
    return 'none';
  });
  const [invitedPeerName, setInvitedPeerName] = useState<string>("");
  const [invitedPeerEmail, setInvitedPeerEmail] = useState<string>("");

  // Game Play State
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("CHARGEMENT DES INFRASTRUCTURES DE L'ARÈNE...");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const lastInvitationStatusRef = useRef<string>('none');

  // Automated simulation of progress & professional patience messages during QCM launch loading screen
  useEffect(() => {
    if (!loadingQuestions) {
      setProgressPercent(0);
      return;
    }

    const messages = [
      "Interrogation des bases de données académiques Faso Educ...",
      "Calibration de l'intelligence artificielle générative...",
      "Calage des barèmes et des niveaux d'exigence académique...",
      "Rédaction des QCM avec l'algorithme d'Élite...",
      "Élaboration des corrigés explicatifs détaillés...",
      "Optimisation de la structure cognitive des énoncés...",
      "Scellage informatique inviolable des fiches-réponses...",
      "Ouverture officielle du canal de synchronisation du concours..."
    ];

    let messageIdx = 0;
    setLoadingMessage(messages[0]);

    const msgInterval = setInterval(() => {
      messageIdx = (messageIdx + 1) % messages.length;
      setLoadingMessage(messages[messageIdx]);
    }, 1750);

    const progressInterval = setInterval(() => {
      setProgressPercent(prev => {
        if (prev >= 98) {
          return 98;
        }
        const delta = Math.floor(Math.random() * 8) + 3;
        return Math.min(98, prev + delta);
      });
    }, 300);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, [loadingQuestions]);

  // Alert chime for multiplayer lobby when invitee joins
  useEffect(() => {
    if (isMultiplayer && multiplayerRole === 'host') {
      if (invitationStatus === 'accepted' && lastInvitationStatusRef.current !== 'accepted') {
        playSound('correct');
        setChatMessages(prev => [
          ...prev,
          {
            id: `chat-joined-${Date.now()}`,
            senderName: 'Système Arène',
            isAI: false,
            isUser: false,
            text: `🎉 Votre adversaire a accepté le défi et vient de s'installer à sa table d'examen ! Vous pouvez maintenant lancer l'épreuve.`,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    }
    lastInvitationStatusRef.current = invitationStatus;
  }, [invitationStatus, isMultiplayer, multiplayerRole]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [timeLeft, setLeftTime] = useState<number>(45);
  const [userAnswer, setUserAnswer] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackTimeLeft, setFeedbackTimeLeft] = useState<number>(8);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Live candidates list (User, Invited Humans, active IAs)
  const [participants, setParticipants] = useState<Participant[]>([]);
  // Chat / commentary activity
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const responseTimersRef = useRef<number[]>([]);
  const lastSelectedTimeRef = useRef<number | null>(null);

  // Sound play function
  const playSound = (type: 'correct' | 'wrong' | 'countdown' | 'finish' | 'chat') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      const now = audioCtx.currentTime;
      
      if (type === 'correct') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'wrong') {
        osc.frequency.setValueAtTime(220, now); // A3
        osc.frequency.setValueAtTime(147, now + 0.15); // D3
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'countdown') {
        osc.frequency.setValueAtTime(440, now); // A4
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'finish') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'chat') {
        osc.frequency.setValueAtTime(880, now); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      }
    } catch (e) {
      // AudioContext fails gracefully in quiet mode browser contexts
    }
  };

  // Searching competitors registered on platforms
  useEffect(() => {
    let active = true;
    if (!searchCompetitorQuery.trim()) {
      setSearchedCompetitors([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearchingCompetitors(true);
      try {
        const url = getApiUrl(`/api/profiles?q=${encodeURIComponent(searchCompetitorQuery.trim())}`);
        const res = await fetch(url);
        if (res.ok && active) {
          const data = await res.json();
          // Exclude self from search
          const filteredSelf = (data || []).filter((u: any) => u.email !== profile?.email);
          setSearchedCompetitors(filteredSelf);
        }
      } catch (err) {
        console.warn("Failed searching registered competitors:", err);
      } finally {
        if (active) setIsSearchingCompetitors(false);
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [searchCompetitorQuery, profile?.email]);

  // Skip setup logic if loaded via joining a duel room number
  useEffect(() => {
    if (initialSharedRoomNumber) {
      setRoomNumber(initialSharedRoomNumber);
      setIsMultiplayer(true);
      setMultiplayerRole('invitee');
      setStage('lobby');
      
      setChatMessages([
        {
          id: 'chat-init-invitee',
          senderName: 'Système Duel',
          isAI: false,
          isUser: false,
          text: `Vous avez rejoint le salon de défi en direct #${initialSharedRoomNumber} ! Attente de lancement par l'hôte.`,
          time: 'Instant'
        }
      ]);
    }
  }, [initialSharedRoomNumber]);

  // Real-time server-side status tracker for Multiplayer games
  useEffect(() => {
    if (!isMultiplayer || !roomNumber) return;

    let isPollingAlive = true;
    const pollRoomStatus = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/competition/room/status/${roomNumber}`));
        if (res.ok && isPollingAlive) {
          const data = await res.json();
          if (data.success && data.roomState) {
            const room = data.roomState;
            const invite = data.invitation;

            // Synchronize configuration parameters
            if (invite) {
              setInvitationStatus(invite.status);
              setSubject(invite.subject);
              setLevel(invite.level);
              setQuestionCount(invite.questionCount);
              setTimeLimit(invite.timeLimit);
            }

            const hostEmail = room.hostEmail;
            const hostName = room.hostName;
            const inviteeEmail = room.inviteeEmail;
            const inviteeName = room.inviteeName;

            const isCurrentHost = profile?.email?.toLowerCase().trim() === hostEmail.toLowerCase().trim();
            setMultiplayerRole(isCurrentHost ? 'host' : 'invitee');

            // In LOBBY stage, monitor acceptances
            if (stage === 'lobby') {
              const hostPart: Participant = {
                id: hostEmail,
                name: isCurrentHost ? "Vous (Hôte)" : `${hostName} (Hôte)`,
                isAI: false,
                score: 0,
                accuracy: 1.0,
                speed: 0,
                status: 'waiting'
              };

              const inviteePart: Participant = {
                id: inviteeEmail,
                name: !isCurrentHost ? "Vous (Challenger)" : `${inviteeName} (Challenger)`,
                isAI: false,
                score: 0,
                accuracy: 1.0,
                speed: 0,
                status: invite && invite.status === 'accepted' ? 'waiting' : 'thinking'
              };

              setParticipants([hostPart, inviteePart]);

              // Automatically start active play if host transitions server
              if (room.status === 'active' && room.questions && room.questions.length > 0) {
                setQuestions(room.questions);
                setCurrentQuestionIndex(room.currentQuestionIndex);
                
                const limit = invite?.timeLimit || timeLimit;
                const elapsed = room.questionStartedAt ? Math.floor((data.serverTime - room.questionStartedAt) / 1000) : 0;
                const initialTimeLeft = Math.max(0, limit - elapsed);
                setLeftTime(initialTimeLeft);
                
                setStage('active');
                setUserAnswer(null);
                setUserAnswers(new Array(room.questions.length).fill(null));
                setShowFeedback(false);
              }
            }

            // In ACTIVE game stage
            else if (stage === 'active') {
              const answers = room.answers || {};
              const hostAnswers = answers[hostEmail] || {};
              const inviteeAnswers = answers[inviteeEmail] || {};

              const sumScore = (userAnsMap: any) => {
                let sum = 0;
                Object.keys(userAnsMap).forEach((idxStr) => {
                  const idx = Number(idxStr);
                  if (idx < currentQuestionIndex) {
                    sum += userAnsMap[idx]?.scoreAdded || 0;
                  }
                });
                return sum;
              };

              const hostCurrentAnswer = hostAnswers[currentQuestionIndex];
              const inviteeCurrentAnswer = inviteeAnswers[currentQuestionIndex];

              const isCurrentUserHost = isCurrentHost;
              const myCurrentAnswer = isCurrentUserHost ? hostCurrentAnswer : inviteeCurrentAnswer;
              const peerCurrentAnswer = isCurrentUserHost ? inviteeCurrentAnswer : hostCurrentAnswer;

              const myPart: Participant = {
                id: isCurrentUserHost ? hostEmail : inviteeEmail,
                name: isCurrentUserHost ? "Vous (Hôte)" : "Vous (Challenger)",
                isAI: false,
                score: sumScore(isCurrentUserHost ? hostAnswers : inviteeAnswers) + (myCurrentAnswer?.scoreAdded || 0),
                accuracy: 1.0,
                speed: 0,
                status: myCurrentAnswer ? 'answered' : 'thinking',
                lastSelectedOption: myCurrentAnswer?.optionIdx,
                lastAnswerCorrect: myCurrentAnswer?.isCorrect,
                lastTimeTaken: myCurrentAnswer?.timeTaken
              };

              const peerPart: Participant = {
                id: isCurrentUserHost ? inviteeEmail : hostEmail,
                name: isCurrentUserHost ? `${inviteeName} (Challenger)` : `${hostName} (Hôte)`,
                isAI: false,
                score: sumScore(isCurrentUserHost ? inviteeAnswers : hostAnswers) + (peerCurrentAnswer?.scoreAdded || 0),
                accuracy: 1.0,
                speed: 0,
                status: peerCurrentAnswer ? 'answered' : 'thinking',
                lastSelectedOption: peerCurrentAnswer?.optionIdx,
                lastAnswerCorrect: peerCurrentAnswer?.isCorrect,
                lastTimeTaken: peerCurrentAnswer?.timeTaken
              };

              setParticipants([myPart, peerPart]);

              // Setup local answer state based on server synced profile status
              if (myCurrentAnswer && userAnswer === null) {
                setUserAnswer(myCurrentAnswer.optionIdx);
              }

              // Synchronise transitions to the next indices
              if (room.currentQuestionIndex !== currentQuestionIndex) {
                if (room.currentQuestionIndex < room.questions.length) {
                  setCurrentQuestionIndex(room.currentQuestionIndex);
                  
                  const limit = invite?.timeLimit || timeLimit;
                  const elapsed = room.questionStartedAt ? Math.floor((data.serverTime - room.questionStartedAt) / 1000) : 0;
                  const initialTimeLeft = Math.max(0, limit - elapsed);
                  setLeftTime(initialTimeLeft);
                  
                  setUserAnswer(null);
                  setShowFeedback(false);
                } else {
                  playSound('finish');
                  setStage('podium');
                }
              }
              
              if (room.status === 'podium' && stage !== 'podium') {
                playSound('finish');
                setStage('podium');
              }
            }

            // In PODIUM final summary page
            else if (stage === 'podium') {
              const answers = room.answers || {};
              const hostAnswers = answers[hostEmail] || {};
              const inviteeAnswers = answers[inviteeEmail] || {};

              const sumTotalScore = (userAnsMap: any): number => {
                return (Object.values(userAnsMap) as any[]).reduce((sum: number, ans: any) => sum + (ans?.scoreAdded || 0), 0);
              };

              const myPart: Participant = {
                id: isCurrentHost ? hostEmail : inviteeEmail,
                name: isCurrentHost ? "Vous (Hôte)" : "Vous (Challenger)",
                isAI: false,
                score: sumTotalScore(isCurrentHost ? hostAnswers : inviteeAnswers),
                accuracy: 1.0,
                speed: 0,
                status: 'waiting'
              };

              const peerPart: Participant = {
                id: isCurrentHost ? inviteeEmail : hostEmail,
                name: isCurrentHost ? `${inviteeName} (Challenger)` : `${hostName} (Hôte)`,
                isAI: false,
                score: sumTotalScore(isCurrentHost ? inviteeAnswers : hostAnswers),
                accuracy: 1.0,
                speed: 0,
                status: 'waiting'
              };

              setParticipants([myPart, peerPart]);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to synchronise room:", err);
      }
    };

    pollRoomStatus();
    const interval = setInterval(pollRoomStatus, 1500);

    return () => {
      isPollingAlive = false;
      clearInterval(interval);
    };
  }, [isMultiplayer, roomNumber, stage, currentQuestionIndex, showFeedback, userAnswer, profile]);

  // Setup options for subjects
  const subjectSuggestions = [
    { title: "Microéconomie (Optimisation, Cobb-Douglas, Coûts marginaux)", category: "Microéconomie" },
    { title: "Macroéconomie (Multiplicateur keynésien, IS-LM, Modèle de Solow)", category: "Macroéconomie" },
    { title: "Statistiques & Probabilités (Correction de Bessel, Intervalles de confiance)", category: "Statistiques" },
    { title: "Politiques Publiques & Finances Nationales de l'UEMOA", category: "Économie du Développement" },
    { title: "Mathématiques Générales & Algèbre Linéaire des Concours", category: "Mathématiques" }
  ];

  // Build the live dynamic lobby
  const handleStartLobby = () => {
    setStage('lobby');
    
    // Add User
    const userPart: Participant = {
      id: 'current-user',
      name: 'Vous (Candidat)',
      isAI: false,
      score: 0,
      accuracy: 1.0,
      speed: 0,
      status: 'waiting'
    };

    // Add AIs
    const aiParts: Participant[] = [];
    for (let i = 0; i < aiCount; i++) {
      const idx = Math.floor(Math.random() * SIMULATED_NAMES.length);
      const name = SIMULATED_NAMES[idx] + " (IA)";
      // Remove to prevent exact duplicates in list
      SIMULATED_NAMES.splice(idx, 1);
      
      let accuracy = 0.55 + Math.random() * 0.25; // Default Moyen: 55% - 80%
      let speed = 6 + Math.random() * 10;        // Default Moyen: 6s - 16s
      
      if (aiDifficulty === 'Facile') {
        accuracy = 0.35 + Math.random() * 0.25;  // Facile: 35% - 60%
        speed = 10 + Math.random() * 12;         // Facile: 10s - 22s (slower)
      } else if (aiDifficulty === 'Expert') {
        accuracy = 0.75 + Math.random() * 0.22;  // Expert: 75% - 97%
        speed = 3 + Math.random() * 5;           // Expert: 3s - 8s (faster)
      }
      
      accuracy = Math.min(1.0, Math.max(0.1, accuracy));
      
      aiParts.push({
        id: `ai-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name,
        isAI: true,
        score: 0,
        accuracy,
        speed,
        status: 'waiting'
      });
    }

    // Refill simulated names list
    SIMULATED_NAMES.push(
      'Adama Ouédraogo', 'Fatoumata Barro', 'Inoussa Sawadogo', 'Mariam Diallo',
      'Kader Traoré', 'Salif Sanou', 'Sita Coulibaly', 'Ousmane Kambou',
      'Sonia Bamogo', 'Bernadette Somé', 'Seydou Zongo', 'Chantal Ilboudo'
    );

    // Add Invited Humans
    const humanParts = customInvitations.map((name, i) => ({
      id: `human-invite-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: `${name} (Invité)`,
      isAI: false, // Simulated candidate mimicking human performance
      score: 0,
      accuracy: 0.6 + Math.random() * 0.25,
      speed: 8 + Math.random() * 10,
      status: 'waiting'
    }));

    const activeAIs = arenaType === 'robots' ? aiParts : [];
    const activeHumans = (arenaType === 'robots' || arenaType === 'multiplayer') ? humanParts : [];

    setParticipants([userPart, ...activeAIs, ...activeHumans]);

    // Add inaugural greeting chat
    setChatMessages([
      {
        id: 'chat-init-1',
        senderName: 'Système Faso Arena',
        isAI: false,
        isUser: false,
        text: `Bienvenue dans la salle de concours en direct ! Sujet retenu: "${subject}". Préparation intensive de niveau ${level}.`,
        time: 'Instant'
      }
    ]);
  };

  const handleAddInviteName = () => {
    if (!newInviteName.trim()) return;
    if (customInvitations.length >= 8) {
      alert("La limite est de 8 candidats invités par session de test.");
      return;
    }
    setCustomInvitations(prev => [...prev, newInviteName.trim()]);
    setNewInviteName("");
  };

  const handleRemoveInvite = (idx: number) => {
    setCustomInvitations(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSendDirectInvite = async (targetEmail: string, targetName: string) => {
    try {
      const resp = await fetch(getApiUrl('/api/competition/invite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostEmail: profile?.email || `host-${roomNumber}@faso.bf`,
          hostName: profile?.name || `Élève Hôte`,
          inviteeEmail: targetEmail,
          roomNumber,
          subject,
          level,
          questionCount,
          timeLimit
        })
      });
      if (resp.ok) {
        playSound('chat');
        setIsMultiplayer(true);
        setMultiplayerRole('host');
        setInvitedPeerName(targetName);
        setInvitedPeerEmail(targetEmail);
        
        // Push notification message
        setChatMessages(prev => [
          {
            id: `chat-inv-${Date.now()}`,
            senderName: 'Système Duel',
            isAI: false,
            isUser: false,
            text: `Invitation envoyée à ${targetName} (${targetEmail}). En attente de son acceptation...`,
            time: 'Maintenant'
          },
          ...prev
        ]);
        
        // Also add them to customInvitations if appropriate
        setCustomInvitations(prev => {
          if (!prev.includes(targetName)) {
            return [...prev, targetName];
          }
          return prev;
        });
      }
    } catch (e) {
      console.error("Failed to send direct invite:", e);
    }
  };

  const copySimulatedLink = () => {
    setCopiedLink(true);
    const domain = typeof window !== 'undefined' ? window.location.origin : "https://faso-educ-frontend.onrender.com";
    navigator.clipboard?.writeText?.(`${domain}/lobby/competition-${roomNumber}`);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Launch the live competition (generate questions & prepare game state)
  const handleLaunchCompetition = async () => {
    setLoadingQuestions(true);
    try {
      const qSettings: QuizSettings = {
        level,
        difficulty,
        questionCount,
        timePerQuestion: timeLimit,
        soundEnabled: soundEnabled,
        aiCompetition,
        aiDifficulty
      };
      
      const generated = await generateQuizQuestions([subject], qSettings);
      
      if (generated && generated.length > 0) {
        setQuestions(generated);
        setCurrentQuestionIndex(0);
        setLeftTime(timeLimit);
        setStage('active');
        setUserAnswer(null);
        lastSelectedTimeRef.current = null;
        setUserAnswers(new Array(generated.length).fill(null));
        setShowFeedback(false);
        setIsPaused(false);

        // Sync to server if multiplayer
        if (isMultiplayer && roomNumber) {
          try {
            await fetch(getApiUrl('/api/competition/room/start'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomNumber,
                questions: generated
              })
            });
          } catch (err) {
            console.warn("Error starting room on server:", err);
          }
        }
        
        // Clear all response statuses
        setParticipants(prev => prev.map(p => ({
          ...p,
          score: 0,
          status: 'thinking',
          lastSelectedOption: null,
          lastAnswerCorrect: false
        })));

        // Greet in chat
        setChatMessages(prev => [
          ...prev,
          {
            id: `chat-start-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            senderName: 'Arbitre Faso Educ',
            isAI: false,
            isUser: false,
            text: "🚨 Le concours commence ! Répondez le plus rapidement possible pour valider vos points. Concentration !",
            time: '12:00'
          }
        ]);
      } else {
        alert("Nous n'avons pas pu charger d'équations pour ce concours. Veuillez changer de sujet ou réessayer.");
      }
    } catch (e) {
      console.error(e);
      alert("Une erreur technique est survenue lors de l'intégration de l'IA.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Rock-solid non-jittery Live Timer interval (not depending on timeLeft to avoid jitter and speed drifts)
  useEffect(() => {
    if (stage !== 'active' || isPaused || showFeedback) return;

    const timer = setInterval(() => {
      setLeftTime(prev => {
        const next = prev - 1;
        if (next > 0 && next <= 5) {
          playSound('countdown');
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, isPaused, showFeedback, currentQuestionIndex]);

  // Triggers the final question reveal/verdict solely when the timer has run out
  useEffect(() => {
    if (stage === 'active' && !isPaused && !showFeedback && timeLeft <= 0) {
      handleRevealAnswers();
    }
  }, [timeLeft, stage, isPaused, showFeedback]);

  // Automatic feedback transition to next question after 2 seconds (visual highlight transition) - no intermediate explanation shown
  useEffect(() => {
    if (!showFeedback || stage !== 'active' || isPaused) return;

    if (feedbackTimeLeft <= 0) {
      handleNextQuestion();
      return;
    }

    const timer = setTimeout(() => {
      setFeedbackTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showFeedback, stage, isPaused, feedbackTimeLeft, currentQuestionIndex]);

  // Handle simulated times for other participants (AIs & Invited peers) to answer
  useEffect(() => {
    if (stage !== 'active' || showFeedback || isPaused) return;

    // Reset participant response timers
    responseTimersRef.current = [];
    
    // Simulate each AI and simulated peer answering at a random delay
    participants.forEach((p) => {
      if (p.id === 'current-user') return; // User answers manually

      // Random delay based on speed factor
      const randomizedSpeed = Math.max(2, Math.min(timeLimit - 1, Math.floor(p.speed + (Math.random() * 8) - 4)));
      
      const timeoutId = setTimeout(() => {
        setParticipants(prev => prev.map(part => {
          if (part.id === p.id) {
            // Determine answer (probabilities of correct answer depends on accuracy setting)
            const currentQ = questions[currentQuestionIndex];
            const isCorrect = Math.random() < p.accuracy;
            let chosenOption = currentQ.correctAnswer;
            
            if (!isCorrect) {
              // Select wrong option randomly
              const wrongOptions = [0, 1, 2, 3].filter(o => o !== currentQ.correctAnswer);
              chosenOption = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
            }

            return {
              ...part,
              status: 'answered',
              lastTimeTaken: randomizedSpeed,
              lastSelectedOption: chosenOption,
              lastAnswerCorrect: isCorrect
            };
          }
          return part;
        }));

        // Periodically drop a simulated live message to state
        if (Math.random() < 0.2) {
          const nameshort = p.name.replace(" (IA)", "").replace(" (Invité)", "");
          const text = "A soumis sa copie de calcul !";
          setChatMessages(prev => [
            {
              id: `chat-sub-${Date.now()}-${p.id}-${Math.random().toString(36).substring(2, 9)}`,
              senderName: p.name,
              isAI: p.isAI,
              isUser: false,
              text,
              time: 'En direct'
            },
            ...prev.slice(0, 15) // Keep last 15 messages
          ]);
        }

      }, randomizedSpeed * 1000);

      responseTimersRef.current.push(timeoutId as any);
    });

    return () => {
      responseTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, [stage, showFeedback, isPaused, currentQuestionIndex]);

  // Handle User Response selection (allows modifying choices until time limit is used up)
  const handleUserSelectAnswer = (optionIdx: number) => {
    if (showFeedback || stage !== 'active') return;
    setUserAnswer(optionIdx);

    // Save/update in cumulative userAnswers array
    setUserAnswers(prev => {
      const updated = [...prev];
      updated[currentQuestionIndex] = optionIdx;
      return updated;
    });

    // Record the timeLeft at the moment of selection for speed-bonus computation
    lastSelectedTimeRef.current = timeLeft;

    // Sync state to matchmaking server immediately if in multiplayer
    if (isMultiplayer && roomNumber) {
      const isCorrect = optionIdx === questions[currentQuestionIndex].correctAnswer;
      const timeTaken = timeLimit - timeLeft;
      const scoreAdded = isCorrect ? Math.round(20 * (timeLeft / timeLimit) + 20) : 0;
      fetch(getApiUrl('/api/competition/room/answer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber,
          email: profile?.email,
          questionIndex: currentQuestionIndex,
          optionIdx,
          isCorrect,
          timeTaken,
          scoreAdded
        })
      }).catch(err => console.warn("Failed to publish live answer selection:", err));
    }

    playSound('countdown'); // subtle tick choice feedback
  };

  // Reveal results of the active QCM question
  const handleRevealAnswers = () => {
    setShowFeedback(true);
    setFeedbackTimeLeft(2); // Auto-advance after 2 seconds of visual highlights!
    if (timerRef.current) clearInterval(timerRef.current);

    const currentQ = questions[currentQuestionIndex];
    const finalAns = userAnswer;
    const isCorrect = finalAns === currentQ.correctAnswer;
    const selectTime = lastSelectedTimeRef.current !== null ? lastSelectedTimeRef.current : 0;
    const timeTaken = finalAns !== null ? (timeLimit - selectTime) : timeLimit;
    const scoreAdded = isCorrect ? Math.round(20 * (selectTime / timeLimit) + 20) : 0;

    // Play appropriate sound feedback
    if (finalAns !== null) {
      playSound(isCorrect ? 'correct' : 'wrong');
    } else {
      playSound('wrong');
    }

    // Sync to matchmaking backend if in multiplayer
    if (isMultiplayer && roomNumber) {
      fetch(getApiUrl('/api/competition/room/answer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber,
          email: profile?.email,
          questionIndex: currentQuestionIndex,
          optionIdx: finalAns !== null ? finalAns : -1,
          isCorrect,
          timeTaken,
          scoreAdded
        })
      }).catch(err => console.warn("Failed to publish visual answer:", err));
    }

    // Stop pending teammate submission simulators and resolve them instantly
    responseTimersRef.current.forEach(t => clearTimeout(t));

    // Resolve all participant states
    setParticipants(prev => {
      const resolved = prev.map(p => {
        if (p.id === 'current-user' || p.id === profile?.email) {
          return {
            ...p,
            status: 'answered',
            lastTimeTaken: timeTaken,
            lastSelectedOption: finalAns,
            lastAnswerCorrect: isCorrect,
            score: p.score + scoreAdded
          };
        }

        if (p.status !== 'answered') {
          // Resolve late-answering AIs and peers instantly
          const isCorrect = Math.random() < p.accuracy * 0.8; // slightly penalized accuracy for timing out
          let chosenOption = currentQ.correctAnswer;
          if (!isCorrect) {
            const wrongOptions = [0, 1, 2,  3].filter(o => o !== currentQ.correctAnswer);
            chosenOption = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
          }
          return {
            ...p,
            status: 'answered',
            lastTimeTaken: timeLimit,
            lastSelectedOption: chosenOption,
            lastAnswerCorrect: isCorrect,
            score: p.score + (isCorrect ? 20 : 0)
          };
        } else {
          // Point allocation formula for AIs who answered in time
          const speedFactor = (timeLimit - (p.lastTimeTaken || 10)) / timeLimit;
          const questionsPoints = p.lastAnswerCorrect ? Math.round(20 * speedFactor + 20) : 0;
          return {
            ...p,
            score: p.score + questionsPoints
          };
        }
      });
      return resolved;
    });

    // Add candidate chat comments about correct/wrong responses to bring the arena to life!
    setTimeout(() => {
      // Pick 1-2 random participants to react
      const randomOpponents = participants.filter(p => p.id !== 'current-user');
      if (randomOpponents.length > 0) {
        const commenter = randomOpponents[Math.floor(Math.random() * randomOpponents.length)];
        const actualReactionList = commenter.lastAnswerCorrect ? REACTION_PHRASES_CORRECT : REACTION_PHRASES_WRONG;
        const text = actualReactionList[Math.floor(Math.random() * actualReactionList.length)];

        setChatMessages(prev => [
          {
            id: `chat-react-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            senderName: commenter.name,
            isAI: commenter.isAI,
            isUser: false,
            text: `« ${text} »`,
            time: 'Instantané'
          },
          ...prev
        ]);
      }
    }, 800);
  };

  // Advance to next question or complete and go to Podium
  const handleNextQuestion = () => {
    if (isMultiplayer && roomNumber) {
      fetch(getApiUrl('/api/competition/room/next'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber,
          nextIndex: currentQuestionIndex + 1
        })
      }).catch(err => console.warn("Failed to advance index on server:", err));
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setLeftTime(timeLimit);
      setUserAnswer(null);
      lastSelectedTimeRef.current = null;
      setShowFeedback(false);
      setParticipants(prev => prev.map(p => ({
        ...p,
        status: 'thinking',
        lastSelectedOption: null,
        lastAnswerCorrect: false
      })));
    } else {
      // Finished all questions! 
      playSound('finish');
      setStage('podium');

      // Compile and save result to historical database locally
      const userObj = participants.find(p => p.id === 'current-user');
      const userCorrectAnswersCount = participants.filter(p => p.id === 'current-user' && p.lastAnswerCorrect).length;
      
      const resData = {
        id: `compe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        subjects: [`Défi Élite - ${subject}`],
        date: new Date().toLocaleDateString('fr-FR'),
        level,
        score: userObj ? userObj.score : 0,
        totalQuestions: questions.length,
        mode: 'Test', // Registers under test metrics
        questions,
        userAnswers, // Use accurate cumulative answers array
      };
      
      onSaveToHistory(resData);
    }
  };

  // Generate official PDF Bulletin/Certificate of administrative competitive success
  const handleGenerateBulletinPDF = () => {
    const doc = new jsPDF();
    const sorted = [...participants].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    });
    const userRank = sorted.findIndex(p => p.id === 'current-user') + 1;
    const user = participants.find(p => p.id === 'current-user');

    // Colors
    const fasoGreen: [number, number, number] = [0, 158, 73];
    const fasoBlue: [number, number, number] = [0, 51, 160];
    const fasoRed: [number, number, number] = [239, 43, 45];

    // Administrative Header
    doc.setFillColor(248, 249, 250);
    doc.rect(0, 0, 210, 297, 'F');

    // Flag Header Strip
    doc.setFillColor(fasoGreen[0], fasoGreen[1], fasoGreen[2]);
    doc.rect(10, 10, 190, 4, 'F');
    doc.setFillColor(fasoRed[0], fasoRed[1], fasoRed[2]);
    doc.rect(10, 14, 190, 4, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("RÉPUBLIQUE DU BURKINA FASO", 105, 30, { align: "center" });
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text("La Patrie ou la Mort, nous vaincrons !", 105, 35, { align: "center" });

    // Official Stamp details
    doc.setLineWidth(0.5);
    doc.setDrawColor(203, 213, 225);
    doc.line(40, 40, 170, 40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(fasoBlue[0], fasoBlue[1], fasoBlue[2]);
    doc.text("BULLETIN DE CONCOURS ÉLITE (LIVE)", 105, 52, { align: "center" });

    // Certificate details box
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(15, 60, 180, 85, 4, 4, 'FD');

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    doc.text("Établi par :", 25, 72);
    doc.setFont('helvetica', 'bold');
    doc.text("Académie Faso Educ • Service d'Évaluation Numérique", 60, 72);

    doc.setFont('helvetica', 'normal');
    doc.text("Sujet de spécialité :", 25, 80);
    doc.setFont('helvetica', 'bold');
    doc.text(subject, 60, 80);

    doc.setFont('helvetica', 'normal');
    doc.text("Niveau théorique :", 25, 88);
    doc.setFont('helvetica', 'bold');
    doc.text(level, 60, 88);

    doc.setFont('helvetica', 'normal');
    doc.text("Date du concours :", 25, 96);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date().toLocaleDateString('fr-FR') + " à " + new Date().toLocaleTimeString('fr-FR'), 60, 96);

    doc.setFont('helvetica', 'normal');
    doc.text("Candidat évalué :", 25, 104);
    doc.setFont('helvetica', 'bold');
    doc.text("Vous (Candidature Locale)", 60, 104);

    // Score metrics inside box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(20, 112, 170, 25, 2, 2, 'F');

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Score Final : ${user?.score} points`, 30, 122);
    doc.text(`Rang Général : ${userRank}e sur ${participants.length} candidats`, 30, 130);

    const matchLevelText = userRank === 1 ? "Major du Concours" : userRank <= 3 ? "Admis sur Liste Principale (Podium)" : "Admis sur Liste d'Attente";
    doc.setTextColor(fasoGreen[0], fasoGreen[1], fasoGreen[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(matchLevelText, 115, 126);

    // Full Leaderboard Table
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text("CLASSEMENT OFFICIEL DES COMPÉTITEURS", 15, 160);

    doc.setLineWidth(0.3);
    doc.line(15, 164, 195, 164);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("Rang", 18, 171);
    doc.text("Nom du Candidat", 40, 171);
    doc.text("Nature", 115, 171);
    doc.text("Score Éval", 165, 171);
    doc.line(15, 174, 195, 174);

    doc.setFont('helvetica', 'normal');
    let tableY = 181;
    sorted.forEach((p, index) => {
      if (p.id === 'current-user') {
        doc.setFillColor(236, 253, 245);
        doc.rect(15, tableY - 5, 180, 7, 'F');
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }

      doc.text(`${index + 1}`, 20, tableY);
      doc.text(p.name, 40, tableY);
      doc.text(p.isAI ? "Candidat IA" : p.id === 'current-user' ? "Vous" : "Invité Réseau", 115, tableY);
      doc.text(`${p.score} pts`, 165, tableY);
      
      tableY += 8;
    });

    // Signatures
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text("Le Superviseur Faso Educ", 140, 250);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text("Certifié numérique conforme et impérissable", 133, 255);

    // Append Correction Report detailed pages
    doc.addPage();
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 297, 'F');

    // Section Title
    doc.setFillColor(fasoGreen[0], fasoGreen[1], fasoGreen[2]);
    doc.rect(10, 15, 190, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("RAPPORT OFFICIEL DE CORRECTION - EXPLICATION DES SOLUTIONS", 15, 20);

    let currY = 32;
    questions.forEach((q, qIndex) => {
      // Helper function to check space and add page
      const checkSpace = (neededHeight: number) => {
        if (currY + neededHeight > 275) {
          doc.addPage();
          doc.setFillColor(248, 250, 252);
          doc.rect(0, 0, 210, 297, 'F');
          
          doc.setFillColor(fasoGreen[0], fasoGreen[1], fasoGreen[2]);
          doc.rect(10, 15, 190, 6, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text("RAPPORT DE CORRECTION COMPLET (Suite)", 15, 19);
          
          currY = 28;
        }
      };

      checkSpace(40);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(fasoBlue[0], fasoBlue[1], fasoBlue[2]);
      
      const isUserCorrect = userAnswers[qIndex] === q.correctAnswer;
      const userAnsText = userAnswers[qIndex] !== null 
        ? `Votre choix : Option ${String.fromCharCode(65 + userAnswers[qIndex]!)} (${isUserCorrect ? 'Correcte' : 'Incorrecte'})`
        : "Votre choix : Sans réponse (Temps écoulé)";
        
      doc.text(`Question ${qIndex + 1} sur ${questions.length}  —  ${isUserCorrect ? 'REUSSI' : 'ECHOUE'}`, 15, currY);
      currY += 5;
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(userAnsText, 15, currY);
      currY += 5;
      
      // Question Text
      const textToRender = q.text.replace(/\\/g, '');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      
      const qLines = doc.splitTextToSize(textToRender, 180);
      checkSpace(qLines.length * 4.5 + 5);
      qLines.forEach((line: string) => {
        doc.text(line, 15, currY);
        currY += 4.5;
      });
      currY += 2;
      
      // Options
      q.options.forEach((opt, oIdx) => {
        const isOptCorrect = oIdx === q.correctAnswer;
        const isOptUserSelected = userAnswers[qIndex] === oIdx;
        
        if (isOptCorrect) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(fasoGreen[0], fasoGreen[1], fasoGreen[2]);
        } else if (isOptUserSelected) {
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(fasoRed[0], fasoRed[1], fasoRed[2]);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
        }
        
        const cleanOpt = opt.replace(/\\/g, '');
        const badge = isOptCorrect 
          ? "[Bonne réponse] " 
          : isOptUserSelected 
            ? "[Votre choix incorrect] " 
            : "";
            
        const optLines = doc.splitTextToSize(`${String.fromCharCode(65 + oIdx)}) ${badge}${cleanOpt}`, 175);
        checkSpace(optLines.length * 4.2 + 2);
        optLines.forEach((oLine: string) => {
          doc.text(oLine, 18, currY);
          currY += 4.2;
        });
      });
      currY += 2;
      
      // Explanation Box
      const cleanExpl = q.explanation.replace(/\\/g, '');
      const explLines = doc.splitTextToSize(`Explication Faso Educ : ${cleanExpl}`, 175);
      
      checkSpace(explLines.length * 4.2 + 8);
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currY - 2, 180, explLines.length * 4.2 + 4, 'F');
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      
      explLines.forEach((eLine: string) => {
        doc.text(eLine, 18, currY + 1);
        currY += 4.2;
      });
      
      currY += 10;
    });

    doc.save(`FasoEduc_Bulletin_Concours_${subject.replace(/\s+/g, '_')}.pdf`);
  };

  // Sort live participants to show them swapping indices smoothly using framer-motion layout
  const sortedParticipants = [...participants].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.id.localeCompare(b.id);
  });

  if (loadingQuestions) {
    return (
      <div className="fixed inset-0 bg-slate-950/98 z-[9999] flex flex-col items-center justify-center p-6 text-white overflow-hidden select-none">
        {/* Decorative ambient background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-faso-blue/15 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-faso-green/15 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        
        <div className="max-w-md w-full text-center space-y-10 relative">
          
          {/* Official Seal / Header */}
          <div className="space-y-3">
            <span className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-500 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest block mx-auto w-fit">
              👑 SECTION DE SÉLECTION SCIENTIFIQUE
            </span>
            <h2 className="text-xl font-black text-gray-100 font-sans tracking-tight uppercase">
              FASO-EDUC DECK LOADER
            </h2>
            <div className="h-[2px] w-24 bg-gradient-to-r from-faso-green via-faso-yellow to-faso-blue mx-auto" />
          </div>

          {/* 3D Rolling Card / Cube Loading Animation */}
          <div className="h-64 flex items-center justify-center relative">
            
            {/* Ambient revolving rings */}
            <div className="absolute w-52 h-52 border border-slate-800/60 rounded-full animate-spin [animation-duration:15s]" />
            <div className="absolute w-44 h-44 border border-dashed border-slate-700/30 rounded-full animate-spin [animation-duration:8s] [animation-direction:reverse]" />
            
            {/* Stacked Cards Layout creating depth */}
            <div className="relative w-40 h-52 flex items-center justify-center">
              
              {/* Back Card 2 (Bottom layer) */}
              <div className="absolute w-36 h-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl transform -rotate-12 translate-y-3 -translate-x-3 opacity-30 select-none pointer-events-none" />
              
              {/* Back Card 1 (Middle layer) */}
              <div className="absolute w-36 h-48 bg-slate-900 border border-slate-800/80 rounded-2xl shadow-xl transform rotate-6 -translate-y-1 translate-x-1 opacity-50 select-none pointer-events-none" />
              
              {/* Front Main FLIPPING Card (The rolling continuous sheet) */}
              <motion.div
                animate={{
                  rotateY: [0, 180, 180, 360],
                  rotateX: [0, 0, 180, 180],
                  scale: [1, 1.05, 0.95, 1],
                  y: [0, -8, 8, 0]
                }}
                transition={{
                  duration: 4.8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-36 h-48 bg-slate-900 border-2 border-faso-blue rounded-2xl shadow-2xl flex flex-col justify-between p-4 relative overflow-hidden [transform-style:preserve-3d]"
              >
                {/* Visual content of the official exam script */}
                <div className="absolute top-0 right-0 w-8 h-8 bg-faso-green/20 rounded-bl-full" />
                
                {/* Mini emblem */}
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-faso-green" />
                    <div className="h-1 w-10 bg-slate-800 rounded-sm" />
                  </div>
                  <div className="h-1.5 w-16 bg-slate-800 rounded-sm" />
                  <div className="h-[1px] w-full bg-slate-800/60 my-2" />
                </div>
                
                {/* Pseudo QCM Options */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm border border-faso-blue" />
                    <div className="h-1 w-12 bg-slate-805 rounded-sm" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm border border-faso-blue bg-faso-blue/40" />
                    <div className="h-1 w-14 bg-slate-805 rounded-sm" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm border border-faso-blue" />
                    <div className="h-1 w-10 bg-slate-805 rounded-sm" />
                  </div>
                </div>

                {/* Stars and stamps */}
                <div className="flex justify-between items-center pt-2">
                  <div className="h-2 w-6 bg-slate-800 rounded-sm" />
                  <div className="w-4 h-4 rounded-full border border-amber-500/50 flex items-center justify-center">
                    <span className="text-[6px] text-amber-500 font-bold">★</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Dynamic Patience Message Console & Simulated Progress Bar */}
          <div className="space-y-4">
            <div className="h-8 flex items-center justify-center">
              <span className="text-xs font-mono text-cyan-400 tracking-wide font-extrabold text-center uppercase animate-pulse">
                {loadingMessage}
              </span>
            </div>

            {/* Simulated progress meter */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 pl-1 pr-1 font-bold">
                <span>REDACTION SCIENTIFIQUE</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/80 p-0.5 animate-pulse">
                <div 
                  className="h-full bg-gradient-to-r from-faso-green via-faso-yellow to-faso-blue rounded-full transition-all duration-300" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed max-w-sm mx-auto italic font-medium font-sans">
              "Veuillez patienter pendant que nos algorithmes d'IA calibrés rédigent vos fiches d'examen d'élite. Cette rigueur académique garantit un concours de haut niveau."
            </p>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="p-1 xs:p-2 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-4 sm:space-y-8 pb-16">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 pb-5">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 font-extrabold text-sm hover:text-faso-blue hover:gap-3 transition-all duration-300 group cursor-pointer"
        >
          <ArrowLeft size={18} className="text-gray-400 group-hover:text-faso-blue" />
          <span>Retour au tableau</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playSound('correct');
            }}
            className="p-3 bg-white dark:bg-gray-950 border border-slate-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 shadow-2xs transition-all text-gray-600 dark:text-gray-400 cursor-pointer flex items-center gap-1.5"
            title={soundEnabled ? "Désactiver les effets sonores" : "Activer les effets sonores"}
          >
            {soundEnabled ? <Volume2 size={16} className="text-faso-green" /> : <VolumeX size={16} className="text-gray-400" />}
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Effets</span>
          </button>
        </div>
      </div>

      {/* SETUP PHASE: Configurer le concours */}
      {stage === 'setup' && (
        <div className="space-y-6">
          {/* Header Area */}
          <div className="bg-linear-to-r from-faso-blue/10 via-amber-500/5 to-faso-green/10 border border-slate-100 dark:border-gray-850 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xs relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-48 h-48 bg-faso-blue/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-faso-green/10 rounded-full blur-3xl -ml-12 -mb-12 pointer-events-none" />

            <div className="text-left space-y-2 max-w-2xl relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-faso-green/10 text-faso-green rounded-full text-[10px] font-black uppercase tracking-widest leading-none">
                🇧🇫 Configurateur d'Évaluation Académique
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Arène de Révision de Concours
              </h2>
              <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350 leading-relaxed font-semibold">
                Concevez des scénarios d'examens réalistes alignés sur les programmes burkinabè officiels. Saisissez votre sujet ou cliquez sur l'un de nos thèmes recommandés ci-dessous pour démarrer instantanément !
              </p>
            </div>

            {/* QUICK LAUNCH CTA AT THE TOP: Zero scroll required to enter the lobby! */}
            <div className="shrink-0 w-full md:w-auto relative">
              <button
                onClick={handleStartLobby}
                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-faso-green to-faso-blue hover:brightness-110 text-white font-extrabold text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-faso-green/20 hover:shadow-faso-green/45 transform active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Play size={16} />
                <span>Lancer le Salon</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Core Setup Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Form Adjustments (Input settings + Candidates Presence) */}
            <div className="lg:col-span-8 space-y-6">

              {/* CARD 1: EXAMEN CONFIGURATION */}
              <div className="bg-white/95 dark:bg-gray-900/95 border border-slate-150/45 dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_12px_44px_rgba(0,181,226,0.035)] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-faso-blue to-faso-green" />
                
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2.5 pb-2 border-b border-gray-100 dark:border-gray-850">
                  <span className="p-1.5 bg-faso-blue/10 text-faso-blue rounded-lg shrink-0"><Settings size={16} /></span>
                  1. Paramètres de l'épreuve d'évaluation
                </h3>

                {/* Subject Selector Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-gray-500 dark:text-gray-450 uppercase tracking-widest flex items-center gap-1">
                      <span>Matière / Sujet de Concours</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                    {subject && (
                      <span className="text-[10px] font-bold text-faso-blue uppercase tracking-widest bg-faso-blue/10 px-2 py-0.5 rounded-md">
                        Matière Sélectionnée
                      </span>
                    )}
                  </div>
                  
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Saisissez un sujet personnalisé ou cliquez parmi les propositions ci-dessous..."
                    className="w-full p-4 border border-gray-200/80 dark:border-gray-805 rounded-2xl outline-none focus:ring-2 focus:ring-faso-blue/45 dark:bg-gray-950 dark:text-white font-extrabold text-sm placeholder-gray-400 transition-all dark:focus:ring-faso-blue/40 shadow-2xs"
                  />

                  {/* Redesigned interactive beautiful Suggestions cards in columns */}
                  <div className="space-y-2 bg-slate-50/50 dark:bg-gray-950/40 p-3 rounded-2xl border border-gray-100 dark:border-gray-850 text-left">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">🎯 Thématiques phares du Burkina Faso :</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        { title: "Microéconomie (Optimisation, Cobb-Douglas, Coûts marginaux)", category: "Microéconomie", icon: "📊" },
                        { title: "Macroéconomie (Multiplicateur keynésien, IS-LM, Modèle de Solow)", category: "Macroéconomie", icon: "📈" },
                        { title: "Statistiques & Probabilités (Correction de Bessel, Intervalles de confiance)", category: "Statistiques", icon: "🧠" },
                        { title: "Politiques Publiques & Finances Nationales de l'UEMOA", category: "UEMOA", icon: "🌍" },
                        { title: "Mathématiques Générales & Algèbre Linéaire des Concours", category: "Mathématiques", icon: "🧬" }
                      ].map((s, idx) => {
                        const isSelected = subject === s.title;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSubject(s.title);
                              playSound('correct');
                            }}
                            className={cn(
                              "text-left p-3 rounded-xl border text-xs transition-all duration-200 flex items-start gap-2.5 cursor-pointer relative overflow-hidden group w-full",
                              isSelected 
                                ? "bg-faso-blue/10 text-faso-blue border-faso-blue dark:bg-faso-blue/20" 
                                : "bg-white dark:bg-gray-900 border-gray-200/70 dark:border-gray-805 text-gray-750 dark:text-gray-300 hover:border-blue-400 hover:bg-blue-50/10"
                            )}
                          >
                            <span className="text-xl shrink-0 group-hover:scale-115 transition-transform">{s.icon}</span>
                            <div className="leading-snug flex-1 min-w-0">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-wider block mb-0.5",
                                isSelected ? "text-faso-blue" : "text-faso-green"
                              )}>
                                {s.category}
                              </span>
                              <span className="font-extrabold text-[11px] block text-gray-800 dark:text-gray-200 truncate leading-tight">
                                {s.title}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-faso-blue animate-ping" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Reorganized setup parameters according to user specifications */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* 1. Study level */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black text-slate-450 dark:text-gray-400 uppercase tracking-widest block pl-1">🎚️ Niveau d'exigence académique (Study level)</label>
                    <div className="grid grid-cols-4 gap-1 bg-gray-50 dark:bg-gray-950 p-1 rounded-2xl border border-gray-150 dark:border-gray-850">
                      {(['Premier cycle', 'Licence', 'Master', 'Doctorat'] as Level[]).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => {
                            setLevel(l);
                            playSound('correct');
                          }}
                          className={cn(
                            "py-2 px-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer text-center truncate",
                            level === l
                              ? "bg-faso-blue text-white shadow-xs font-black"
                              : "text-slate-650 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900"
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Difficulty */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black text-slate-450 dark:text-gray-400 uppercase tracking-widest block pl-1">⚡ Difficulté de l'épreuve (Difficulty)</label>
                    <div className="grid grid-cols-3 gap-1 bg-gray-50 dark:bg-gray-950 p-1 rounded-2xl border border-gray-150 dark:border-gray-850">
                      {(['Facile', 'Moyen', 'Expert'] as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setDifficulty(d);
                            playSound('correct');
                          }}
                          className={cn(
                            "py-2 px-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer text-center truncate",
                            difficulty === d
                              ? "bg-faso-blue text-white shadow-xs font-black"
                              : "text-slate-650 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* 3. Number of questions */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between pl-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-gray-400 uppercase tracking-widest">📝 Nombre total de questions (Number of questions)</label>
                    <span className="text-xs font-black bg-faso-green/10 text-faso-green dark:text-green-400 px-3 py-1 rounded-full border border-faso-green/20">
                      {questionCount} questions générées
                    </span>
                  </div>

                  {/* Presets Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 20, 40, 60].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          setQuestionCount(count);
                          playSound('correct');
                        }}
                        className={cn(
                          "py-3 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer text-center",
                          questionCount === count 
                            ? "bg-faso-green text-white border-faso-green shadow-sm shadow-faso-green/15 font-black" 
                            : "bg-gray-50 dark:bg-gray-955 hover:bg-white dark:hover:bg-gray-900 text-slate-705 dark:text-gray-350 border-gray-200 dark:border-gray-850"
                        )}
                      >
                        {count} QCMs
                      </button>
                    ))}
                  </div>

                  {/* Range Slider for custom selection */}
                  <div className="bg-gray-50 dark:bg-gray-955 p-4 rounded-2xl border border-gray-150 dark:border-gray-855 space-y-3">
                    <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                      <span>MIN: 5 questions</span>
                      <span>MOYEN: 30 questions</span>
                      <span>MAX: 60 questions</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="1"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="w-full accent-faso-green h-2 bg-gray-200 dark:bg-gray-805 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-normal italic pl-4 pr-4">
                      En déplaçant le curseur, vous modulez fidèlement l'amplitude d’évaluation du QCM par l'IA.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* 4. Competition against AI & 5. AI difficulty */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-955 rounded-2xl border border-gray-150 dark:border-gray-850 space-y-3.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-450 dark:text-gray-405 uppercase tracking-widest flex items-center gap-1.5">
                        <span>🤖 Compétition contre l'IA</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const val = !aiCompetition;
                          setAiCompetition(val);
                          if (val) {
                            setArenaType('robots');
                          } else {
                            setArenaType('solo');
                          }
                          playSound('correct');
                        }}
                        className={cn(
                          "w-10 h-5.5 rounded-full transition-all relative cursor-pointer",
                          aiCompetition ? "bg-faso-green" : "bg-gray-300"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.75 w-4 h-4 bg-white rounded-full transition-all",
                          aiCompetition ? "left-5" : "left-1"
                        )} />
                      </button>
                    </div>

                    {aiCompetition && (
                      <div className="space-y-1 pt-2 border-t border-slate-200/50 dark:border-gray-800">
                        <span className="text-[9px] font-extrabold text-gray-450 dark:text-gray-400 uppercase tracking-widest block">Intelligence de l'IA (AI Difficulty)</span>
                        <div className="grid grid-cols-3 gap-1 bg-white dark:bg-gray-900 p-0.5 rounded-lg border border-gray-200/50 dark:border-gray-800 animate-fade-in">
                          {(['Facile', 'Moyen', 'Expert'] as Difficulty[]).map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                setAiDifficulty(d);
                                playSound('correct');
                              }}
                              className={cn(
                                "py-1 rounded-md text-[10px] font-extrabold transition-all cursor-pointer text-center",
                                aiDifficulty === d
                                  ? "bg-faso-green text-white font-black"
                                  : "text-slate-650 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                              )}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Visual buttons for reflection timer duration per QCM */}
                  <div className="space-y-2 text-left p-4 bg-gray-50 dark:bg-gray-955 rounded-2xl border border-gray-150 dark:border-gray-850">
                    <label className="text-[10px] font-black text-slate-450 dark:text-gray-400 uppercase tracking-widest block pl-1">⏱️ Durée de réflexion / QCM</label>
                    <div className="grid grid-cols-5 gap-1 bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-150 dark:border-gray-800">
                      {([15, 30, 45, 60, 90] as number[]).map((seconds) => (
                        <button
                          key={seconds}
                          type="button"
                          onClick={() => {
                            setTimeLimit(seconds);
                            playSound('correct');
                          }}
                          className={cn(
                            "py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer text-center",
                            timeLimit === seconds
                              ? "bg-faso-green text-white shadow-xs font-black"
                              : "text-slate-650 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900"
                          )}
                        >
                          {seconds}s
                        </button>
                      ))}
                    </div>
                    <span className="text-[9px] text-gray-450 dark:text-gray-500 block text-right mt-1 italic font-semibold">
                      {timeLimit === 15 ? "Format Blitz : très rythmé" : timeLimit === 90 ? "Format Théorique : propice aux calculs" : "Format Standard"}
                    </span>
                  </div>

                </div>

              </div>

            {/* CARD 2: ADVERSAIRES ET CANDIDATS */}
            <div className="bg-white/95 dark:bg-gray-900/95 border border-slate-150/45 dark:border-gray-850 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_12px_44px_rgba(0,181,226,0.03)] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-faso-green" />

              <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2.5 pb-2 border-b border-gray-100 dark:border-gray-850">
                <span className="p-1.5 bg-faso-green/10 text-faso-green rounded-lg shrink-0"><Users size={16} /></span>
                2. Présence et nature des participants
              </h3>

              {/* Segmented control for arenaType */}
              <div className="bg-slate-50 dark:bg-gray-955 p-1.5 rounded-2xl grid grid-cols-3 gap-2 border border-slate-100 dark:border-gray-850">
                <button
                  type="button"
                  onClick={() => {
                    setArenaType('solo');
                    playSound('correct');
                  }}
                  className={cn(
                    "py-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center gap-1 border border-transparent",
                    arenaType === 'solo'
                      ? "bg-faso-blue text-white shadow-sm font-black"
                      : "text-slate-650 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900"
                  )}
                >
                  <User size={15} />
                  <span>Mode Solo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setArenaType('robots');
                    playSound('correct');
                  }}
                  className={cn(
                    "py-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center gap-1 border border-transparent",
                    arenaType === 'robots'
                      ? "bg-faso-green text-white shadow-sm font-black"
                      : "text-slate-655 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900"
                  )}
                >
                  <Sparkles size={15} />
                  <span>Robots (IA)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setArenaType('multiplayer');
                    playSound('correct');
                  }}
                  className={cn(
                    "py-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center gap-1 border border-transparent",
                    arenaType === 'multiplayer'
                      ? "bg-faso-yellow text-gray-900 shadow-sm font-black"
                      : "text-slate-655 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900"
                  )}
                >
                  <Users size={15} />
                  <span>En Ligne</span>
                </button>
              </div>

              {arenaType === 'solo' && (
                <div className="p-4 bg-white dark:bg-gray-900 border dark:border-gray-855 rounded-2xl flex flex-col items-center text-center space-y-2">
                  <span className="p-3 bg-faso-blue/10 text-faso-blue rounded-full">
                    <User size={24} />
                  </span>
                  <h4 className="font-bold text-xs dark:text-white uppercase tracking-wider">Mode Individuel (Solo)</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
                    Vous composez cette épreuve seul face au chronomètre. Vos résultats seront stockés dans votre historique pour suivre vos progrès académiques.
                  </p>
                </div>
              )}

              {arenaType === 'robots' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Adversaires autonomes (IA)</label>
                  <div className="flex items-center justify-between gap-4 p-3 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl">
                    <span className="text-xs font-bold dark:text-white">Ajuster le nombre d'IAs candidates</span>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setAiCount(prev => Math.max(0, prev - 1))}
                        disabled={aiCount <= 0}
                        className="w-8 h-8 flex items-center justify-center border font-bold rounded-lg disabled:opacity-30 dark:text-white cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-extrabold text-sm dark:text-white px-2">{aiCount}</span>
                      <button 
                        type="button"
                        onClick={() => setAiCount(prev => Math.min(10, prev + 1))}
                        disabled={aiCount >= 10}
                        className="w-8 h-8 flex items-center justify-center border font-bold rounded-lg disabled:opacity-30 dark:text-white cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Les cerveaux IA ont des niveaux d'évaluation adaptatifs. Ils calculent en temps réel selon leur coefficient cognitif !
                  </p>
                </div>
              )}

              {/* Interactive real-time online list */}
              {arenaType === 'multiplayer' && (<>
                <div className="space-y-3 pt-2 border-t dark:border-gray-850">
                  <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse inline-block"></span>
                    Élèves Réels connectés en direct ({onlineUsers.filter(u => u.email !== profile?.email).length})
                  </label>
                
                {onlineUsers.filter(u => u.email !== profile?.email).length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {onlineUsers.filter(u => u.email !== profile?.email).map((usr) => {
                      const isInvited = customInvitations.includes(usr.name);
                      return (
                        <div 
                          key={usr.email}
                          className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border dark:border-gray-850 rounded-xl shadow-xs"
                        >
                          <div className="flex items-center gap-2 max-w-[65%] font-sans">
                            <span className="text-sm shrink-0">{usr.avatar || '👨‍🎓'}</span>
                            <div className="text-left leading-normal">
                              <span className="font-extrabold text-xs dark:text-gray-100 block truncate">
                                {usr.name} {usr.isPremium && <span className="text-amber-500">🏆</span>}
                              </span>
                              <span className="text-[9px] text-gray-400 block font-mono truncate">{usr.email} • {usr.level}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleSendDirectInvite(usr.email, usr.name)}
                            disabled={isInvited}
                            className={cn(
                              "px-3 py-1.5 font-extrabold text-[10px] rounded-lg transition-all shadow-xs flex items-center gap-1 select-none cursor-pointer",
                              isInvited
                                ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
                                : "bg-faso-green hover:bg-green-600 text-white"
                            )}
                          >
                            {isInvited ? "Défi Lancé ✓" : "Défier 💥"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-white dark:bg-gray-900/60 rounded-xl border border-dashed dark:border-gray-850 text-center font-sans">
                    <p className="text-[10px] text-gray-450 italic leading-relaxed">
                      Aucun autre élève n'est en ligne pour le moment. Ouvrez l'application dans un autre navigateur ou invitez des amis à se connecter !
                    </p>
                  </div>
                )}
              </div>

              {/* Rechercher un candidat enregistré */}
              <div className="space-y-2.5 pt-2 border-t dark:border-gray-850">
                <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                  🔍 Rechercher un candidat disponible par de son Nom / E-mail réel
                </label>
                <div className="flex gap-2 font-sans">
                  <input
                    type="text"
                    value={searchCompetitorQuery}
                    onChange={(e) => setSearchCompetitorQuery(e.target.value)}
                    placeholder="Saisissez un nom ou email du candidat..."
                    className="flex-1 p-2.5 border rounded-xl outline-none text-xs dark:bg-gray-950 dark:text-white"
                  />
                </div>
                
                {isSearchingCompetitors && (
                  <p className="text-[10px] text-faso-blue animate-pulse font-sans">Recherche des candidats en cours...</p>
                )}

                {searchedCompetitors.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {searchedCompetitors.map((usr) => {
                      const isInvited = customInvitations.includes(usr.name);
                      return (
                        <div 
                          key={usr.email}
                          className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-gray-800 rounded-xl shadow-xs"
                        >
                          <div className="flex items-center gap-2 max-w-[65%] font-sans">
                            <span className="text-sm shrink-0">{usr.avatar || '👨‍🎓'}</span>
                            <div className="text-left leading-normal">
                              <span className="font-extrabold text-xs dark:text-gray-100 block truncate">
                                {usr.name} {usr.isPremium && <span className="text-amber-500">🏆</span>}
                              </span>
                              <span className="text-[9px] text-gray-400 block font-mono truncate">{usr.email} • {usr.level}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleSendDirectInvite(usr.email, usr.name)}
                            disabled={isInvited}
                            className={cn(
                              "px-3 py-1.5 font-extrabold text-[10px] rounded-lg transition-all shadow-xs flex items-center gap-1 select-none cursor-pointer",
                              isInvited
                                ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
                                : "bg-faso-green hover:bg-green-600 text-white"
                            )}
                          >
                            {isInvited ? "Défi Lancé ✓" : "Défier 💥"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : searchCompetitorQuery.trim() && !isSearchingCompetitors ? (
                  <p className="text-[10px] text-amber-500 mt-1 italic font-sans">
                    Aucun candidat enregistré trouvé avec ce nom ou e-mail.
                  </p>
                ) : null}
              </div>
              </>)}

              {/* Humans dynamic invite list */}
              {arenaType === 'robots' && (
                <div className="space-y-2 pt-2 border-t dark:border-gray-850">
                  <label className="text-xs font-bold text-gray-400 uppercase">Simuler d'autres candidats (Robots)</label>
                <div className="flex gap-2 font-sans">
                  <input
                    type="text"
                    value={newInviteName}
                    onChange={(e) => setNewInviteName(e.target.value)}
                    placeholder="Saisissez un prénom/nom (ex: Fatou)"
                    className="flex-1 p-2.5 border rounded-xl outline-none text-xs dark:bg-gray-950 dark:text-white"
                  />
                  <button
                    onClick={handleAddInviteName}
                    className="px-4 py-2 bg-faso-blue text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>

                {customInvitations.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1 font-sans">
                    {customInvitations.map((name, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-faso-green/10 text-faso-green rounded-full text-xs font-bold"
                      >
                        {name}
                        <button onClick={() => handleRemoveInvite(idx)}>
                          <X size={12} className="text-red-500 hover:scale-110" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 italic font-sans">
                    Aucun candidat robot additionnel activé.
                  </p>
                )}
              </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleStartLobby}
            className="w-full py-4 bg-faso-blue hover:bg-blue-600 text-white font-black rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Play size={18} />
            Accéder à la Salle de Concours (Lobby)
          </button>
        </div>
      )}

      {/* LOBBY PHASE: Salon de préparation */}
      {stage === 'lobby' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Invited Candidates Box */}
          <div className="lg:col-span-8 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b dark:border-gray-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-faso-blue uppercase tracking-wider">SALON NUMÉRO #{roomNumber}</span>
                <h3 className="font-extrabold text-lg dark:text-white">Candidats connectés dans le lobby</h3>
              </div>
              <span className="bg-faso-green/10 text-faso-green font-bold text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                <Users size={12} />
                {participants.length} candidats
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[220px]">
              {participants.map((p) => (
                <div 
                  key={p.id}
                  className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                      p.id === 'current-user' ? "bg-faso-blue text-white" : p.isAI ? "bg-purple-100 text-purple-700 dark:bg-purple-950/20" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {p.name.slice(0, 2)}
                    </div>
                    <div>
                      <span className="font-extrabold text-sm dark:text-white block leading-snug">{p.name}</span>
                      <span className="text-[9px] text-gray-400 font-semibold uppercase">{p.id === 'current-user' ? "VOUS" : p.isAI ? "Cerveau Autonome (IA)" : "Invité Réseau"}</span>
                    </div>
                  </div>
                  
                  <span className="text-[10px] bg-green-50 text-green-700 dark:bg-green-950/20 font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
                    <Check size={12} /> Prêt
                  </span>
                </div>
              ))}
            </div>

            {/* Simulated Live Action Link block */}
            <div className="bg-gradient-to-tr from-faso-blue/5 via-transparent to-faso-green/5 border border-faso-blue/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="font-bold text-sm dark:text-white">Lien de partage du concours d'élite</h4>
                <p className="text-xs text-gray-500">Envoyez ce lien aux réviseurs de votre académie burkinabè pour qu'ils s'agrègent en live !</p>
              </div>
              <button
                onClick={copySimulatedLink}
                className="px-4 py-2 bg-white dark:bg-gray-950 border dark:border-gray-850 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 dark:text-gray-300"
              >
                <Share2 size={12} />
                {copiedLink ? "Lien copié !" : "Copier l'invitation"}
              </button>
            </div>

            {/* Action launcher */}
            <div className="pt-4 border-t dark:border-gray-800 flex justify-between gap-4 flex-wrap">
              <button
                onClick={() => setStage('setup')}
                className="px-5 py-3 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 text-gray-600 dark:text-gray-400 font-bold text-xs rounded-xl transition-all"
              >
                Ajuster les réglages
              </button>
              <button
                onClick={handleLaunchCompetition}
                disabled={loadingQuestions}
                className="px-6 py-3 bg-faso-blue hover:bg-blue-600 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 justify-center"
              >
                {loadingQuestions ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Rédaction des QCMs par l'IA...
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Lancer officiellement la compétition
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Chat Sidebar during lobby */}
          <div className="lg:col-span-4 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-5 space-y-4 shadow-sm min-h-[400px] flex flex-col justify-between">
            <h4 className="font-extrabold text-sm dark:text-white pb-2 border-b dark:border-gray-800 flex items-center gap-1.5">
              <MessageSquare size={16} className="text-faso-blue" />
              Échanges & Réactions
            </h4>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-1 text-xs sm:text-sm">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "font-black text-[11px]",
                      msg.isUser ? "text-faso-blue" : msg.isAI ? "text-purple-600" : "text-gray-600 dark:text-gray-400"
                    )}>
                      {msg.senderName}
                    </span>
                    <span className="text-[9px] text-gray-400">{msg.time}</span>
                  </div>
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-950 border dark:border-gray-850 rounded-xl leading-relaxed text-gray-800 dark:text-gray-300">
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick response buttons to simulate chat with other competitors */}
            <div className="space-y-2 pt-2 border-t dark:border-gray-1000">
              <span className="text-[10px] font-bold text-gray-450 uppercase block">Envoyer une phrase rapide</span>
              <div className="grid grid-cols-2 gap-1 px-1">
                {[
                  "Prêt pour le combat !",
                  "Le chronomètre m'inquiète.",
                  "Bonne chance à tous !",
                  "Concentration totale."
                ].map((phrase) => (
                  <button
                    key={phrase}
                    onClick={() => {
                      setChatMessages(prev => [
                        {
                          id: `chat-usr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                          senderName: 'Vous (Candidat)',
                          isAI: false,
                          isUser: true,
                          text: phrase,
                          time: 'Maintenant'
                        },
                        ...prev
                      ]);
                    }}
                    className="p-2 bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg text-[10px] text-gray-600 dark:text-gray-450 font-semibold text-left border"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE COMPETITION STAGE: Le concours actif */}
      {stage === 'active' && questions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main QCM Body */}
          <div className="lg:col-span-8 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm relative">
            {/* Header detail */}
            <div className="flex justify-between items-center gap-4">
              <span className="px-3 py-1 bg-faso-blue/10 text-faso-blue rounded-full text-xs font-black uppercase">
                Question {currentQuestionIndex + 1} sur {questions.length}
              </span>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <span className={cn(
                  "font-mono font-bold text-base",
                  timeLeft <= 6 ? "text-red-500 animate-bounce" : "text-gray-600 dark:text-gray-400"
                )}>
                  {timeLeft} s restants
                </span>
              </div>
            </div>

            {/* Progress Bar of game */}
            <ProgressBar progress={((currentQuestionIndex) / questions.length) * 100} color="bg-faso-blue" />

            {/* The Question Text in Math KaTeX rendering */}
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-snug">
              <MathRenderer text={questions[currentQuestionIndex].text} />
            </h2>

            {/* Options selection */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              {questions[currentQuestionIndex].options.map((opt, idx) => {
                const isSelected = userAnswer === idx;
                const isCorrect = idx === questions[currentQuestionIndex].correctAnswer;
                
                return (
                  <button
                    key={idx}
                    disabled={showFeedback}
                    onClick={() => handleUserSelectAnswer(idx)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border font-semibold text-sm transition-all flex items-center justify-between",
                      // Selected and feedback state styling
                      !showFeedback
                        ? (isSelected 
                            ? "border-faso-blue bg-faso-blue/5 text-faso-blue" 
                            : "hover:bg-gray-50 border-gray-200 dark:border-gray-850 text-gray-800 dark:text-gray-200"
                          )
                        : (isCorrect 
                            ? "bg-green-100 border-green-400 text-green-800 dark:bg-green-950/20 dark:text-green-300 dark:border-green-800"
                            : (isSelected 
                                ? "bg-red-100 border-red-400 text-red-800 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800"
                                : "opacity-50 border-gray-200 dark:border-gray-850 text-gray-700 dark:text-gray-300"
                              )
                          )
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-850 font-bold text-xs leading-none shrink-0 border">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div className="flex-1 text-left leading-normal font-sans">
                        <MathRenderer text={opt} />
                      </div>
                    </div>

                    {showFeedback && isCorrect && <Check className="text-green-500 shrink-0" size={18} />}
                  </button>
                );
              })}
            </div>

            {/* Interactive explanation/feedback footer block - skipped during live quiz per direct instructions */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl dark:bg-slate-900 dark:border-slate-800 text-center flex items-center justify-center"
                >
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 justify-center animate-pulse">
                    <Zap size={14} className="text-faso-green" />
                    Verdict Faso Educ... Passage automatique dans {feedbackTimeLeft}s...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Active Competition Scoreboard Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live rankings panel */}
            <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-5 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-sm dark:text-white pb-2 border-b dark:border-gray-800 flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1.5">
                  <Trophy size={16} className="text-amber-500 animate-pulse" />
                  Classement en direct
                </span>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Mise à jour live</span>
              </h3>

              {/* Dynamic list with framer-motion layout enabling nice animations when swapping places */}
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {sortedParticipants.map((p, index) => {
                  const isUser = p.id === 'current-user';
                  const showsCorrectIndicator = showFeedback && p.lastAnswerCorrect;
                  const showsWrongIndicator = showFeedback && p.lastSelectedOption !== null && !p.lastAnswerCorrect;

                  return (
                    <motion.div 
                      key={p.id}
                      layout
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs",
                        isUser 
                          ? "bg-faso-blue/10 border-faso-blue/30 text-faso-blue font-bold" 
                          : "bg-gray-50 dark:bg-gray-950 border-gray-100 dark:border-gray-850"
                      )}
                    >
                      <div className="flex items-center gap-2 max-w-[70%]">
                        <span className="font-bold text-[11px] text-gray-400 w-4 block text-center">
                          {index + 1}e
                        </span>
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0",
                          isUser ? "bg-faso-blue text-white" : "bg-gray-200 text-gray-600 dark:bg-gray-800/80 dark:text-gray-450"
                        )}>
                          {p.name.slice(0, 2)}
                        </div>
                        <span className="font-black truncate block dark:text-white">
                          {p.name.replace(" (IA)", "").replace(" (Invité)", "")}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Status label: Thinking or Answered */}
                        {!showFeedback ? (
                          p.status === 'thinking' ? (
                            <span className="text-[9px] text-gray-450 italic flex items-center gap-0.5">
                              <Loader2 size={10} className="animate-spin text-faso-blue" />
                              Calcul...
                            </span>
                          ) : (
                            <span className="text-[9px] bg-green-50 text-green-700 dark:bg-green-950/20 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                              <Zap size={8} /> Répondu
                            </span>
                          )
                        ) : (
                          // End of question answer correctness status values
                          showsCorrectIndicator ? (
                            <span className="text-[9px] bg-green-50 text-green-700 dark:bg-green-950/10 px-1.5 py-0.5 rounded-md font-bold">
                              ✓ +{20}
                            </span>
                          ) : showsWrongIndicator ? (
                            <span className="text-[9px] bg-red-50 text-red-700 dark:bg-red-950/10 px-1.5 py-0.5 rounded-md font-bold">
                              ✗ +0
                            </span>
                          ) : (
                            <span className="text-[9px] text-gray-400 italic">Sans réponse</span>
                          )
                        )}
                        <span className="font-mono font-extrabold w-12 text-right">
                          {p.score} pts
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Chat ticker during questions */}
            <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-5 space-y-3 shadow-sm min-h-[160px] flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-450 uppercase block">Commentaires à chaud</span>
              
              <div className="flex-1 overflow-y-auto max-h-[140px] space-y-2 pr-1 text-[11px] leading-relaxed">
                {chatMessages.filter(m => m.senderName !== 'Système Faso Arena').map((m) => (
                  <div key={m.id} className="p-2 bg-gray-50 dark:bg-gray-950 rounded-xl space-y-0.5">
                    <span className="font-extrabold text-[10px] block dark:text-white leading-none">{m.senderName}</span>
                    <span className="text-gray-600 dark:text-gray-300 font-sans block">{m.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PODIUM CEREMONY: La fin, classement de l'arène */}
      {stage === 'podium' && (
        <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-sm text-center">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-faso-green/10 text-faso-green rounded-full text-xs font-black uppercase">
              Résultats officiels de l'Épreuve
            </span>
            <h2 className="text-3xl font-black dark:text-white leading-tight">Proclamations & Tableau d'Honneur</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Sujet de composition : <strong>{subject}</strong>. Félicitations à tous les braves candidats burkinabè pour cet effort académique !
            </p>
          </div>

          {/* Visual Podium block */}
          <div className="flex flex-col sm:flex-row items-end justify-center gap-6 pt-6 pb-2 max-w-md mx-auto">
            {/* 2nd Place */}
            {sortedParticipants[1] && (
              <div className="flex flex-col items-center w-full sm:w-28 space-y-2 order-2 sm:order-1">
                <span className="text-xs font-extrabold dark:text-gray-300 truncate w-full text-center">
                  {sortedParticipants[1].name.replace(" (IA)", "").replace(" (Invité)", "")}
                </span>
                <span className="text-[10px] text-gray-400 font-bold">{sortedParticipants[1].score} pts</span>
                <div className="w-full bg-slate-100 border border-slate-200 h-16 rounded-t-xl flex flex-col items-center justify-center p-2 dark:bg-slate-950 dark:border-slate-800">
                  <span className="text-sm font-bold text-slate-500">2e RANG</span>
                  <Award size={18} className="text-slate-400 mt-1" />
                </div>
              </div>
            )}

            {/* 1st Place */}
            {sortedParticipants[0] && (
              <div className="flex flex-col items-center w-full sm:w-32 space-y-2 order-1 sm:order-2">
                <span className="text-sm font-black text-amber-600 truncate w-full text-center flex items-center justify-center gap-1">
                  <Trophy size={14} className="text-amber-500 animate-bounce" />
                  {sortedParticipants[0].name.replace(" (IA)", "").replace(" (Invité)", "")}
                </span>
                <span className="text-xs text-amber-600 font-extrabold">{sortedParticipants[0].score} pts</span>
                <div className="w-full bg-amber-50 border border-amber-200 h-24 rounded-t-2xl flex flex-col items-center justify-center p-2 dark:bg-amber-955/20 dark:border-amber-800">
                  <span className="text-base font-black text-amber-500">1er MAJOR</span>
                  <Trophy size={24} className="text-amber-500 mt-1" />
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {sortedParticipants[2] && (
              <div className="flex flex-col items-center w-full sm:w-24 space-y-2 order-3">
                <span className="text-xs font-semibold dark:text-orange-300 truncate w-full text-center">
                  {sortedParticipants[2].name.replace(" (IA)", "").replace(" (Invité)", "")}
                </span>
                <span className="text-[10px] text-gray-400 font-bold">{sortedParticipants[2].score} pts</span>
                <div className="w-full bg-orange-50 border border-orange-100 h-12 rounded-t-lg flex flex-col items-center justify-center p-2 dark:bg-orange-955/10 dark:border-orange-900/30">
                  <span className="text-xs font-bold text-orange-600">3e RANG</span>
                  <Award size={14} className="text-orange-500 mt-1" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t dark:border-gray-800" />

          {/* Table Listing detail */}
          <div className="max-w-xl mx-auto space-y-3">
            <h3 className="font-extrabold text-sm dark:text-white text-left uppercase text-gray-400 tracking-wider">Tableau général de classement</h3>
            
            <div className="space-y-1 bg-gray-50 dark:bg-gray-950/40 p-4 rounded-3xl border border-gray-100 dark:border-gray-800/80">
              {sortedParticipants.map((p, idx) => {
                const isUser = p.id === 'current-user';

                return (
                  <div 
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl text-xs font-semibold transition-all",
                      isUser ? "bg-faso-green/10 text-faso-green font-bold" : "text-gray-700 dark:text-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 font-bold w-6">{idx + 1}e</span>
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[10px]">
                        {p.name.slice(0, 2)}
                      </div>
                      <span>{p.name}</span>
                    </div>
                    <span className="font-mono font-bold">{p.score} points</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t dark:border-gray-800" />

          {/* Interactive Report of Corrections and Explanations */}
          <div className="max-w-xl mx-auto space-y-4 text-left">
            <h3 className="font-extrabold text-sm dark:text-white uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
              <Sparkles size={16} className="text-faso-green animate-pulse" />
              Rapport de correction et explications de l'IA
            </h3>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 grid grid-cols-1 gap-1">
              {questions.map((q, qIndex) => {
                const userAns = userAnswers[qIndex];
                const isCorrect = userAns === q.correctAnswer;

                return (
                  <div 
                    key={qIndex}
                    className={cn(
                      "p-4 rounded-2xl border transition-all text-sm space-y-3",
                      isCorrect 
                        ? "bg-green-50/20 border-green-200/50 dark:bg-green-950/5 dark:border-green-900/30" 
                        : "bg-red-50/20 border-red-200/50 dark:bg-red-950/5 dark:border-red-900/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b dark:border-gray-800 pb-2">
                      <span className={cn(
                        "text-[9px] uppercase font-black px-2.5 py-0.5 rounded-full shrink-0",
                        isCorrect 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" 
                          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                      )}>
                        Q{qIndex + 1} : {isCorrect ? 'Réussi ✓' : 'Échoué ✗'}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 font-bold">
                        {userAns !== null ? `Option choisie : ${String.fromCharCode(65 + userAns)}` : "Temps écoulé"}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white leading-relaxed">
                      <MathRenderer text={q.text} />
                    </h4>

                    {/* Options list */}
                    <div className="space-y-1.5 pl-2 border-l border-gray-200 dark:border-gray-800">
                      {q.options.map((opt, oIdx) => {
                        const isCorrectOpt = oIdx === q.correctAnswer;
                        const isUserOpt = oIdx === userAns;
                        return (
                          <div 
                            key={oIdx}
                            className={cn(
                              "text-xs p-2 rounded-lg flex items-center justify-between",
                              isCorrectOpt 
                                ? "bg-green-100/60 dark:bg-green-950/30 text-green-900 dark:text-green-300 font-extrabold" 
                                : isUserOpt 
                                  ? "bg-red-100/60 dark:bg-red-955/30 text-red-900 dark:text-red-350"
                                  : "text-gray-600 dark:text-gray-400"
                            )}
                          >
                            <span className="leading-snug">
                              {String.fromCharCode(65 + oIdx)}. <MathRenderer text={opt} />
                            </span>
                            {isCorrectOpt && <Check size={12} className="text-green-600 shrink-0 ml-1" />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Mathematical correction notes */}
                    <div className="bg-gray-50/80 dark:bg-gray-950/60 p-3 rounded-xl border border-gray-100 dark:border-gray-850 text-[11px] text-gray-600 dark:text-gray-350 font-sans leading-relaxed">
                      <strong className="text-faso-blue dark:text-blue-400 block mb-1">Démonstration pédagogique :</strong>
                      <MathRenderer text={q.explanation} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t dark:border-gray-800" />

          {/* Post action operations */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 max-w-lg mx-auto">
            <button
              onClick={handleGenerateBulletinPDF}
              className="flex-1 px-5 py-3.5 bg-faso-green hover:bg-green-600 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
            >
              <Download size={14} /> Telecharger le Bulletin (PDF)
            </button>
            <button
              onClick={() => {
                setStage('setup');
                setCustomInvitations([]);
                setNewInviteName("");
                setQuestions([]);
              }}
              className="flex-1 px-5 py-3.5 bg-faso-blue hover:bg-blue-600 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={14} /> Recommencer un Concours
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
