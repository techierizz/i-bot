"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from 'html-to-image';
import { 
  BrainCircuit, CheckCircle2, Award, BookOpen, Sparkles,
  ChevronDown, ChevronUp, ArrowRight, Trophy, FileText,
  AlertCircle, RefreshCw, ArrowLeft, Zap, Eye, MessageSquare,
  Code, Map, X, Star, Flame, Lock, TrendingUp, Users, Shield,
  Target, Clock, User, Share2, Download
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
  id?: number;
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
  const [hoveredScore, setHoveredScore] = useState<{ name: string; val: number } | null>(null);
  const [showBadgeVault, setShowBadgeVault] = useState(false);

  // Scorecard State
  const scorecardRef = useRef<HTMLDivElement>(null);
  const [isGeneratingScorecard, setIsGeneratingScorecard] = useState(false);
  const [scorecardImage, setScorecardImage] = useState<string | null>(null);

  const handleGenerateScorecard = async () => {
    if (!scorecardRef.current) return;
    setIsGeneratingScorecard(true);
    try {
      const dataUrl = await toPng(scorecardRef.current, { cacheBust: true, pixelRatio: 2 });
      setScorecardImage(dataUrl);
    } catch (err) {
      console.error("Failed to generate scorecard image", err);
    } finally {
      setIsGeneratingScorecard(false);
    }
  };

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
           localStorage.setItem("hiremind_has_interviewed", "true");
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
          localStorage.setItem("hiremind_has_interviewed", "true");
          setData(result.data);
          
          if (result.gamification) {
            setGamification(result.gamification);
            if (result.gamification.level_up) {
              setShowLevelUpModal(true);
            }
          }
          
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


  return (
    <div className="flex-1 flex flex-col w-full bg-background min-h-screen relative overflow-x-hidden p-4 md:p-8">
      {/* Background glow flares */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] bg-primary-600/10 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] bg-secondary-600/10 pointer-events-none" />

      {!loading && (
        <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 z-20 relative">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => router.push("/")}
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
              <Image src="/logo.png" alt="HireMind Logo" width={48} height={48} className="relative z-10 opacity-80" />
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

                {/* Scorecard Share Button */}
                <button
                  onClick={handleGenerateScorecard}
                  disabled={isGeneratingScorecard}
                  className="relative z-10 w-full py-3 mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0a66c2] to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold transition-all shadow-[0_0_20px_rgba(10,102,194,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {isGeneratingScorecard ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                  {isGeneratingScorecard ? "Generating..." : "Share to LinkedIn"}
                </button>
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

            {/* RIGHT COLUMN: Action Plan Navigation */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {(!data.roadmap || data.roadmap.length === 0) ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 glass-card rounded-3xl border border-white/5 bg-zinc-900/40">
                   <Target className="w-16 h-16 text-zinc-700 mb-6" />
                   <h3 className="text-2xl font-bold text-zinc-500 mb-3">No Roadmap Generated</h3>
                   <p className="text-zinc-600 text-base max-w-sm">You ended the interview early! Complete a full interview to receive your personalized 3-week study roadmap and action plan.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-primary-400" /> 3-Week Skill Roadmap
                    </h3>
                    {data.roadmap.map((weekItem: any, idx: number) => (
                      <div key={idx} className="glass-card p-5 rounded-2xl border border-white/5 bg-zinc-900/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />
                        <div className="flex items-start gap-4 relative z-10">
                          <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                            <span className="text-primary-400 font-black text-sm">W{weekItem.week}</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-white mb-1">{weekItem.topic}</h4>
                            <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{weekItem.description}</p>
                            <ul className="space-y-2">
                              {weekItem.actions.map((action: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                                  <div className="w-4 h-4 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                  </div>
                                  <span className="leading-relaxed">{action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-zinc-500 text-sm italic mt-2 ml-2">
                    For detailed tasks , visit action plan (the bell icon left of the profile).
                  </p>
                </>
              )}

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

      {/* ── Scorecard Generation Template (Hidden from UI) ─────────── */}
      <div className="absolute top-[-9999px] left-[-9999px] z-[-1] pointer-events-none">
        <div 
          ref={scorecardRef}
          className="w-[800px] h-[1100px] bg-zinc-950 flex flex-col items-center justify-between p-12 relative overflow-hidden rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)]"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 bg-zinc-950" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.2)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.15)_0%,transparent_60%)]" />
          
          {/* Techy Grid Overlay */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/60 to-zinc-950/90" />
          
          {/* Decorative Corner Brackets */}
          <div className="absolute top-8 left-8 w-16 h-16 border-t-[3px] border-l-[3px] border-white/20 rounded-tl-2xl" />
          <div className="absolute top-8 right-8 w-16 h-16 border-t-[3px] border-r-[3px] border-white/20 rounded-tr-2xl" />
          <div className="absolute bottom-8 left-8 w-16 h-16 border-b-[3px] border-l-[3px] border-white/20 rounded-bl-2xl" />
          <div className="absolute bottom-8 right-8 w-16 h-16 border-b-[3px] border-r-[3px] border-white/20 rounded-br-2xl" />

          {/* Top Header */}
          <div className="relative z-10 flex flex-col items-center mt-4 w-full">
             <div className="flex items-center justify-between w-full px-8 mb-8">
               <span className="text-zinc-400 font-mono text-sm tracking-widest border border-white/10 px-5 py-2 rounded-full bg-zinc-900/50 shadow-inner">ID: HM-{data?.id ? String(data.id).padStart(5, '0') : String(Math.floor(Math.random()*90000) + 10000)}</span>
               <span className="text-emerald-400 font-mono text-sm tracking-widest border border-emerald-500/20 px-5 py-2 rounded-full bg-emerald-500/10 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" /> VERIFIED
               </span>
             </div>
             
             <h1 className="text-[5.5rem] font-black text-white tracking-tighter mb-4">
               HireMind AI
             </h1>
             <p className="text-xl text-primary-400 font-bold tracking-[0.4em] uppercase bg-primary-500/10 px-8 py-2.5 rounded-full border border-primary-500/20">Official Interview Certificate</p>
          </div>
          
          {/* Main Score Area */}
          {data && (
            <div className="relative z-10 w-full flex flex-col items-center gap-10 mt-6">
               {/* Huge Score Circle with concentric rings */}
               <div className="relative w-[360px] h-[360px] flex items-center justify-center">
                 {/* Outer dashed ring */}
                 <div className="absolute inset-0 rounded-full border-[2px] border-dashed border-white/10" />
                 {/* Inner glow ring */}
                 <div className="absolute inset-5 rounded-full border-[8px] border-primary-500/60 bg-zinc-900 shadow-[0_0_80px_rgba(139,92,246,0.4)]" />
                 
                 <div className="relative flex flex-col items-center justify-center">
                   <span className="text-lg text-primary-400 font-black uppercase tracking-[0.3em] mb-2">Overall Score</span>
                   <span className="text-[130px] font-black text-white leading-none tracking-tighter">{data.scores.overall}</span>
                   <span className="text-xl text-zinc-500 mt-2 font-bold tracking-widest uppercase">/ 100 points</span>
                 </div>
               </div>
               
               {/* Rank info in a solid pill */}
               {gamification && (
                 <div className="flex flex-col items-center bg-zinc-900 border border-white/20 rounded-[2.5rem] p-10 w-full max-w-[85%] shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent opacity-80" />
                   
                   <span className="text-xl text-fuchsia-400 font-black uppercase tracking-[0.3em] mb-4">Rank Achieved</span>
                   <span className="text-[3.5rem] font-black text-white text-center leading-none">{gamification.rank_title}</span>
                   
                   <div className="mt-8 flex flex-row items-center justify-center gap-4">
                     <span className="whitespace-nowrap flex items-center justify-center px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-zinc-300 font-bold tracking-widest text-sm">LEVEL {gamification.level}</span>
                     <span className="whitespace-nowrap flex items-center justify-center px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-zinc-300 font-bold tracking-widest text-sm text-yellow-400 border-yellow-400/20 bg-yellow-400/5">
                       TOP {data.scores.overall >= 90 ? '1' : data.scores.overall >= 80 ? '5' : data.scores.overall >= 70 ? '10' : data.scores.overall >= 50 ? '25' : '50'}%
                     </span>
                   </div>
                 </div>
               )}
            </div>
          )}
          
          {/* Bottom Footer */}
          <div className="relative z-10 mt-auto pt-6 flex flex-col items-center w-full">
             <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mb-8" />
          </div>
        </div>
      </div>

      {/* ── Scorecard Share Modal ─────────────────────────────── */}
      <AnimatePresence>
        {scorecardImage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setScorecardImage(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative z-10 w-full max-w-4xl bg-zinc-950 border border-white/10 rounded-3xl p-6 shadow-[0_0_80px_rgba(59,130,246,0.2)] flex flex-col items-center"
            >
              <button 
                onClick={() => setScorecardImage(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors z-20 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-2xl font-black text-white mb-6">Your Scorecard is Ready!</h2>
              
              <img src={scorecardImage} alt="Scorecard" className="w-full max-w-sm h-auto rounded-2xl border border-white/10 shadow-2xl mb-8 object-contain max-h-[55vh]" />
              
              <div className="flex gap-4 w-full">
                <a 
                  href={scorecardImage}
                  download="HireMind_Scorecard.png"
                  className="flex-1 py-4 flex items-center justify-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-all border border-white/5"
                >
                  <Download className="w-5 h-5" /> Download Image
                </a>
                <a 
                  href="https://www.linkedin.com/feed/?shareActive=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-4 flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] hover:bg-[#084e96] text-white font-bold transition-all shadow-[0_0_20px_rgba(10,102,194,0.3)]"
                >
                  <Share2 className="w-5 h-5" /> Post on LinkedIn
                </a>
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
