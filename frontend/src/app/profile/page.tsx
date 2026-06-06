"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit, ArrowLeft, Trophy, Flame, Star, Zap, Eye,
  MessageSquare, Code, TrendingUp, TrendingDown, Users, Target, BookOpen,
  Lock, Crown, Medal, Award, User, RefreshCw, IdCard, Download, Share2, Share, CheckCircle2, ShieldAlert, PenTool, ClipboardList
} from "lucide-react";
import Image from "next/image";
import { API_BASE_URL } from "../config";
import { toPng, toBlob } from "html-to-image";
import { useRef } from "react";
import SignatureModal from "@/components/SignatureModal";

// ── Types ────────────────────────────────────────────────────────────────────
interface GamificationData {
  user_id: number;
  total_xp: number;
  level: number;
  rank_title: string;
  badges: string[];
  streak: number;
  last_session: string | null;
  xp_into_level: number;
  xp_for_next_lvl: number;
  next_level_xp: number;
  progress_pct: number;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  user_id: number;
  total_xp: number;
  level: number;
  rank_title: string;
  badges: string[];
  streak: number;
}

// ── Constants ────────────────────────────────────────────────────────────────
const XP_LEVELS = [
  { level: 1, xp: 0, rank: "Recruit", color: "from-zinc-500 to-zinc-400", image: "/ranks/rank_1_recruit.png" },
  { level: 2, xp: 500, rank: "Applicant", color: "from-emerald-600 to-emerald-400", image: "/ranks/rank_2_applicant.png" },
  { level: 3, xp: 1500, rank: "Contender", color: "from-cyan-600 to-cyan-400", image: "/ranks/rank_3_contender.png" },
  { level: 4, xp: 3500, rank: "Specialist", color: "from-blue-600 to-blue-400", image: "/ranks/rank_4_specialist.png" },
  { level: 5, xp: 7000, rank: "Expert", color: "from-violet-600 to-violet-400", image: "/ranks/rank_5_expert.png" },
  { level: 6, xp: 12000, rank: "Senior", color: "from-purple-600 to-purple-400", image: "/ranks/rank_6_senior.png" },
  { level: 7, xp: 20000, rank: "Principal", color: "from-fuchsia-600 to-fuchsia-400", image: "/ranks/rank_7_principal.png" },
  { level: 8, xp: 32000, rank: "Director", color: "from-pink-600 to-pink-400", image: "/ranks/rank_8_director.png" },
  { level: 9, xp: 50000, rank: "VP", color: "from-rose-600 to-amber-400", image: "/ranks/rank_9_vp.png" },
  { level: 10, xp: 75000, rank: "Legend", color: "from-amber-500 to-yellow-300", image: "/ranks/rank_10_legend.png" },
];

const ALL_BADGES = [
  { id: "first_blood", name: "First Blood", icon: "Zap", description: "Completed your very first interview on HireMind.", image: "/badges/badge_first_blood.png" },
  { id: "fluent_speaker", name: "Fluent Communicator", icon: "MessageSquare", description: "< 5 filler words across the entire interview.", image: "/badges/badge_fluent_speaker.png" },
  { id: "logic_master", name: "Logic Master", icon: "Zap", description: "Structured reasoning across all problem-solving questions.", image: "/badges/badge_logic_master.png" },
  { id: "cracked_hard", name: "Cracked Hard Round", icon: "Trophy", description: "Successfully handled Hard-difficulty questions.", image: "/badges/badge_cracked_hard.png" },
  { id: "unshakable", name: "Unshakable Focus", icon: "Eye", description: "High confidence score (>85) and steady answers.", image: "/badges/badge_unshakable.png" },
  { id: "clean_coder", name: "Clean Coder", icon: "Code", description: "Precise and well-structured code explanations.", image: "/badges/badge_clean_coder.png" },
  { id: "perfectionist", name: "Perfectionist", icon: "Star", description: "Achieved an overall score above 90.", image: "/badges/badge_perfectionist.png" },
  { id: "speed_demon", name: "Speed Demon", icon: "Target", description: "Concise, sharp answers with zero rambling.", image: "/badges/speed_demon.png" },
  { id: "comeback_kid", name: "Comeback Kid", icon: "TrendingUp", description: "Recovered strongly after a weak opening answer.", image: "/badges/comeback_kid.png" },
  { id: "deep_diver", name: "Deep Diver", icon: "BookOpen", description: "Demonstrated expert depth beyond what was asked.", image: "/badges/deep_diver.png" },
  { id: "team_player", name: "Team Player", icon: "Users", description: "Highlighted strong collaboration and leadership examples.", image: "/badges/Team_player.png" },
  { id: "streak_3", name: "On Fire", icon: "Flame", description: "Completed interviews 3 days in a row.", image: "/badges/On_fire.png" },
  { id: "streak_7", name: "Week Warrior", icon: "Flame", description: "Completed interviews 7 days in a row.", image: "/badges/week_warrior.png" },
];

