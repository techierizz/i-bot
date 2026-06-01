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
import UserBox from "@/components/UserBox";

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

interface ATSLineModification {
  exact_line: string;
  modification_reason: string;
  suggested_change: string;
}

interface ResumeOptimizer {
  ats_score_impact: number;
  line_modifications: ATSLineModification[];
  top_tips: string[];
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
  xp_breakdown?: { base: number; score_bonus: number; achievement_bonus: number; deductions?: number; deduction_reason?: string; total: number };
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
        const savedMetrics = localStorage.getItem("hiremind_interview_metrics");
        const cachedEvaluation = localStorage.getItem("hiremind_evaluation_result");

        if (cachedEvaluation) {
           const parsed = JSON.parse(cachedEvaluation);
           if (parsed.evaluation_data) {
             setData(parsed.evaluation_data);
             if (parsed.gamification) {
               setGamification(parsed.gamification);
             }
           } else if (parsed.scores) {
             // Fallback for old cache format
             setData(parsed);
           }
           setLoadingStep(loadingSteps.length - 1);
           setTimeout(() => setLoading(false), 500);
           return;
        }

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
              username: loggedUser.username,
              metrics: savedMetrics ? JSON.parse(savedMetrics) : {}
            },
            chat_history: chatHistory
          })
        });

        if (!response.ok) {
          throw new Error("Failed to contact the evaluation server.");
        }

        const result = await response.json();
        
        if (result.status === "success") {
          setData(result.data);
          
          if (result.gamification) {
            setGamification(result.gamification);
            if (result.gamification.level_up) {
              setShowLevelUpModal(true);
            }
          }
          
          // Cache the evaluation so returning to this page doesn't re-evaluate
          localStorage.setItem("hiremind_evaluation_result", JSON.stringify({
            evaluation_data: result.data,
            gamification: result.gamification
          }));
          
          setLoadingStep(loadingSteps.length - 1);
          setTimeout(() => setLoading(false), 500);
        } else {
          setError(result.message || "An error occurred during evaluation.");
          setLoading(false);
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

  useEffect(() => {
    // Load completed tasks from localStorage to prevent farming
    const savedCompleted = localStorage.getItem("hiremind_completed_tasks");
    if (savedCompleted) {
      try {
        const parsed = JSON.parse(savedCompleted);
        const state: Record<string, boolean> = {};
        parsed.forEach((k: string) => state[k] = true);
        setRoadmapChecked(state);
      } catch (e) { }
    }
  }, []);

  const handleCheckboxToggle = async (weekIndex: number, actionIndex: number) => {
    if (!data || !data.roadmap) return;
    
    const key = `${weekIndex}-${actionIndex}`;
    const wasAlreadySaved = !!roadmapChecked[key];
    
    // Calculate total tasks in the roadmap
    let totalTasks = 0;
    data.roadmap.forEach(week => {
        totalTasks += week.actions.length;
    });

    const newState = { ...roadmapChecked, [key]: !roadmapChecked[key] };
    const trueKeys = Object.keys(newState).filter(k => newState[k]);
    
    setRoadmapChecked(newState);
    localStorage.setItem("hiremind_completed_tasks", JSON.stringify(trueKeys));

    // Check if ALL tasks are now checked
    if (trueKeys.length === totalTasks && totalTasks > 0) {
        const rewardClaimed = localStorage.getItem("hiremind_roadmap_reward_claimed");
        if (!rewardClaimed) {
            localStorage.setItem("hiremind_roadmap_reward_claimed", "true");
            
            // Give 200 XP once for completing the entire roadmap
            try {
                const session = localStorage.getItem("hiremind_user");
                if (session) {
                    const loggedUser = JSON.parse(session);
                    const response = await fetch(`${API_BASE_URL}/api/gamification/add_xp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            user_id: loggedUser.id,
                            amount: 200
                        })
                    });
                    const result = await response.json();
                    if (result.status === "success" && result.gamification) {
                        setGamification(result.gamification);
                        if (result.gamification.level_up) {
                            setTimeout(() => setShowLevelUpModal(true), 500);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to add roadmap completion XP:", err);
            }
        }
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full bg-background min-h-screen relative overflow-x-hidden p-4 md:p-8">
      {/* Background glow flares */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] bg-primary-600/10 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] bg-secondary-600/10 pointer-events-none" />

      {!loading && (
        <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 z-20 relative">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => router.push("/setup")}
              className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                Dashboard
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            {/* Map Modal trigger button */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-zinc-900 border border-white/10 text-zinc-300 rounded-xl font-medium hover:text-white hover:bg-zinc-800 transition-all cursor-pointer text-xs sm:text-sm"
            >
              <Map className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-400 animate-pulse" /> View Map
            </button>

            <UserBox forceShow className="flex items-center gap-2" />

            <button 
              onClick={() => router.push("/interview")}
              className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-1.5 sm:py-2.5 bg-gradient-to-r from-white to-zinc-200 text-zinc-950 rounded-xl font-extrabold shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all transform hover:scale-[1.05] active:scale-95 text-xs sm:text-sm cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Another interview
            </button>
          </div>
        </header>
      )}

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
              
              {/* Premium Score Summary Card */}
              <div className="relative p-8 rounded-3xl flex flex-col items-center text-center overflow-hidden border border-white/[0.05] bg-zinc-950/40 backdrop-blur-3xl shadow-[0_0_80px_rgba(139,92,246,0.05)] group hover:shadow-[0_0_100px_rgba(139,92,246,0.1)] transition-all duration-700">
                {/* Dynamic Background Mesh / Glows */}
                <div className="absolute top-[-25%] left-[-25%] w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.15)_0%,transparent_50%)] animate-[spin_15s_linear_infinite]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950/90" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 blur-[50px] rounded-full pointer-events-none" />

                <h3 className="relative z-10 text-[10px] font-extrabold text-zinc-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-400" /> Overall Standing
                </h3>
                
                {/* Stunning Glowing Progress Circle */}
                <div className="relative z-10 w-48 h-48 flex items-center justify-center mb-8">
                  <svg className="w-full h-full transform -rotate-90 overflow-visible">
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#c084fc" /> {/* purple-400 */}
                        <stop offset="100%" stopColor="#8b5cf6" /> {/* violet-500 */}
                      </linearGradient>
                      <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    {/* Background Track */}
                    <circle cx="96" cy="96" r="80" className="stroke-zinc-800/40 fill-none" strokeWidth="6" />
                    {/* Glowing Progress */}
                    <motion.circle 
                      cx="96" cy="96" r="80" 
                      className="fill-none" 
                      stroke="url(#scoreGradient)"
                      strokeWidth="10" 
                      strokeDasharray={2 * Math.PI * 80}
                      initial={{ strokeDashoffset: 2 * Math.PI * 80 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 80 * (1 - data.scores.overall / 100) }}
                      transition={{ duration: 2, ease: [0.175, 0.885, 0.32, 1.275] }}
                      strokeLinecap="round"
                      filter="url(#neonGlow)"
                    />
                  </svg>
                  {/* Inner Score Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <motion.span 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 1, delay: 0.5, type: "spring" }}
                      className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] tracking-tighter"
                    >
                      {data.scores.overall}
                    </motion.span>
                    <span className="text-[9px] text-primary-400 uppercase tracking-[0.2em] font-bold mt-1 opacity-80">Scale / 100</span>
                  </div>
                </div>

                <p className="relative z-10 text-zinc-300 text-sm leading-loose max-w-sm font-medium">
                  {data.feedback.overall_summary}
                </p>
              </div>

              {/* Gamification Receipt Panel */}
              {data.xp_breakdown && (
                <div className="relative p-6 rounded-3xl border border-white/5 bg-zinc-950/40 backdrop-blur-md shadow-xl flex flex-col gap-4">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                    <Award className="w-4 h-4 text-violet-400" /> XP Breakdown Receipt
                  </h3>
                  
                  <div className="flex flex-col gap-2 font-mono text-xs sm:text-sm">
                    <div className="flex justify-between items-center text-zinc-300">
                      <span>Base XP:</span>
                      <span className="text-emerald-400 font-bold">+{data.xp_breakdown.base}</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-300">
                      <span>Score Bonus:</span>
                      <span className="text-emerald-400 font-bold">+{data.xp_breakdown.score_bonus}</span>
                    </div>
                    {data.xp_breakdown.achievement_bonus > 0 && (
                      <div className="flex justify-between items-center text-zinc-300">
                        <span>Badges:</span>
                        <span className="text-emerald-400 font-bold">+{data.xp_breakdown.achievement_bonus}</span>
                      </div>
                    )}
                    {data.xp_breakdown.deductions ? (
                      <div className="flex justify-between items-start text-zinc-300 pt-2 border-t border-white/5 mt-1">
                        <div className="flex flex-col">
                          <span className="text-red-400 font-bold">Deductions:</span>
                          <span className="text-[10px] text-zinc-500 max-w-[200px] mt-1 leading-relaxed">
                            (Reason: {data.xp_breakdown.deduction_reason})
                          </span>
                        </div>
                        <span className="text-red-400 font-bold mt-0.5">-{data.xp_breakdown.deductions}</span>
                      </div>
                    ) : null}
                    
                    <div className="flex justify-between items-center text-white font-black text-base pt-3 border-t border-white/10 mt-2">
                      <span>Total:</span>
                      <span className="text-violet-400">{data.xp_breakdown.total} XP</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Navigation Tabs + Details Widgets */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Premium Tab Navigation Menu */}
              <div className="flex bg-zinc-950/50 backdrop-blur-xl p-1.5 rounded-[1.25rem] border border-white/[0.08] w-full relative z-10 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
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
                      className={`relative flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-bold tracking-[0.1em] uppercase transition-all cursor-pointer z-10 ${
                        isActive 
                          ? "text-white" 
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {isActive && (
                        <motion.div 
                          layoutId="activeTabPill"
                          className="absolute inset-0 bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 backdrop-blur-md rounded-xl border border-white/[0.15] shadow-[0_0_20px_rgba(0,0,0,0.6)] -z-10"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon className={`w-4 h-4 z-10 transition-colors ${isActive ? "text-primary-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" : ""}`} />
                      <span className="z-10">{tab.label}</span>
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
                    {!data.roadmap || data.roadmap.length === 0 ? (
                      <div className="p-10 text-center flex flex-col items-center justify-center bg-zinc-950/40 rounded-2xl border border-white/5 mt-4">
                        <BookOpen className="w-12 h-12 text-zinc-600 mb-4 opacity-50" />
                        <h3 className="text-zinc-300 font-bold mb-2">No Roadmap Generated</h3>
                        <p className="text-xs text-zinc-500 max-w-sm">
                          The interview was ended before enough data could be gathered. Complete at least one question in your next interview to receive a personalized learning roadmap.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 rounded-xl bg-primary-500/5 border border-primary-500/10 text-xs text-primary-300 flex items-start gap-2.5 mb-2 leading-relaxed">
                          <Sparkles className="w-4 h-4 shrink-0 text-primary-400 mt-0.5" />
                          <span>We custom-synthesized a 3-week learning horizon to patch specific gaps noticed during the interview session. Mark tasks completed to level up!</span>
                        </div>

                        <div className="relative border-l-2 border-primary-500/20 ml-4 pl-6 flex flex-col gap-8">
                      {data.roadmap.map((week) => {
                        const isExpanded = expandedWeek === week.week;
                        return (
                          <div key={week.week} className="relative group">
                            {/* Glowing Marker Dot */}
                            <div className={`absolute left-[-35px] top-4 w-5 h-5 rounded-full border-[3px] flex items-center justify-center transition-all duration-300 ${
                              isExpanded 
                                ? "bg-zinc-950 border-primary-400 shadow-[0_0_15px_rgba(139,92,246,0.8)] scale-110" 
                                : "bg-zinc-950 border-zinc-700 group-hover:border-primary-500/50"
                            }`}>
                              {isExpanded && <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />}
                            </div>

                            <div 
                              onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                              className={`relative p-6 rounded-3xl transition-all duration-500 cursor-pointer select-none overflow-hidden ${
                                isExpanded 
                                  ? "bg-zinc-900/40 border border-primary-500/30 shadow-[0_0_40px_rgba(139,92,246,0.1)]" 
                                  : "bg-zinc-950/40 border border-white/[0.05] hover:border-primary-500/20 hover:bg-zinc-900/20"
                              }`}
                            >
                              {isExpanded && (
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 blur-[40px] pointer-events-none rounded-full" />
                              )}
                              <div className="flex justify-between items-center relative z-10">
                                <div>
                                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isExpanded ? "text-primary-400" : "text-zinc-500"}`}>Week 0{week.week}</span>
                                  <h4 className="text-lg font-bold text-white mt-1 tracking-tight">{week.topic}</h4>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isExpanded ? "bg-primary-500/20 text-primary-400" : "bg-zinc-900 text-zinc-500 group-hover:text-zinc-300"}`}>
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                    animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                    className="overflow-hidden relative z-10"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <p className="text-sm text-zinc-400 leading-relaxed mb-5 font-medium">
                                      {week.description}
                                    </p>

                                    <div className="flex flex-col gap-3">
                                      {week.actions.map((act, actIdx) => {
                                        const isChecked = !!roadmapChecked[`${week.week}-${actIdx}`];
                                        return (
                                          <div 
                                            key={actIdx}
                                            onClick={() => handleCheckboxToggle(week.week, actIdx)}
                                            className={`group/task flex items-center gap-3.5 p-3.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                                              isChecked 
                                                ? "bg-primary-500/5 border-primary-500/20" 
                                                : "bg-zinc-950/50 border-white/[0.05] hover:border-white/10 hover:bg-zinc-900/50"
                                            }`}
                                          >
                                            <div className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-300 ${
                                              isChecked 
                                                ? "bg-primary-500 border-primary-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.5)] scale-110" 
                                                : "border-zinc-600 bg-transparent group-hover/task:border-zinc-400"
                                            }`}>
                                              {isChecked && <CheckCircle2 className="w-4 h-4" />}
                                            </div>
                                            <span className={`text-sm font-medium transition-all duration-300 ${isChecked ? "text-zinc-500 line-through" : "text-zinc-300 group-hover/task:text-white"}`}>
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
                      </>
                    )}
                  </motion.div>
                )}

                {/* 2. ATS RESUME OPTIMIZER TAB */}
                {activeTab === "resume" && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-5"
                  >
                    {!data.resume_optimizer || (!data.resume_optimizer.line_modifications?.length && !data.resume_optimizer.top_tips?.length) ? (
                      <div className="p-10 text-center flex flex-col items-center justify-center bg-zinc-950/40 rounded-2xl border border-white/5 mt-4">
                        <FileText className="w-12 h-12 text-zinc-600 mb-4 opacity-50" />
                        <h3 className="text-zinc-300 font-bold mb-2">No Resume Optimizations</h3>
                        <p className="text-xs text-zinc-500 max-w-sm">
                          Please upload your resume to receive ATS optimizations.
                        </p>
                      </div>
                    ) : (
                      <>
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
                            <span className="text-3xl font-extrabold text-emerald-400">+{Math.abs(data.resume_optimizer.ats_score_impact)}%</span>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Score Increase</span>
                          </div>
                        </div>

                        {/* Top Tips (High Priority) */}
                        {data.resume_optimizer.top_tips && data.resume_optimizer.top_tips.length > 0 && (
                          <div className="flex flex-col gap-4 mt-2">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Critical ATS Tips
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                              {data.resume_optimizer.top_tips.map((tip, i) => (
                                <div key={i} className="glass-card p-4 rounded-xl border-l-4 border-l-amber-500 flex items-start gap-3">
                                  <div className="text-amber-500 mt-0.5">⚠️</div>
                                  <p className="text-sm text-zinc-300 leading-relaxed">{tip}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Line Modifications */}
                        {data.resume_optimizer.line_modifications && data.resume_optimizer.line_modifications.length > 0 && (
                          <div className="flex flex-col gap-4 mt-4">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Surgical Line Edits</h4>
                            {data.resume_optimizer.line_modifications.map((mod, i) => (
                              <div key={i} className="glass-card p-5 rounded-2xl flex flex-col gap-3.5 border border-white/5 hover:border-primary-500/30 transition-colors">
                                
                                {/* Before card */}
                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start gap-3 relative overflow-hidden group">
                                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50" />
                                  <div className="w-6 h-6 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 text-xs font-bold mt-1">
                                    ✗
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-[10px] text-red-400 uppercase tracking-wider font-extrabold block mb-1">Found in your Resume</span>
                                    <p className="text-zinc-400 text-sm italic font-medium leading-relaxed">"{mod.exact_line}"</p>
                                    <div className="mt-3 p-2 rounded-lg bg-black/40 border border-white/5 inline-block">
                                      <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-0.5">Why it fails ATS</span>
                                      <span className="text-xs text-zinc-300">{mod.modification_reason}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* After card */}
                                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3 relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
                                  <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 text-xs font-bold mt-1">
                                    ✓
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-extrabold block mb-1">Suggested ATS Rewrite</span>
                                    <p className="text-white text-sm font-medium leading-relaxed">{mod.suggested_change}</p>
                                  </div>
                                </div>
                                
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
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
              className="relative max-w-5xl w-full rounded-3xl border border-white/10 bg-zinc-950/90 p-4 md:p-8 flex flex-col md:flex-row gap-4 md:gap-8 overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.2)] z-10 max-h-[85vh] overflow-y-auto scrollbar-thin"
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

                <div className="relative w-full max-w-[220px] md:max-w-[320px] aspect-square flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 340 300">
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
              <div className="md:w-1/2 flex flex-col gap-4 max-h-[50vh] md:max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin pb-6 md:pb-0">
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
