"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BrainCircuit, CheckCircle2, Award, BookOpen, Sparkles,
  ChevronDown, ChevronUp, ArrowRight, Trophy, FileText,
  AlertCircle, RefreshCw, ArrowLeft, Zap, Eye, MessageSquare,
  Code, Map, X, Star, Flame, Lock, TrendingUp, Users, Shield,
  Target, Clock, User
} from "lucide-react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "../config";

// Define TypeScript interfaces for the evaluation data
interface EvaluationScores {
  technical: number;
  communication: number;
  confidence: number;
  problem_solving: number;
  overall: number;
}

interface EvaluationFeedback {
  technical: string;
  communication: string;
  confidence: string;
  problem_solving: string;
  overall_summary: string;
}

interface RoadmapWeek {
  week: number;
  topic: string;
  description: string;
  actions: string[];
}

interface ResumeBulletPoint {
  before: string;
  after: string;
  rationale: string;
}

interface ResumeOptimizer {
  ats_score_impact: number;
  suggestions: string[];
  bullet_points: ResumeBulletPoint[];
}

interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface GamificationState {
  total_xp: number;
  level: number;
  rank_title: string;
  xp_into_level: number;
  xp_for_next_lvl: number;
  next_level_xp: number;
  progress_pct: number;
  streak: number;
  all_badges: string[];
  xp_earned: number;
  xp_bonus: number;
  level_up: boolean;
  new_badges: string[];
  streak_multiplier: number;
}

interface EvaluationData {
  scores: EvaluationScores;
  feedback: EvaluationFeedback;
  roadmap: RoadmapWeek[];
  resume_optimizer: ResumeOptimizer;
  achievements: Achievement[];
  xp_earned: number;
  xp_breakdown?: { base: number; score_bonus: number; achievement_bonus: number; total: number };
}