const ICON_MAP: Record<string, any> = {
  Zap, Eye, MessageSquare, Code, Trophy, Star, Flame,
  TrendingUp, BookOpen, Users, Target, Lock, Crown, Medal,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [gData, setGData] = useState<GamificationData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"badges" | "leaderboard" | "roadmap">("badges");
  const [showAllBadgesModal, setShowAllBadgesModal] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [showICardModal, setShowICardModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [validationData, setValidationData] = useState<any>(null);

  const handleSignatureSaved = (dataUrl: string) => {
    if (!user) return;
    const updatedUser = { ...user, signature_data: dataUrl };
    setUser(updatedUser);
    localStorage.setItem("hiremind_user", JSON.stringify(updatedUser));
  };

  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) { router.push("/login?redirect=/profile"); return; }
    const loggedUser = JSON.parse(session);
    setUser(loggedUser);

    Promise.all([
      fetch(`${API_BASE_URL}/api/gamification/${loggedUser.id}`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/leaderboard`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/user/${loggedUser.id}/performance_insights`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/user/${loggedUser.id}/stats`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/user/${loggedUser.id}/experiences`).then(r => r.json()),
    ]).then(([gam, lb, best, userStats, validData]) => {
      setGData(gam);
      setLeaderboard(lb);
      if (best && best.status === "success" && best.data) {
        setInsights(best.data);
      }
      if (userStats && userStats.status === "success" && userStats.data) {
        setStats(userStats.data);
      }
      if (validData && validData.status === "success" && validData.data) {
        setValidationData(validData.data);
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const currentTier = XP_LEVELS.find(t => t.level === (gData?.level ?? 1)) ?? XP_LEVELS[0];
  const nextTier = XP_LEVELS.find(t => t.level === (gData?.level ?? 1) + 1);
  const myRank = leaderboard.find(e => e.user_id === user?.id)?.rank ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-x-hidden">
      {/* Background ambient glows */}
      <div className="fixed top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] bg-violet-600/10 pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] bg-fuchsia-600/8 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">My Progress Profile</h1>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Verify Experiences Button */}
          {validationData?.experiences?.length > 0 && validationData.experiences.some((e: any) => e.verification_status !== "Verified") && (
            <button
              onClick={() => router.push("/validation?from=profile")}
              className="group flex items-center justify-center h-9 px-3 rounded-xl bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="overflow-hidden max-w-0 group-hover:max-w-[200px] group-hover:ml-2 whitespace-nowrap transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100">
                Verify Experiences
              </span>
            </button>
          )}

          <button
            onClick={() => router.push("/action-plan")}
            className="group flex items-center justify-center h-9 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span className="overflow-hidden max-w-0 group-hover:max-w-[200px] group-hover:ml-2 whitespace-nowrap transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100">
              Action Plan
            </span>
          </button>
          <button
            onClick={() => setShowSignatureModal(true)}
            className="group flex items-center justify-center h-9 px-3 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            <PenTool className="w-4 h-4 shrink-0" />
            <span className="overflow-hidden max-w-0 group-hover:max-w-[200px] group-hover:ml-2 whitespace-nowrap transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100">
              Draw Signature
            </span>
          </button>
          <button
            onClick={() => setShowICardModal(true)}
            className="group flex items-center justify-center h-9 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all cursor-pointer"
          >
            <IdCard className="w-4 h-4 shrink-0" />
            <span className="overflow-hidden max-w-0 group-hover:max-w-[200px] group-hover:ml-2 whitespace-nowrap transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100">
              I-Card
            </span>
          </button>
        </div>
      </header>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSaved={handleSignatureSaved}
        userId={user?.id}
      />

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-10 space-y-8">

        {/* Hero Card — Level + XP */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden border border-white/10 bg-zinc-900/60 p-8"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${currentTier.color} opacity-5 pointer-events-none`} />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />

          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Level orb */}
            <div className="relative shrink-0">
              <div className={`relative w-32 h-32 rounded-full flex items-center justify-center bg-gradient-to-br ${currentTier.color} p-1`}>
                <div className="w-full h-full rounded-full bg-zinc-950 overflow-hidden relative">
                  <Image src={currentTier.image} alt={currentTier.rank} fill className="object-cover" />
                </div>
              </div>
              {gData && gData.streak > 1 && (
                <div className="absolute -bottom-2 -right-2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500 text-white text-[10px] font-extrabold shadow-lg">
                  <Flame className="w-3 h-3" /> {gData.streak}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                {myRank && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                    #{myRank} Global
                  </span>
                )}
              </div>
              <h2 className="text-4xl font-extrabold text-white">{gData?.rank_title ?? "Recruit"}</h2>
              {gData?.streak && gData.streak > 1 ? (
                <p className="text-orange-400 font-medium text-sm mt-1">
                  🔥 {gData.streak}-Day Streak
                </p>
              ) : null}

              {/* XP Progress bar */}
              <div className="mt-6 max-w-md mx-auto md:mx-0">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Progress</span>
                    <span className="text-sm font-bold text-white">{gData?.xp_into_level?.toLocaleString() ?? 0} <span className="text-zinc-500 font-normal">XP</span></span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">{nextTier ? nextTier.rank : "Max Level"}</span>
                    <span className="text-sm font-bold text-white">{nextTier ? nextTier.xp.toLocaleString() : "---"} <span className="text-zinc-500 font-normal">XP</span></span>
                  </div>
                </div>
                <div className="relative w-full h-3 bg-zinc-950 rounded-full border border-white/10 overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: `${gData?.progress_pct ?? 0}%` }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                    className={`relative h-full rounded-full bg-gradient-to-r ${currentTier.color}`}
                  >
                    {/* Inner highlight */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent" />
                    {/* Glowing head */}
                    <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-white/50 to-transparent" />
                  </motion.div>
                </div>
                <div className="mt-3 text-center">
                  <span className="inline-block px-3 py-1 rounded-full bg-zinc-900 border border-white/5 text-[10px] text-zinc-400 font-bold tracking-wider">
                    {gData?.progress_pct ?? 0}% to Level {(gData?.level ?? 1) + 1}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex md:flex-col gap-4 shrink-0">
              <div className="flex flex-col items-center p-4 rounded-2xl bg-zinc-950/60 border border-white/5 min-w-[80px]">
                <span className="text-2xl font-extrabold text-violet-400">{gData?.total_xp?.toLocaleString() ?? 0}</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">Total XP</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-2xl bg-zinc-950/60 border border-white/5 min-w-[80px]">
                <span className="text-2xl font-extrabold text-white">{gData?.badges?.length ?? 0}</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">Badges</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-2xl bg-zinc-950/60 border border-white/5 min-w-[80px]">
                <span className="text-2xl font-extrabold text-orange-400">{gData?.streak ?? 0}🔥</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">Streak</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Performance Insights Card */}
        {/* Performance Insights Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={() => setShowInsightsModal(true)}
          className="rounded-3xl border border-blue-500/30 bg-gradient-to-r from-zinc-900/80 via-blue-950/20 to-zinc-900/80 backdrop-blur-xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.1)] cursor-pointer group hover:border-blue-400/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent group-hover:via-blue-400 transition-all duration-700" />

          {/* Weakest Link */}
          <div className="flex-1 flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              {insights && insights.total_interviews >= 1 ? <TrendingDown className="w-6 h-6" /> : <Lock className="w-5 h-5 opacity-50" />}
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Weakest Link</p>
              {insights && insights.total_interviews >= 1 ? (
                <>
                  <p className="text-white font-semibold text-sm">{(insights.weakest_link?.category ?? "").replace("_", " ")}</p>
                  <p className="text-zinc-400 text-xs">{insights.weakest_link?.average ?? 0} Avg Score</p>
                </>
              ) : (
                <p className="text-zinc-500 text-xs mt-1 font-medium">Complete an interview</p>
              )}
            </div>
          </div>

          {/* Growth */}
          <div className="flex-1 flex items-center gap-4 md:border-l md:border-white/5 md:pl-6">
            <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              {insights && insights.total_interviews >= 2 ? <TrendingUp className="w-6 h-6" /> : <Lock className="w-5 h-5 opacity-50" />}
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Growth Trajectory</p>
              {insights && insights.total_interviews >= 2 ? (
                <>
                  <p className="text-white font-semibold text-sm">{insights.growth?.value > 0 ? '+' : ''}{insights.growth?.value}% {(insights.growth?.category ?? "").replace("_", " ")}</p>
                  <p className="text-zinc-400 text-xs">First vs Recent</p>
                </>
              ) : (
                <p className="text-zinc-500 text-xs mt-1 font-medium">Requires 2+ interviews</p>
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="shrink-0 flex flex-col items-end md:border-l md:border-white/5 md:pl-6 pt-4 md:pt-0 border-t border-white/5 md:border-t-0 mt-4 md:mt-0">
            <span className="text-blue-400 font-bold text-sm">Compare Best vs Worst</span>
            <span className="text-zinc-500 text-[10px] uppercase tracking-wider mt-1 group-hover:text-zinc-300 transition-colors">View Full Insights &rarr;</span>
          </div>
        </motion.div>

        {/* Level Roadmap Strip */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 backdrop-blur-xl p-8 relative overflow-hidden shadow-2xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent pointer-events-none" />
          <h3 className="relative z-10 text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 to-zinc-600 uppercase tracking-widest mb-8">Rank Progression Roadmap</h3>
          <div className="flex items-center gap-0 overflow-x-auto py-6 px-4 -mx-4 -my-4">
            {XP_LEVELS.map((tier, i) => {
              const unlocked = (gData?.level ?? 1) >= tier.level;
              const isCurrent = (gData?.level ?? 1) === tier.level;
              return (
                <div key={tier.level} className="flex items-center shrink-0">
                  <div className={`flex flex-col items-center gap-1.5 ${isCurrent ? "scale-110" : ""} transition-transform`}>
                    <div className={`relative w-[56px] h-[56px] min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center text-sm font-extrabold border-2 transition-all overflow-hidden shrink-0 aspect-square shadow-lg ${isCurrent
                      ? `border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.2)] ring-4 ring-white/10`
                      : unlocked
                        ? `border-white/20 opacity-90 hover:border-white/40`
                        : "border-white/5 opacity-50 grayscale hover:opacity-70"
                      }`}>
                      <div className="absolute inset-0 bg-zinc-950 z-0" />
                      <Image
                        src={tier.image}
                        alt={tier.rank}
                        fill
                        className={`object-cover z-10 transition-transform duration-500 ${isCurrent ? 'scale-110' : ''} ${!unlocked ? 'opacity-30' : ''}`}
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/40 backdrop-blur-[2px]">
                          <Lock className="w-5 h-5 text-zinc-400 drop-shadow-md" />
                        </div>
                      )}
                    </div>
                    <span className={`text-[8px] font-bold uppercase tracking-wider ${isCurrent ? "text-white" : unlocked ? "text-zinc-400" : "text-zinc-700"}`}>
                      {tier.rank}
                    </span>
                    <span className="text-[7px] text-zinc-600">{tier.xp >= 1000 ? `${tier.xp / 1000}k` : tier.xp} XP</span>
                  </div>
                  {i < XP_LEVELS.length - 1 && (
                    <div className={`w-6 md:w-10 h-0.5 mx-1 rounded-full ${unlocked && (gData?.level ?? 1) > tier.level ? `bg-gradient-to-r ${tier.color}` : "bg-zinc-800"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex bg-zinc-900/60 p-1.5 rounded-2xl border border-white/5">
          {[
            { id: "badges", label: "My Badges", icon: Award },
            { id: "leaderboard", label: "Leaderboard", icon: Crown },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${isActive ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-violet-400" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* My Badges Tab */}
        <AnimatePresence mode="wait">
          {activeTab === "badges" && (
            <motion.div
              key="badges"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-8"
            >
              {(() => {
                const earnedBadges = ALL_BADGES.filter(badge => (gData?.badges ?? []).includes(badge.id));

                if (earnedBadges.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-zinc-950/40 rounded-3xl border border-white/5 shadow-inner">
                      <Lock className="w-12 h-12 text-zinc-700 mb-5 opacity-50" />
                      <h3 className="text-xl font-black text-zinc-500 uppercase tracking-widest drop-shadow-sm">Way More To Go!!</h3>
                      <p className="text-xs text-zinc-600 mt-2.5 font-medium">Complete interviews to earn your first badge.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                    {earnedBadges.map((badge, i) => {
                      const Ic = ICON_MAP[badge.icon] || Trophy;
                      return (
                        <motion.div
                          key={badge.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="group relative flex flex-col items-center text-center p-6 rounded-3xl border bg-gradient-to-br from-violet-900/40 to-zinc-900/80 border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:border-violet-400/50 hover:scale-[1.02] transition-all duration-300"
                        >
                          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center mb-5 transition-transform duration-500 overflow-hidden bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-2 border-violet-500/50 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.5)] group-hover:scale-110 group-hover:rotate-6">
                            {(badge as any).image ? (
                              <Image src={(badge as any).image} alt={badge.name} fill className="object-cover" />
                            ) : (
                              <Ic className="w-10 h-10 drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                            )}
                          </div>
                          <h4 className="text-[13px] font-black tracking-wide mb-2 text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300 drop-shadow-md">
                            {badge.name}
                          </h4>
                          <p className="text-[11px] leading-relaxed text-violet-200/70 font-medium">
                            {badge.description}
                          </p>
                          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,1)]" />
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Separator and All Badges Button */}
              <div className="flex flex-col items-center justify-center pt-6 pb-2 relative">
                <div className="absolute inset-0 flex items-center justify-center px-12">
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
                <button
                  onClick={() => setShowAllBadgesModal(true)}
                  className="relative px-6 py-2 rounded-full bg-zinc-950 border border-white/10 text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest hover:text-white hover:border-white/20 hover:bg-zinc-900 transition-all shadow-xl"
                >
                  All Badges
                </button>
              </div>
            </motion.div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === "leaderboard" && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-white/5 bg-zinc-900/40 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Global XP Leaderboard</h3>
                <span className="text-[10px] text-zinc-500">Top 10 candidates by total XP</span>
              </div>
              {leaderboard.length === 0 ? (
                <div className="p-12 text-center text-zinc-600 text-sm">No candidates on the leaderboard yet.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {leaderboard.map((entry, i) => {
                    const isMe = entry.user_id === user?.id;
                    const tierColor = XP_LEVELS.find(t => t.level === entry.level)?.color ?? "from-zinc-500 to-zinc-400";
                    const RankIcon = i === 0 ? Crown : i === 1 ? Medal : i === 2 ? Award : null;
                    return (
                      <motion.div
                        key={entry.user_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex items-center gap-4 px-6 py-4 transition-colors ${isMe ? "bg-violet-500/5 border-l-2 border-violet-500" : "hover:bg-zinc-900/40"}`}
                      >
                        {/* Rank number */}
                        <div className="w-8 text-center shrink-0">
                          {RankIcon ? (
                            <RankIcon className={`w-5 h-5 mx-auto ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : "text-amber-600"}`} />
                          ) : (
                            <span className="text-sm font-extrabold text-zinc-600">#{entry.rank}</span>
                          )}
                        </div>

                        {/* Level orb */}
                        <div className={`relative w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${tierColor} shrink-0 p-[2px] shadow-sm`}>
                          <div className="w-full h-full rounded-full bg-zinc-950 overflow-hidden relative">
                            {XP_LEVELS.find(t => t.level === entry.level)?.image && (
                              <Image src={XP_LEVELS.find(t => t.level === entry.level)!.image} alt={entry.rank_title} fill className="object-cover" />
                            )}
                          </div>
                        </div>

                        {/* Name + rank */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold truncate ${isMe ? "text-violet-300" : "text-white"}`}>
                              {entry.username} {isMe && <span className="text-[9px] text-violet-400">(you)</span>}
                            </span>
                            {entry.streak > 1 && (
                              <span className="text-[10px] text-orange-400 font-bold shrink-0">🔥{entry.streak}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500">{entry.rank_title}</span>
                        </div>

                        {/* Badges preview */}
                        <div className="hidden sm:flex items-center gap-1 shrink-0">
                          {entry.badges.slice(0, 3).map(bid => {
                            const b = ALL_BADGES.find(x => x.id === bid);
                            if (!b) return null;
                            const Ic = ICON_MAP[b.icon] || Zap;
                            return (
                              <div key={bid} title={b.name} className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                                <Ic className="w-3 h-3" />
                              </div>
                            );
                          })}
                        </div>

                        {/* XP */}
                        <div className="text-right shrink-0">
                          <div className="text-sm font-extrabold text-white">{entry.total_xp.toLocaleString()}</div>
                          <div className="text-[9px] text-zinc-600 uppercase">XP</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* All Badges Modal */}
      <AnimatePresence>
        {showAllBadgesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllBadgesModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-[900px] bg-zinc-950 border border-white/10 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden z-10 max-h-[90vh] flex flex-col"
            >
              {/* Badge Vault Aesthetic Background */}
              <div className="absolute inset-0 pointer-events-none bg-[url('/vault-bg.jpg')] bg-cover bg-center opacity-20 mix-blend-lighten" />
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-zinc-950/80 to-zinc-950/90" />

              <div className="relative z-10 p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-sm sticky top-0">
                <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Award className="w-5 h-5 text-violet-400" />
                  All Badges
                </h3>
                <button
                  onClick={() => setShowAllBadgesModal(false)}
                  className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <Lock className="w-4 h-4 hidden" /> {/* Just utilizing icon for size hack if needed */}
                  <span className="text-lg leading-none mb-0.5">&times;</span>
                </button>
              </div>

              <div className="relative z-10 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8 gap-y-12">
                {ALL_BADGES.map((badge, i) => {
                  const actuallyEarned = (gData?.badges ?? []).includes(badge.id);
                  const Ic = ICON_MAP[badge.icon] || Trophy;

                  // In the All Badges modal, we want to show off the artwork, so we force the 'unlocked' visual state
                  // but we can maybe add a subtle indicator if they don't actually own it, or just let it be fully colorful.
                  // For the bottom row of badges, make the tooltip pop upwards so it doesn't get cut off
                  const isBottom = i >= ALL_BADGES.length - 4;

                  return (
                    <div key={badge.id} className="relative group flex flex-col items-center">
                      <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center transition-all duration-500 overflow-hidden cursor-help bg-zinc-900 shadow-[inset_0_2px_10px_rgba(255,255,255,0.1),_0_10px_25px_rgba(0,0,0,0.5)] ring-1 ring-white/10 group-hover:ring-white/30 group-hover:scale-[1.05] group-hover:shadow-[inset_0_4px_15px_rgba(255,255,255,0.2),_0_15px_40px_rgba(0,0,0,0.8)]">
                        {(badge as any).image ? (
                          <Image src={(badge as any).image} alt={badge.name} fill className="object-cover" />
                        ) : (
                          <Ic className="w-8 h-8 text-violet-300" />
                        )}
                      </div>

                      {/* Custom Tooltip */}
                      <div className={`absolute left-1/2 -translate-x-1/2 w-48 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 transform ${isBottom
                        ? "bottom-[110%] translate-y-[10px] group-hover:translate-y-0"
                        : "top-[110%] translate-y-[-10px] group-hover:translate-y-0"
                        }`}>
                        <div className="bg-zinc-900 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-xl relative flex flex-col items-center text-center">
                          <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 border-white/10 rotate-45 ${isBottom ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-t border-l"
                            }`} />
                          <span className="text-[11px] font-black uppercase tracking-wider mb-1 text-violet-400">
                            {badge.name}
                          </span>
                          <span className="text-[10px] text-zinc-400 leading-tight">
                            {badge.description}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
        {/* Insights Modal */}
        {showInsightsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInsightsModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-zinc-950 border border-blue-500/20 rounded-[2rem] shadow-[0_0_50px_rgba(59,130,246,0.15)] overflow-hidden z-10 max-h-[90vh] flex flex-col"
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-zinc-950/80 to-zinc-950/90" />

              <div className="relative z-10 p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-sm sticky top-0">
                <h3 className="text-lg font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Performance Insights
                </h3>
                <button
                  onClick={() => setShowInsightsModal(false)}
                  className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <span className="text-lg leading-none mb-0.5">&times;</span>
                </button>
              </div>

              <div className="relative z-10 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-8">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* BEST INTERVIEW */}
                  <div className="space-y-6">
                    <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest border-b border-emerald-500/20 pb-3 flex items-center gap-2">
                      <Trophy className="w-4 h-4" /> Best Performance
                    </h4>

                    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6 text-center">
                      <span className="block text-4xl font-black text-emerald-400">{insights?.best_interview?.overall ?? 0}/100</span>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 block">Overall Score</span>
                      <p className="text-xs text-zinc-500 mt-3">{insights?.best_interview?.mode ?? "Unknown"} Mode</p>
                    </div>

                    <div className="space-y-3">
                      {[
                        { key: "technical", label: "Technical Mastery" },
                        { key: "communication", label: "Communication" },
                        { key: "problem_solving", label: "Problem Solving" },
                        { key: "confidence", label: "Confidence" },
                      ].map(dim => {
                        const val = insights?.best_interview?.evaluation_data?.scores?.[dim.key] ?? 0;
                        return (
                          <div key={dim.key} className="bg-zinc-900/40 p-3 rounded-xl border border-white/5 space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="uppercase tracking-wider text-zinc-400">{dim.label}</span>
                              <span className="text-emerald-400">{val}/100</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden bg-zinc-800">
                              <div className="h-full bg-emerald-500" style={{ width: `${val}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* WORST INTERVIEW */}
                  <div className="space-y-6 opacity-70 hover:opacity-100 transition-opacity">
                    <h4 className="text-sm font-black text-red-400 uppercase tracking-widest border-b border-red-500/20 pb-3 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" /> Worst Performance
                    </h4>

                    <div className="bg-red-950/20 border border-red-500/20 rounded-2xl p-6 text-center">
                      <span className="block text-4xl font-black text-red-400">{insights?.worst_interview?.overall ?? 0}/100</span>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 block">Overall Score</span>
                      <p className="text-xs text-zinc-500 mt-3">{insights?.worst_interview?.mode ?? "Unknown"} Mode</p>
                    </div>

                    <div className="space-y-3">
                      {[
                        { key: "technical", label: "Technical Mastery" },
                        { key: "communication", label: "Communication" },
                        { key: "problem_solving", label: "Problem Solving" },
                        { key: "confidence", label: "Confidence" },
                      ].map(dim => {
                        const val = insights?.worst_interview?.evaluation_data?.scores?.[dim.key] ?? 0;
                        return (
                          <div key={dim.key} className="bg-zinc-900/40 p-3 rounded-xl border border-white/5 space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="uppercase tracking-wider text-zinc-400">{dim.label}</span>
                              <span className="text-red-400">{val}/100</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden bg-zinc-800">
                              <div className="h-full bg-red-500" style={{ width: `${val}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3D Holographic I-Card Modal */}
      <AnimatePresence>
        {showICardModal && (
          <HolographicICard
            user={user}
            gData={gData}
            stats={stats}
            bestInterview={insights?.best_interview}
            validationData={validationData}
            onClose={() => setShowICardModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Holographic I-Card Component ────────────────────────────────────────────────
const HolographicICard = ({ user, gData, stats, bestInterview, validationData, onClose }: any) => {
  const cardRef = useRef<HTMLDivElement>(null);

  let verificationText = "© Authorized by HireMind Team";
  let verificationColor = "text-zinc-400/80";
  let badgeTop = "Authorized";
  let badgeBottom = "Personnel";
  let badgeColor = "from-zinc-300 to-zinc-500";

  if (validationData?.is_fraudulent) {
    verificationText = "⚠️ [FRAUDULENT] Verification Failed";
    verificationColor = "text-red-500 font-bold drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]";
    badgeTop = "Fraudulent";
    badgeBottom = "Identity";
    badgeColor = "from-red-400 to-red-600";
  } else if (validationData?.experiences?.length > 0) {
    const allVerified = validationData.experiences.every((e: any) => e.verification_status === "Verified");
    if (allVerified) {
      verificationText = "© Verified by HireMind Team";
      verificationColor = "text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]";
      badgeTop = "Verified";
      badgeBottom = "Credential";
      badgeColor = "from-cyan-300 to-blue-500";
    } else {
      verificationText = "⏳ Verification in Pending";
      verificationColor = "text-yellow-500 font-bold drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]";
      badgeTop = "Pending";
      badgeBottom = "Verification";
      badgeColor = "from-yellow-400 to-orange-500";
    }
  }

  const getTechSavvyTitle = () => {
    if (!bestInterview) return "Digital Recruit";
    const scores = bestInterview.evaluation_data?.scores;
    if (!scores) return "Digital Recruit";

    const s = [
      { key: "technical", name: "System Design Titan", val: scores.technical },
      { key: "communication", name: "Fluent Orator", val: scores.communication },
      { key: "problem_solving", name: "Algorithm Architect", val: scores.problem_solving },
      { key: "confidence", name: "Unshakable Professional", val: scores.confidence },
    ];
    s.sort((a, b) => b.val - a.val);

    if (s[0].val >= 85) return s[0].name;
    const lvl = gData?.level ?? 1;
    if (lvl >= 7) return "Data Prodigy";
    if (lvl >= 4) return "Code Ninja";
    return "Tech Enthusiast";
  };

  const captureCard = async (): Promise<File | null> => {
    if (!cardRef.current) return null;
    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 3,
        style: { transform: 'none', boxShadow: 'none' }
      });
      if (!blob) return null;
      return new File([blob], "HireMind_ICard.png", { type: "image/png" });
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        style: { transform: 'none', boxShadow: 'none' }
      });
      const link = document.createElement('a');
      link.download = 'HireMind_ICard.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const shareToApp = async (platform: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const file = await captureCard();
    if (!file) return;

    const shareData = {
      title: "My HireMind I-Card",
      text: "🚀 Just crushed an AI interview on HireMind! Check out my official candidate card. Think you can beat my score? 🔥 #HireMind #AIInterview",
      files: [file],
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        alert(`Your browser doesn't support direct image sharing. The image has been downloaded instead so you can post it to ${platform}!`);
        const link = document.createElement('a');
        link.download = 'HireMind_ICard.png';
        link.href = URL.createObjectURL(file);
        link.click();
      }
    } catch (err) {
      console.log("Error sharing:", err);
    }
  };

  const title = getTechSavvyTitle();

  const generateUniqueName = () => {
    const interviews = stats?.total_interviews || 0;
    const badges = gData?.badges?.length || 0;
    const level = gData?.level || 1;
    const score = bestInterview?.overall || stats?.highest_score || 0;
    const initial = (user?.username || "A").charCodeAt(0);
    // Use the unique database ID as the ultimate tie-breaker
    const uid = gData?.user_id || user?.id || 1;

    // Determine the user's skill tier so beginners don't get legendary titles
    let tier = 0;
    if (score >= 80 || level >= 7) tier = 3;
    else if (score >= 50 || level >= 4) tier = 2;
    else if (score >= 20 || level >= 2) tier = 1;

    const prefixTiers = [
      ["The Aspiring", "The Novice", "The Unknown", "The Curious"],
      ["The Steadfast", "The Rising", "The Capable", "The Driven"],
      ["The Fearless", "The Relentless", "The Ascendant", "The Bold"],
      ["The Legendary", "The Unstoppable", "The Visionary", "The Enigmatic"]
    ];

    const coreTiers = [
      ["Recruit", "Trainee", "Initiate", "Apprentice"],
      ["Coder", "Developer", "Explorer", "Hacker"],
      ["Architect", "Ninja", "Virtuoso", "Strategist"],
      ["Titan", "Oracle", "Vanguard", "Mastermind"]
    ];

    const suffixes = ["of Logic", "of Algorithms", "of Systems", "of the Console", "of the Cloud", "of Code"];

    const prefixes = prefixTiers[tier];
    const cores = coreTiers[tier];

    // Incorporate the UID into the math so even if two users have identical stats and identical names, 
    // their unique database ID ensures they get a completely different combination!
    const prefixIndex = (interviews + level + uid) % prefixes.length;
    const coreIndex = (score + initial + (uid * 2)) % cores.length;
    const suffixIndex = (badges + level + (uid * 3)) % suffixes.length;

    return `${prefixes[prefixIndex]} ${cores[coreIndex]} ${suffixes[suffixIndex]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
      />

      {/* 3D Container for the Card */}
      <div className="relative z-10 perspective-[1000px] mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.8, rotateY: 90 }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative w-full max-w-[340px] aspect-[1/1.45] flex items-center justify-center"
        >
          {/* We attach the ref to this inner div so html2canvas renders a flat, unrotated version by temporarily ignoring transforms, or we can just capture it as is (html2canvas ignores 3D transforms mostly, which is good for 2D capture). */}
          <motion.div
            ref={cardRef}
            style={{ transformStyle: "preserve-3d" }}
            className="w-full h-full relative rounded-[1rem] bg-yellow-400 p-[12px] shadow-[0_0_50px_rgba(250,204,21,0.4)] flex flex-col"
          >
            {/* Glossy shine effect removed */}

            {/* Inner Obsidian Premium Background */}
            <div className="relative flex-1 w-full rounded-md bg-gradient-to-br from-slate-900 via-zinc-950 to-black shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] border border-white/10 flex flex-col p-1.5 overflow-hidden">


              {/* Stage Badge (Top Left Overlapping) */}
              <div className="absolute -top-3 -left-3 bg-gradient-to-br from-yellow-200 to-yellow-600 border border-yellow-700 shadow-md p-1 z-20 flex flex-col items-center justify-center transform -rotate-6" style={{ width: "55px", height: "55px", clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}>
                <span className="text-[7px] font-black uppercase text-black leading-none mt-1">Level</span>
                <span className="text-xl font-black text-black leading-none">{gData?.level || 1}</span>
              </div>

              {/* Header Bar */}
              <div className="flex justify-between items-start mb-1 pl-12 pr-1 relative z-10 pt-1">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] mb-0.5">
                    {gData?.rank_title || "Recruit"}
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-widest uppercase leading-none drop-shadow-md">
                    {user?.username}
                  </h2>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-full pl-3 pr-1.5 py-1 backdrop-blur-md shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)]">
                    <span className="text-xl font-black text-amber-400 drop-shadow-md leading-none tracking-tight whitespace-nowrap">{gData?.total_xp?.toLocaleString() || 0} XP</span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-600 border border-yellow-400 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                      <Flame className="w-3.5 h-3.5 text-yellow-200 fill-yellow-200" />
                    </div>
                  </div>
                  {/* Progress Bar Sub-section */}
                  {(() => {
                    const currentXP = gData?.total_xp || 0;
                    const cTier = XP_LEVELS.find(t => t.level === (gData?.level ?? 1)) ?? XP_LEVELS[0];
                    const nTier = XP_LEVELS.find(t => t.level === ((gData?.level ?? 1) + 1));
                    const baseXP = cTier.xp;
                    const targetXP = nTier ? nTier.xp : baseXP;
                    const progress = targetXP > baseXP ? Math.min(100, Math.max(0, ((currentXP - baseXP) / (targetXP - baseXP)) * 100)) : 100;

                    return (
                      <div className="w-[90%] flex flex-col gap-0.5 mt-1 opacity-90">
                        <div className="h-1.5 w-full bg-zinc-900/80 rounded-full overflow-hidden border border-white/5 shadow-inner">
                          <div className="h-full bg-gradient-to-r from-amber-600 to-yellow-300 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between w-full px-0.5">
                          <span className="text-[6px] font-black text-zinc-400 font-mono tracking-widest">{currentXP}</span>
                          <span className="text-[6px] font-black text-zinc-600 font-mono tracking-widest">{targetXP > baseXP ? targetXP : 'MAX'}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Main Image Frame (Gold Beveled) */}
              <div className="relative w-full h-[105px] bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 p-[3px] shadow-[2px_2px_5px_rgba(0,0,0,0.5)] z-10 mb-1">
                <div className="w-full h-full relative overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.9)] bg-zinc-950 flex items-center justify-center">
                  {/* Premium Tech Grid */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px]" />
                  {/* Soft central spotlight */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.07)_0%,_transparent_60%)]" />

                  {/* Profile / Rank Art */}
                  {/* Profile / Rank Art */}
                  {(() => {
                    const seed = encodeURIComponent(generateUniqueName());
                    const avatarUrl = `https://robohash.org/${seed}.png?set=set1&size=400x400`;

                    return (
                      <div className="relative z-10 w-full h-full scale-[1.25] -translate-y-2 hover:scale-[1.30] transition-transform duration-500 flex items-center justify-center">
                        {/* Subtle glowing halo behind the robot */}
                        <div className="absolute inset-0 bg-fuchsia-500/20 blur-[20px] rounded-full mix-blend-screen scale-75" />
                        <div className="absolute inset-0 bg-cyan-400/20 blur-[15px] rounded-full mix-blend-screen scale-50" />

                        {/* The highly-detailed 3D Robohash robot with ambient shadows */}
                        <div className="relative w-full h-full" style={{ filter: "drop-shadow(0 20px 25px rgba(0,0,0,0.9)) drop-shadow(0 0 15px rgba(192,132,252,0.4)) saturate(1.15) contrast(1.1)" }}>
                          <img src={avatarUrl} alt="Unique 3D Avatar" crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl" />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Middle Gold Ribbon */}
              <div className="w-[104%] -ml-[2%] bg-gradient-to-r from-yellow-600 via-yellow-300 to-yellow-600 border border-yellow-700 py-1 flex items-center justify-center shadow-sm z-10">
                <span className="text-[12px] font-black tracking-[0.5em] uppercase text-black/80 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] ml-[0.5em]" style={{ fontFamily: "impact, sans-serif" }}>
                  I-CARD
                </span>
              </div>

              {/* Abilities & Attacks Section (Redesigned) */}
              <div className="flex-1 flex flex-col px-1 z-10 justify-center">

                <div className="text-center max-w-[85%] mx-auto mt-2.5">
                  <h3 className="text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-cyan-400 uppercase tracking-wider leading-tight text-balance drop-shadow-sm" style={{ fontFamily: "impact, sans-serif" }}>
                    {generateUniqueName()}
                  </h3>
                </div>

                {/* Thin Line */}
                <div className="w-full h-[1px] bg-white/15 mt-4 mb-2" />

                {/* Stats row */}
                <div className="flex justify-between items-center px-4 mb-1 mt-1">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">Interviews</span>
                    <span className="text-xl font-black text-white leading-none drop-shadow-md">{stats?.total_interviews || 0}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">Badges</span>
                    <span className="text-xl font-black text-white leading-none drop-shadow-md">{gData?.badges?.length || 0}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">Best Score</span>
                    <span className="text-xl font-black text-white leading-none drop-shadow-md">{bestInterview?.overall || stats?.highest_score || 0}</span>
                  </div>
                </div>

                {/* Real Scannable QR Code */}
                {(() => {
                  const uidString = `UID-${(user?.id || 1000).toString().padStart(4, '0')}-HM-${(gData?.level || 1).toString().padStart(2, '0')}`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(uidString)}`;
                  return (
                    <div className="flex items-center justify-between mt-4 mb-2 w-full px-6">
                      <div className="flex flex-col items-start justify-center">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_5px_rgba(34,211,238,0.8)] animate-pulse" />
                          <span className="text-[5px] text-zinc-500 uppercase tracking-[0.4em] font-bold">Secure Access</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-[2px] bg-gradient-to-b from-cyan-400 to-blue-600 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 font-black tracking-[0.2em] uppercase leading-none drop-shadow-sm">
                              {badgeTop}
                            </span>
                            <span className={`text-[10px] text-transparent bg-clip-text bg-gradient-to-r ${badgeColor} font-black tracking-[0.2em] uppercase leading-none mt-1 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]`}>
                              {badgeBottom}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="h-[54px] w-[54px] -translate-y-2 flex items-center justify-center mix-blend-screen opacity-90 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" style={{ filter: "invert(1)" }}>
                        <img src={qrUrl} alt="Scannable QR Code" crossOrigin="anonymous" className="h-full w-full object-contain" />
                      </div>
                    </div>
                  );
                })()}

                {/* Unique Signature Box */}
                <div className="mt-auto mb-1 flex flex-col items-center justify-center">
                  {user?.signature_data ? (
                    <img src={user.signature_data} alt="Signature" className="h-7 object-contain transform scale-x-125" style={{ filter: "invert(1)" }} />
                  ) : (
                    <div className="text-2xl text-white font-black leading-none -rotate-3 drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'Brush Script MT', cursive, serif" }}>
                      {user?.username}
                    </div>
                  )}
                  <div className={`text-[6px] uppercase tracking-widest font-bold font-mono mt-1 ${verificationColor}`}>
                    {verificationText}
                  </div>
                </div>

              </div>

              {/* Removed Footer and Copyright */}

            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Social Actions Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.2 }}
        className="relative z-20 flex flex-col items-center space-y-4"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-cyan-500/50" />
            <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-[0.3em] drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
              Share Your Story
            </span>
            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-cyan-500/50" />
          </div>

          <div className="flex items-center gap-3 bg-zinc-950/80 backdrop-blur-xl p-2.5 rounded-2xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            {/* WhatsApp / Message */}
            <button
              onClick={(e) => shareToApp("WhatsApp", e)}
              className="w-11 h-11 rounded-xl bg-black/60 border border-white/5 hover:border-yellow-400/50 hover:bg-yellow-500/10 text-zinc-400 hover:text-yellow-400 flex items-center justify-center transition-all duration-300 group hover:shadow-[0_0_15px_rgba(250,204,21,0.2)]"
              title="Share to WhatsApp"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 group-hover:scale-110 transition-transform">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
              </svg>
            </button>

            {/* Instagram */}
            <button
              onClick={(e) => shareToApp("Instagram", e)}
              className="w-11 h-11 rounded-xl bg-black/60 border border-white/5 hover:border-yellow-400/50 hover:bg-yellow-500/10 text-zinc-400 hover:text-yellow-400 flex items-center justify-center transition-all duration-300 group hover:shadow-[0_0_15px_rgba(250,204,21,0.2)]"
              title="Share to Instagram"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 group-hover:scale-110 transition-transform">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </button>

            {/* Facebook */}
            <button
              onClick={(e) => shareToApp("Facebook", e)}
              className="w-11 h-11 rounded-xl bg-black/60 border border-white/5 hover:border-yellow-400/50 hover:bg-yellow-500/10 text-zinc-400 hover:text-yellow-400 flex items-center justify-center transition-all duration-300 group hover:shadow-[0_0_15px_rgba(250,204,21,0.2)]"
              title="Share to Facebook"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 group-hover:scale-110 transition-transform">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </button>

            <div className="w-px h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent mx-2" />

            {/* Download */}
            <button
              onClick={handleDownload}
              className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-300 to-blue-600 text-zinc-950 flex items-center justify-center transition-all duration-300 group hover:scale-105 border border-cyan-200 overflow-hidden"
              title="Download Image"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <Download className="w-5 h-5 relative z-10 font-bold group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Close Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-zinc-500 text-[10px] uppercase tracking-widest font-bold pointer-events-none">
        Click background to close
      </div>
    </div>
  );
};