export default function ResultsPage() {
  const router = useRouter();
  
  // Loading & State variables
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [data, setData] = useState<EvaluationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gamification, setGamification] = useState<GamificationState | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const hasEvaluated = useRef(false); // Prevents duplicate evaluate calls
  
  // Interactive component states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"roadmap" | "resume">("roadmap");
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
  const [roadmapChecked, setRoadmapChecked] = useState<Record<string, boolean>>({});
  const [hoveredScore, setHoveredScore] = useState<{ name: string; val: number } | null>(null);
  const [showBadgeVault, setShowBadgeVault] = useState(false);

  // Simulated loading messages
  const loadingSteps = [
    "Compiling chat transcripts...",
    "Analyzing semantic answer depth...",
    "Running Gemini cognitive competency evaluations...",
    "Assessing eye gaze and stress patterns...",
    "Formulating ATS resume optimizations...",
    "Generating personalized learning roadmaps...",
    "Minting achievement badges..."
  ];

  // Full icon map for all badge types
  const iconMap: Record<string, any> = {
    MessageSquare, Eye, Zap, Code, Award, Trophy, Star,
    Flame, TrendingUp, BookOpen, Users, Shield, Target, Clock, Lock
  };

  // All possible badges (for the vault — locked if not earned)
  const ALL_BADGES = [
    { id: "first_blood",   name: "First Blood",        icon: "Zap",           description: "Completed your very first interview on HireMind." },
    { id: "fluent_speaker",name: "Fluent Communicator",icon: "MessageSquare", description: "< 5 filler words across the entire interview." },
    { id: "logic_master",  name: "Logic Master",       icon: "Zap",           description: "Structured reasoning across all problem-solving questions." },
    { id: "cracked_hard",  name: "Cracked Hard Round", icon: "Trophy",        description: "Successfully handled Hard-difficulty questions." },
    { id: "unshakable",    name: "Unshakable Focus",   icon: "Eye",           description: "High confidence score (>85) and steady answers." },
    { id: "clean_coder",   name: "Clean Coder",        icon: "Code",          description: "Precise and well-structured code explanations." },
    { id: "perfectionist", name: "Perfectionist",      icon: "Star",          description: "Achieved an overall score above 90." },
    { id: "speed_demon",   name: "Speed Demon",        icon: "Target",        description: "Concise, sharp answers with zero rambling." },
    { id: "comeback_kid",  name: "Comeback Kid",       icon: "TrendingUp",    description: "Recovered strongly after a weak opening answer." },
    { id: "deep_diver",    name: "Deep Diver",         icon: "BookOpen",      description: "Demonstrated expert depth beyond what was asked." },
    { id: "team_player",   name: "Team Player",        icon: "Users",         description: "Highlighted strong collaboration and leadership examples." },
    { id: "streak_3",      name: "On Fire",            icon: "Flame",         description: "Completed interviews 3 days in a row." },
    { id: "streak_7",      name: "Week Warrior",       icon: "Flame",         description: "Completed interviews 7 days in a row." },
  ];

  useEffect(() => {
    // Step-by-step loading animation ticker
    if (loading) {
      const stepInterval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < loadingSteps.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 900);
      return () => clearInterval(stepInterval);
    }
  }, [loading]);

  useEffect(() => {
    const fetchEvaluation = async () => {
      // Guard: only call evaluate once per page load
      if (hasEvaluated.current) return;
      hasEvaluated.current = true;

      try {
        const session = localStorage.getItem("hiremind_user");
        if (!session) {
          router.push("/login?redirect=/results");
          return;
        }
        const loggedUser = JSON.parse(session);

        const savedConfig = localStorage.getItem("hiremind_config");
        const savedContext = localStorage.getItem("hiremind_context");
        const savedChatHistory = localStorage.getItem("hiremind_chat_history");

        const config = savedConfig ? JSON.parse(savedConfig) : { interview_mode: "General", persona: "Friendly" };
        const context = savedContext ? JSON.parse(savedContext) : { skills: ["React", "Python"], experience_level: "Mid" };
        const rawHistory = savedChatHistory ? JSON.parse(savedChatHistory) : [];

        // Format history for backend EvaluationRequest: List of Dict[str, str] mapping role key to content
        const chatHistory = rawHistory.map((msg: any) => ({
          [msg.role]: msg.content
        }));

        const response = await fetch(`${API_BASE_URL}/api/interview/evaluate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            context: {
              ...config,
              extracted_context: context,
              user_id: loggedUser.id,
              username: loggedUser.username
            },
            chat_history: chatHistory
          })
        });

        if (!response.ok) {
          throw new Error("Failed to contact the evaluation server.");
        }

        const resJson = await response.json();
        if (resJson.status === "success" && resJson.data) {
          setData(resJson.data);
          if (resJson.gamification) {
            setGamification(resJson.gamification);
            if (resJson.gamification.level_up) {
              setTimeout(() => setShowLevelUpModal(true), 1800);
            }
          }
        } else {
          throw new Error("Invalid response format received from server.");
        }
      } catch (err: any) {
        console.error("Evaluation error:", err);
        setError(err.message || "An unexpected error occurred.");
      } finally {
        // Ensure a minimum loading display for premium aesthetic feel
        setTimeout(() => {
          setLoading(false);
        }, 1200);
      }
    };

    fetchEvaluation();
  }, []);

  // Radar Chart dimensions
  const center = 170;
  const radius = 80;
  const dimensions = [
    { key: "technical", label: "Technical Skill" },
    { key: "communication", label: "Communication" },
    { key: "confidence", label: "Confidence" },
    { key: "problem_solving", label: "Problem Solving" },
    { key: "overall", label: "Overall" }
  ];

  // Helper to compute vertices coordinates for the SVG polygon
  const getCoordinates = (scores: EvaluationScores, offsetMultiplier = 1) => {
    return dimensions.map((dim, i) => {
      const angle = i * (2 * Math.PI / 5) - Math.PI / 2;
      const val = scores[dim.key as keyof EvaluationScores] || 50;
      const x = center + radius * (val / 100) * Math.cos(angle) * offsetMultiplier;
      const y = center + radius * (val / 100) * Math.sin(angle) * offsetMultiplier;
      return { x, y, angle, label: dim.label, value: val };
    });
  };

  const coordinates = data ? getCoordinates(data.scores) : [];
  const polygonPoints = coordinates.map(c => `${c.x},${c.y}`).join(" ");

  const handleCheckboxToggle = (weekIndex: number, actionIndex: number) => {
    const key = `${weekIndex}-${actionIndex}`;
    setRoadmapChecked(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="flex-1 flex flex-col w-full bg-background min-h-screen relative overflow-x-hidden p-4 md:p-8">
      {/* Background glow flares */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] bg-primary-600/10 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] bg-secondary-600/10 pointer-events-none" />

      {/* Header bar */}
      <header className="max-w-6xl mx-auto w-full flex justify-between items-center mb-8 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push("/setup")}
            className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Dashboard
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!loading && (
            <>
              {/* Map Modal trigger button */}
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 text-zinc-300 rounded-xl font-medium hover:text-white hover:bg-zinc-800 transition-all cursor-pointer text-sm"
              >
                <Map className="w-4 h-4 text-primary-400 animate-pulse" /> View Map
              </button>

              <button 
                onClick={() => router.push("/interview")}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl font-medium shadow-lg hover:shadow-primary-500/10 transition-all transform hover:scale-[1.02] text-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Restart Interview
              </button>
            </>
          )}
        </div>
      </header>

      {/* Animate Loading State */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full z-20 my-12"
          >
            <div className="relative w-36 h-36 flex items-center justify-center mb-8">
              {/* Outer pulsing glass orb */}
              <motion.div 
                animate={{ scale: [1, 1.15, 1], rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full border border-primary-500/20 bg-primary-500/5 shadow-[0_0_40px_rgba(139,92,246,0.15)]"
              />
              <motion.div 
                animate={{ scale: [1.1, 0.95, 1.1] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="absolute inset-4 rounded-full border border-dashed border-secondary-500/20 bg-secondary-500/5"
              />
              <BrainCircuit className="w-12 h-12 text-primary-400 animate-pulse" />
            </div>

            <div className="text-center w-full max-w-md">
              <h3 className="text-lg font-bold text-white mb-2">Analyzing Interview Performance</h3>
              <div className="h-6 overflow-hidden relative">
                <AnimatePresence mode="popLayout">
                  <motion.p 
                    key={loadingStep}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs text-zinc-400 uppercase tracking-widest font-semibold"
                  >
                    {loadingSteps[loadingStep]}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-900 border border-white/5 h-2 rounded-full mt-4 overflow-hidden">
                <motion.div 
                  initial={{ width: "5%" }}
                  animate={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="bg-gradient-to-r from-primary-500 via-purple-500 to-secondary-500 h-full"
                />
              </div>
            </div>
          </motion.div>
        ) : error ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center z-10"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Evaluation Failed</h3>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              We encountered an issue during analysis: {error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 text-white rounded-xl hover:bg-zinc-800 transition-colors text-sm font-semibold cursor-pointer"
            >
              Try Again
            </button>
          </motion.div>
        ) : data ? (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 z-10 pb-16"
          >
            
            {/* LEFT COLUMN: Summary, Interactive Map Trigger Card, Gamification */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Score Summary Card */}
              <div className="glass-card p-6 rounded-2xl flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary-600/10 to-transparent rounded-bl-full pointer-events-none" />
                
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Overall Standing</h3>
                
                {/* Glowing Score Progress Circle */}
                <div className="relative w-36 h-36 flex items-center justify-center mb-4">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle 
                      cx="72" 
                      cy="72" 
                      r="64" 
                      className="stroke-zinc-800 fill-none" 
                      strokeWidth="8" 
                    />
                    <motion.circle 
                      cx="72" 
                      cy="72" 
                      r="64" 
                      className="stroke-primary-500 fill-none filter drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]" 
                      strokeWidth="8" 
                      strokeDasharray={2 * Math.PI * 64}
                      initial={{ strokeDashoffset: 2 * Math.PI * 64 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 64 * (1 - data.scores.overall / 100) }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-extrabold text-white tracking-tight">{data.scores.overall}</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Scale / 100</span>
                  </div>
                </div>

                <p className="text-zinc-300 text-sm leading-relaxed max-w-sm">
                  {data.feedback.overall_summary}
                </p>
              </div>

              {/* Gamification Hub — Dynamic Per-User */}
              <div className="glass-card p-6 rounded-2xl flex flex-col gap-5 relative overflow-hidden">
                {/* Background glow */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-violet-600/10 to-transparent rounded-bl-full pointer-events-none" />

                {/* Header row */}
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Career Progression</h3>
                  <div className="flex items-center gap-2">
                    {gamification && gamification.streak > 1 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold">
                        <Flame className="w-3 h-3" /> {gamification.streak}-Day Streak
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold tracking-wider flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {gamification ? `LVL ${gamification.level}` : "LVL 1"}
                    </span>
                  </div>
                </div>

                {/* Level + Rank display */}
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" className="fill-none stroke-zinc-800" strokeWidth="5" />
                      <motion.circle
                        cx="28" cy="28" r="24"
                        className="fill-none stroke-violet-500"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 24}
                        initial={{ strokeDashoffset: 2 * Math.PI * 24 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - (gamification?.progress_pct ?? 0) / 100) }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-extrabold text-white">{gamification?.level ?? 1}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-extrabold text-white leading-tight">{gamification?.rank_title ?? "Recruit"}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Current Rank</p>
                    <div className="mt-2 w-full bg-zinc-950 border border-white/5 h-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: `${gamification?.progress_pct ?? 0}%` }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-600 mt-1 font-semibold">
                      <span>{gamification?.xp_into_level?.toLocaleString() ?? 0} XP</span>
                      <span>{gamification?.xp_for_next_lvl?.toLocaleString() ?? 500} XP to next</span>
                    </div>
                  </div>
                </div>

                {/* Interview too short warning */}
                {gamification && (gamification as any).skipped_reason && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[11px]">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-amber-300/80">{(gamification as any).skipped_reason}. <span className="text-amber-400 font-bold">No XP was awarded this session.</span> Complete a full interview to earn XP!</span>
                  </div>
                )}

                {/* XP earned this session */}
                <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-4">
                  <div className="flex flex-col items-center p-2.5 rounded-xl bg-violet-500/5 border border-violet-500/10">
                    <span className="text-lg font-extrabold text-violet-400">+{gamification?.xp_earned ?? data.xp_earned}</span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Session XP</span>
                  </div>
                  <div className="flex flex-col items-center p-2.5 rounded-xl bg-zinc-900/50 border border-white/5">
                    <span className="text-lg font-extrabold text-white">{gamification?.total_xp?.toLocaleString() ?? data.xp_earned}</span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Total XP</span>
                  </div>
                  <div className="flex flex-col items-center p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/10">
                    <span className="text-lg font-extrabold text-orange-400">{gamification?.streak ?? 0}🔥</span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Streak</span>
                  </div>
                </div>

                {/* Streak bonus callout */}
                {gamification && gamification.xp_bonus > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/5 border border-orange-500/10 text-[11px]">
                    <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="text-zinc-400">Streak multiplier <span className="text-orange-400 font-bold">×{gamification.streak_multiplier}</span> added <span className="text-orange-300 font-bold">+{gamification.xp_bonus} bonus XP</span></span>
                  </div>
                )}

                {/* Badge Vault */}
                <div className="border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      Badge Vault — {(gamification?.all_badges ?? data.achievements.map(a => a.id)).length}/{ALL_BADGES.length} Unlocked
                    </span>
                    <button
                      onClick={() => setShowBadgeVault(v => !v)}
                      className="text-[9px] text-primary-400 hover:text-primary-300 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      {showBadgeVault ? "Hide All" : "View All"}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(showBadgeVault ? ALL_BADGES : ALL_BADGES.slice(0, 8)).map((badge) => {
                      const earned = (gamification?.all_badges ?? data.achievements.map(a => a.id)).includes(badge.id);
                      const isNew = (gamification?.new_badges ?? []).includes(badge.id);
                      const IconComponent = iconMap[badge.icon] || Trophy;
                      return (
                        <div
                          key={badge.id}
                          className={`group relative flex flex-col items-center text-center p-2 rounded-xl border transition-all cursor-pointer ${
                            earned
                              ? isNew
                                ? "bg-violet-500/15 border-violet-500/40 shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                                : "bg-zinc-900/50 border-white/10 hover:border-primary-500/30"
                              : "bg-zinc-950/50 border-white/5 opacity-40 grayscale"
                          }`}
                        >
                          {isNew && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-violet-500 border border-zinc-950 animate-pulse" />
                          )}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-transform ${
                            earned ? "bg-primary-500/15 border border-primary-500/20 text-primary-400 group-hover:scale-110" : "bg-zinc-900 text-zinc-600"
                          }`}>
                            {earned ? <IconComponent className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-[8px] font-bold text-zinc-300 leading-tight line-clamp-2">{badge.name}</span>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-20 w-40 p-2 bg-zinc-950 border border-white/10 rounded-lg text-[9px] text-zinc-300 text-left shadow-2xl leading-normal pointer-events-none">
                            <div className="font-bold text-white mb-0.5">{badge.name}</div>
                            {badge.description}
                            {!earned && <div className="text-zinc-600 mt-1 italic">🔒 Not yet unlocked</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Profile link */}
                <button
                  onClick={() => router.push("/profile")}
                  className="w-full py-2 rounded-xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-primary-500/20 transition-all text-[10px] text-zinc-400 hover:text-primary-400 font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" /> View Full Progress Profile
                </button>

              </div>

            </div>

            {/* RIGHT COLUMN: Navigation Tabs + Details Widgets */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Tab Navigation Menu */}
              <div className="flex bg-zinc-900/60 p-1.5 rounded-2xl border border-white/5 w-full">
                {[
                  { id: "roadmap", label: "Learning Roadmap", icon: BookOpen },
                  { id: "resume", label: "ATS Resume Optimizer", icon: FileText }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                        isActive 
                          ? "bg-zinc-800 text-white shadow" 
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-primary-400" : ""}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Content Panels based on Active Tab */}
              <div className="flex-1">
                
                {/* 1. LEARNING ROADMAP TAB */}
                {activeTab === "roadmap" && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="p-4 rounded-xl bg-primary-500/5 border border-primary-500/10 text-xs text-primary-300 flex items-start gap-2.5 mb-2 leading-relaxed">
                      <Sparkles className="w-4 h-4 shrink-0 text-primary-400 mt-0.5" />
                      <span>We custom-synthesized a 3-week learning horizon to patch specific gaps noticed during the interview session. Mark tasks completed to level up!</span>
                    </div>

                    <div className="relative border-l border-zinc-800 ml-4 pl-6 flex flex-col gap-6">
                      {data.roadmap.map((week) => {
                        const isExpanded = expandedWeek === week.week;
                        return (
                          <div key={week.week} className="relative">
                            {/* Marker dot */}
                            <div className={`absolute left-[-31px] top-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                              isExpanded ? "bg-primary-500 border-primary-400" : "bg-zinc-950 border-zinc-700"
                            }`} />

                            <div 
                              onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                              className="glass-card p-5 rounded-2xl hover:bg-zinc-900/40 transition-colors cursor-pointer select-none"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="text-[10px] text-primary-400 font-bold uppercase tracking-widest">Week 0{week.week}</span>
                                  <h4 className="text-base font-bold text-white mt-0.5">{week.topic}</h4>
                                </div>
                                {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                    animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                    className="overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                                      {week.description}
                                    </p>

                                    <div className="flex flex-col gap-2.5">
                                      {week.actions.map((act, actIdx) => {
                                        const isChecked = !!roadmapChecked[`${week.week}-${actIdx}`];
                                        return (
                                          <div 
                                            key={actIdx}
                                            onClick={() => handleCheckboxToggle(week.week, actIdx)}
                                            className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-950 border border-white/5 hover:border-zinc-800 transition-all cursor-pointer"
                                          >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                              isChecked ? "bg-primary-500 border-primary-500 text-white" : "border-zinc-700 bg-transparent"
                                            }`}>
                                              {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                                            </div>
                                            <span className={`text-xs ${isChecked ? "text-zinc-500 line-through" : "text-zinc-300"}`}>
                                              {act}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 2. ATS RESUME OPTIMIZER TAB */}
                {activeTab === "resume" && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-5"
                  >
                    
                    {/* Impact Overview */}
                    <div className="glass-card p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white">Estimated ATS Impact</h4>
                          <p className="text-xs text-zinc-400">Projected score boost after rewriting your resume points</p>
                        </div>
                      </div>
                      <div className="text-center sm:text-right">
                        <span className="text-3xl font-extrabold text-emerald-400">+{data.resume_optimizer.ats_score_impact}%</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Score Increase</span>
                      </div>
                    </div>

                    {/* Skill/Keyword Recommendations */}
                    <div className="glass-card p-5 rounded-2xl">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Recommended Modifications</h4>
                      <ul className="space-y-2.5 text-xs text-zinc-300 list-none">
                        {data.resume_optimizer.suggestions.map((sug, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="text-primary-400 mt-0.5 font-bold">•</span>
                            <span className="leading-relaxed">{sug}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Before/After bullet point comparison */}
                    <div className="flex flex-col gap-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Bullet Point Rewrites</h4>
                      {data.resume_optimizer.bullet_points.map((bp, i) => (
                        <div key={i} className="glass-card p-5 rounded-2xl flex flex-col gap-3.5">
                          
                          {/* Before card */}
                          <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 text-[10px] font-bold">
                              ✗
                            </div>
                            <div className="text-xs">
                              <span className="text-[9px] text-red-400 uppercase tracking-wider font-extrabold block mb-0.5">Original (Vague)</span>
                              <p className="text-zinc-400 line-through leading-relaxed">{bp.before}</p>
                            </div>
                          </div>

                          {/* After card */}
                          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 text-[10px] font-bold">
                              ✓
                            </div>
                            <div className="text-xs flex-1">
                              <span className="text-[9px] text-emerald-400 uppercase tracking-wider font-extrabold block mb-0.5">Suggested (Quantified & Actionable)</span>
                              <p className="text-zinc-200 font-medium leading-relaxed">{bp.after}</p>
                            </div>
                          </div>

                          {/* Rationale explanation */}
                          <div className="text-[11px] text-zinc-500 flex items-start gap-1.5 leading-relaxed bg-zinc-950 p-2.5 rounded-lg border border-white/5">
                            <span className="font-bold text-primary-400 uppercase tracking-widest text-[9px] shrink-0 mt-0.5">Why this works:</span>
                            <span>{bp.rationale}</span>
                          </div>

                        </div>
                      ))}
                    </div>

                  </motion.div>
                )}

              </div>

            </div>

          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Modal Dialog portal */}
      <AnimatePresence>
        {isModalOpen && data && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            {/* Modal Box Container */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 25 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 25 }}
              transition={{ type: "spring", duration: 0.45 }}
              className="relative max-w-5xl w-full rounded-3xl border border-white/10 bg-zinc-950/90 p-6 md:p-8 flex flex-col md:flex-row gap-8 overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.2)] z-10 max-h-[90vh] overflow-y-auto scrollbar-thin"
            >
              {/* Internal neon blurs for high aesthetic overlay */}
              <div className="absolute top-[-20%] left-[-20%] w-[350px] h-[350px] rounded-full blur-[100px] bg-primary-500/10 pointer-events-none" />
              <div className="absolute bottom-[-20%] right-[-20%] w-[350px] h-[350px] rounded-full blur-[100px] bg-secondary-500/10 pointer-events-none" />

              {/* Close Button */}
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-900/50 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors z-20 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Left Column: SVG Radar Chart */}
              <div className="md:w-1/2 flex flex-col items-center justify-center p-4 border-b md:border-b-0 md:border-r border-white/5">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                    <Map className="w-5 h-5 text-primary-400" /> Skills Matrix Map
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">Graphed dimensional competency analysis</p>
                </div>

                <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center">
                  <svg className="w-[340px] h-[300px]" viewBox="0 0 340 300">
                    <defs>
                      <radialGradient id="modalRadarGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="var(--color-secondary-500)" stopOpacity="0.05" />
                      </radialGradient>
                    </defs>

                    {/* Concentric grid lines */}
                    {[20, 40, 60, 80, 100].map((level) => {
                      const levelCoords = getCoordinates({
                        technical: level,
                        communication: level,
                        confidence: level,
                        problem_solving: level,
                        overall: level
                      });
                      const pointsStr = levelCoords.map(c => `${c.x},${c.y}`).join(" ");
                      return (
                        <polygon 
                          key={level}
                          points={pointsStr} 
                          className="fill-none stroke-zinc-800/80" 
                          strokeWidth="1"
                          strokeDasharray={level === 100 ? "none" : "3,3"}
                        />
                      );
                    })}

                    {/* Axis lines */}
                    {getCoordinates({ technical: 100, communication: 100, confidence: 100, problem_solving: 100, overall: 100 }).map((c, i) => (
                      <line 
                        key={i}
                        x1={center} 
                        y1={center} 
                        x2={c.x} 
                        y2={c.y} 
                        className="stroke-zinc-800" 
                        strokeWidth="1.5"
                      />
                    ))}

                    {/* Glow Graphed Area */}
                    <motion.polygon 
                      points={polygonPoints}
                      className="stroke-primary-500 fill-[url(#modalRadarGlow)] filter drop-shadow-[0_0_10px_rgba(217,70,239,0.25)]"
                      strokeWidth="2.5"
                      initial={{ scale: 0.1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{ originX: `${center}px`, originY: `${center}px` }}
                    />

                    {/* Interactive circles */}
                    {coordinates.map((c, i) => (
                      <circle 
                        key={i}
                        cx={c.x} 
                        cy={c.y} 
                        r="5.5" 
                        className="fill-zinc-950 stroke-secondary-500 cursor-pointer hover:fill-secondary-400 transition-colors"
                        strokeWidth="2"
                        onMouseEnter={() => setHoveredScore({ name: c.label, val: c.value })}
                        onMouseLeave={() => setHoveredScore(null)}
                      />
                    ))}

                    {/* Outer dimension Labels */}
                    {getCoordinates({ technical: 100, communication: 100, confidence: 100, problem_solving: 100, overall: 100 }, 1.14).map((c, i) => {
                      const isLeft = c.x < center;
                      return (
                        <text
                          key={i}
                          x={c.x}
                          y={c.y + 4}
                          textAnchor={Math.abs(c.x - center) < 10 ? "middle" : isLeft ? "end" : "start"}
                          className="fill-zinc-400 font-semibold text-[8px] uppercase tracking-wide"
                        >
                          {dimensions[i].label}
                        </text>
                      );
                    })}
                  </svg>

                  <AnimatePresence>
                    {hoveredScore && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg text-xs shadow-xl flex flex-col items-center pointer-events-none"
                      >
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold">{hoveredScore.name}</span>
                        <span className="text-sm font-bold text-secondary-400 mt-0.5">{hoveredScore.val} / 100</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right Column: Skills Feedback lists */}
              <div className="md:w-1/2 flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin">
                <div className="mb-2">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-secondary-400 animate-pulse" /> Detailed Skills Review
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">Interviewer assessment per core competency</p>
                </div>

                <div className="flex flex-col gap-3">
                  {dimensions.filter(d => d.key !== "overall").map((dim) => {
                    const score = data.scores[dim.key as keyof EvaluationScores];
                    const review = data.feedback[dim.key as keyof EvaluationFeedback];
                    return (
                      <div 
                        key={dim.key} 
                        className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-white/10 hover:bg-zinc-900/60 transition-all flex flex-col gap-1.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">{dim.label}</span>
                          <span className="px-2 py-0.5 rounded bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-black">
                            {score}/100
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {review}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Level-Up Celebration Modal ─────────────────────────────── */}
      <AnimatePresence>
        {showLevelUpModal && gamification && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLevelUpModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="relative z-10 max-w-md w-full text-center"
            >
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-violet-500/20 to-fuchsia-500/10 blur-2xl pointer-events-none" />
              <div className="relative bg-zinc-950 border border-violet-500/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(139,92,246,0.3)] overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />

                {/* Animated badge */}
                <motion.div
                  animate={{ rotate: [0, -5, 5, -5, 0], scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(139,92,246,0.5)]"
                >
                  <span className="text-4xl font-black text-white">{gamification.level}</span>
                </motion.div>

                <div className="mb-1 text-[11px] text-violet-400 font-bold uppercase tracking-[0.2em]">Rank Achieved</div>
                <h2 className="text-3xl font-extrabold text-white mb-1">{gamification.rank_title}</h2>
                <p className="text-sm text-zinc-400 mb-6">You leveled up to <span className="text-violet-300 font-bold">Level {gamification.level}</span> — keep interviewing to unlock the next tier!</p>

                {gamification.new_badges.length > 0 && (
                  <div className="mb-6 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider mb-2">New Badges Unlocked</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {gamification.new_badges.map(bid => {
                        const badge = ALL_BADGES.find(b => b.id === bid);
                        if (!badge) return null;
                        const Ic = iconMap[badge.icon] || Trophy;
                        return (
                          <div key={bid} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-violet-500/20 text-[10px] font-bold text-violet-300">
                            <Ic className="w-3 h-3" /> {badge.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                    <div className="text-lg font-extrabold text-violet-400">+{gamification.xp_earned.toLocaleString()}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">XP Earned</div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                    <div className="text-lg font-extrabold text-white">{gamification.total_xp.toLocaleString()}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">Total XP</div>
                  </div>
                </div>

                <button
                  onClick={() => setShowLevelUpModal(false)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer"
                >
                  🎉 Awesome! Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
