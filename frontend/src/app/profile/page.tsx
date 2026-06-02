"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit, ArrowLeft, Trophy, Flame, Star, Zap, Eye,
  MessageSquare, Code, TrendingUp, Users, Target, BookOpen,
  Lock, Crown, Medal, Award, User, RefreshCw, IdCard, Download, Share2, Share, CheckCircle2
} from "lucide-react";
import Image from "next/image";
import { API_BASE_URL } from "../config";
import html2canvas from "html2canvas";
import { useRef } from "react";

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
  { level: 1,  xp: 0,      rank: "Recruit",   color: "from-zinc-500 to-zinc-400",       image: "/ranks/rank_1_recruit.png" },
  { level: 2,  xp: 500,    rank: "Applicant",  color: "from-emerald-600 to-emerald-400", image: "/ranks/rank_2_applicant.png" },
  { level: 3,  xp: 1500,   rank: "Contender",  color: "from-cyan-600 to-cyan-400",       image: "/ranks/rank_3_contender.png" },
  { level: 4,  xp: 3500,   rank: "Specialist", color: "from-blue-600 to-blue-400",       image: "/ranks/rank_4_specialist.png" },
  { level: 5,  xp: 7000,   rank: "Expert",     color: "from-violet-600 to-violet-400",   image: "/ranks/rank_5_expert.png" },
  { level: 6,  xp: 12000,  rank: "Senior",     color: "from-purple-600 to-purple-400",   image: "/ranks/rank_6_senior.png" },
  { level: 7,  xp: 20000,  rank: "Principal",  color: "from-fuchsia-600 to-fuchsia-400", image: "/ranks/rank_7_principal.png" },
  { level: 8,  xp: 32000,  rank: "Director",   color: "from-pink-600 to-pink-400",       image: "/ranks/rank_8_director.png" },
  { level: 9,  xp: 50000,  rank: "VP",         color: "from-rose-600 to-amber-400",      image: "/ranks/rank_9_vp.png" },
  { level: 10, xp: 75000,  rank: "Legend",     color: "from-amber-500 to-yellow-300",    image: "/ranks/rank_10_legend.png" },
];

const ALL_BADGES = [
  { id: "first_blood",   name: "First Blood",        icon: "Zap",         description: "Completed your very first interview on HireMind.", image: "/badges/badge_first_blood.png" },
  { id: "fluent_speaker",name: "Fluent Communicator",icon: "MessageSquare",description: "< 5 filler words across the entire interview.", image: "/badges/badge_fluent_speaker.png" },
  { id: "logic_master",  name: "Logic Master",       icon: "Zap",         description: "Structured reasoning across all problem-solving questions.", image: "/badges/badge_logic_master.png" },
  { id: "cracked_hard",  name: "Cracked Hard Round", icon: "Trophy",      description: "Successfully handled Hard-difficulty questions.", image: "/badges/badge_cracked_hard.png" },
  { id: "unshakable",    name: "Unshakable Focus",   icon: "Eye",         description: "High confidence score (>85) and steady answers.", image: "/badges/badge_unshakable.png" },
  { id: "clean_coder",   name: "Clean Coder",        icon: "Code",        description: "Precise and well-structured code explanations.", image: "/badges/badge_clean_coder.png" },
  { id: "perfectionist", name: "Perfectionist",      icon: "Star",        description: "Achieved an overall score above 90.", image: "/badges/badge_perfectionist.png" },
  { id: "speed_demon",   name: "Speed Demon",        icon: "Target",      description: "Concise, sharp answers with zero rambling.", image: "/badges/speed_demon.png" },
  { id: "comeback_kid",  name: "Comeback Kid",       icon: "TrendingUp",  description: "Recovered strongly after a weak opening answer.", image: "/badges/comeback_kid.png" },
  { id: "deep_diver",    name: "Deep Diver",         icon: "BookOpen",    description: "Demonstrated expert depth beyond what was asked.", image: "/badges/deep_diver.png" },
  { id: "team_player",   name: "Team Player",        icon: "Users",       description: "Highlighted strong collaboration and leadership examples.", image: "/badges/Team_player.png" },
  { id: "streak_3",      name: "On Fire",            icon: "Flame",       description: "Completed interviews 3 days in a row.", image: "/badges/On_fire.png" },
  { id: "streak_7",      name: "Week Warrior",       icon: "Flame",       description: "Completed interviews 7 days in a row.", image: "/badges/week_warrior.png" },
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
  const [bestInterview, setBestInterview] = useState<any>(null);
  const [showBestModal, setShowBestModal] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [showICardModal, setShowICardModal] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) { router.push("/login?redirect=/profile"); return; }
    const loggedUser = JSON.parse(session);
    setUser(loggedUser);

    Promise.all([
      fetch(`${API_BASE_URL}/api/gamification/${loggedUser.id}`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/leaderboard`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/user/${loggedUser.id}/best_interview`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/user/${loggedUser.id}/stats`).then(r => r.json()),
    ]).then(([gam, lb, best, userStats]) => {
      setGData(gam);
      setLeaderboard(lb);
      if (best && best.status === "success" && best.data) {
        setBestInterview(best.data);
      }
      if (userStats && userStats.status === "success" && userStats.data) {
        setStats(userStats.data);
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const currentTier = XP_LEVELS.find(t => t.level === (gData?.level ?? 1)) ?? XP_LEVELS[0];
  const nextTier    = XP_LEVELS.find(t => t.level === (gData?.level ?? 1) + 1);
  const myRank      = leaderboard.find(e => e.user_id === user?.id)?.rank ?? null;

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

        <button
          onClick={() => setShowICardModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all cursor-pointer"
        >
          <IdCard className="w-4 h-4" />
          <span className="hidden sm:inline">View I-Card</span>
        </button>
      </header>

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
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${currentTier.color} opacity-20 blur-xl`}
              />
              <div className={`relative w-32 h-32 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.4)] bg-gradient-to-br ${currentTier.color} p-1`}>
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
                <span className="text-[11px] text-violet-400 font-bold uppercase tracking-[0.2em]">Current Rank</span>
                {myRank && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                    #{myRank} Global
                  </span>
                )}
              </div>
              <h2 className="text-4xl font-extrabold text-white">{gData?.rank_title ?? "Recruit"}</h2>
              <p className="text-zinc-400 text-sm mt-1">
                {user?.username} · {gData?.total_xp?.toLocaleString() ?? 0} Total XP
                {gData?.streak && gData.streak > 1 ? ` · 🔥 ${gData.streak}-Day Streak` : ""}
              </p>

              {/* XP Progress bar */}
              <div className="mt-5 max-w-md mx-auto md:mx-0">
                <div className="flex justify-between text-[10px] text-zinc-500 font-semibold mb-1.5">
                  <span>{gData?.xp_into_level?.toLocaleString() ?? 0} XP into level</span>
                  <span>{nextTier ? `${nextTier.rank} at ${nextTier.xp.toLocaleString()} XP` : "Max Level!"}</span>
                </div>
                <div className="w-full bg-zinc-800 border border-white/5 h-3 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: `${gData?.progress_pct ?? 0}%` }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                    className={`h-full rounded-full bg-gradient-to-r ${currentTier.color} shadow-[0_0_10px_rgba(139,92,246,0.4)]`}
                  />
                </div>
                <div className="text-right text-[10px] text-zinc-600 mt-1">{gData?.progress_pct ?? 0}% to Level {(gData?.level ?? 1) + 1}</div>
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

        {/* Best Interview Spotlight Card */}
        {bestInterview && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => setShowBestModal(true)}
            className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-zinc-900/80 via-amber-950/20 to-zinc-900/80 backdrop-blur-xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(245,158,11,0.1)] cursor-pointer group hover:border-amber-400/50 hover:shadow-[0_0_40px_rgba(245,158,11,0.2)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent group-hover:via-amber-400 transition-all duration-700" />
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  Best Interview Ever <Star className="w-3.5 h-3.5 fill-amber-400" />
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Achieved {bestInterview.overall}/100 Score • {bestInterview.mode} Mode
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 self-end sm:self-auto">
              <div className="flex flex-col items-end">
                <span className="text-lg font-black text-white">
                  +{bestInterview.evaluation_data?.xp_earned?.toLocaleString() ?? 0} XP
                </span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Earned</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-colors shrink-0">
                <Eye className="w-4 h-4 text-zinc-400 group-hover:text-amber-400 transition-colors" />
              </div>
            </div>
          </motion.div>
        )}

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
                    <div className={`relative w-[56px] h-[56px] min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center text-sm font-extrabold border-2 transition-all overflow-hidden shrink-0 aspect-square shadow-lg ${
                      isCurrent
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
                    <span className="text-[7px] text-zinc-600">{tier.xp >= 1000 ? `${tier.xp/1000}k` : tier.xp} XP</span>
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
            { id: "badges",      label: "My Badges",   icon: Award },
            { id: "leaderboard", label: "Leaderboard",   icon: Crown },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                  isActive ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
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
                      <div className={`absolute left-1/2 -translate-x-1/2 w-48 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 transform ${
                        isBottom 
                          ? "bottom-[110%] translate-y-[10px] group-hover:translate-y-0" 
                          : "top-[110%] translate-y-[-10px] group-hover:translate-y-0"
                      }`}>
                        <div className="bg-zinc-900 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-xl relative flex flex-col items-center text-center">
                          <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 border-white/10 rotate-45 ${
                            isBottom ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-t border-l"
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
        {/* Best Interview Modal */}
        {showBestModal && bestInterview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBestModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-950 border border-amber-500/20 rounded-[2rem] shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden z-10 max-h-[90vh] flex flex-col"
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-zinc-950/80 to-zinc-950/90" />
              
              <div className="relative z-10 p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-sm sticky top-0">
                <h3 className="text-lg font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Best Interview Record
                </h3>
                <button 
                  onClick={() => setShowBestModal(false)}
                  className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <span className="text-lg leading-none mb-0.5">&times;</span>
                </button>
              </div>

              <div className="relative z-10 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-8">
                
                {/* Header Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 text-center">
                    <span className="block text-2xl font-black text-white">{bestInterview.overall}/100</span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Overall Score</span>
                  </div>
                  <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 text-center">
                    <span className="block text-2xl font-black text-amber-400">+{bestInterview.evaluation_data?.xp_earned?.toLocaleString() ?? 0}</span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider">XP Earned</span>
                  </div>
                  <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 text-center">
                    <span className="block text-2xl font-black text-white">{bestInterview.evaluation_data?.achievements?.length ?? 0}</span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Badges</span>
                  </div>
                  <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 text-center">
                    <span className="block text-2xl font-black text-white capitalize">{bestInterview.mode}</span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Mode</span>
                  </div>
                </div>

                {/* Score Distribution */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">Score Distribution</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: "technical", label: "Technical Mastery", color: "from-blue-500 to-blue-400", bg: "bg-blue-500/20" },
                      { key: "communication", label: "Communication", color: "from-emerald-500 to-emerald-400", bg: "bg-emerald-500/20" },
                      { key: "problem_solving", label: "Problem Solving", color: "from-amber-500 to-amber-400", bg: "bg-amber-500/20" },
                      { key: "confidence", label: "Confidence", color: "from-fuchsia-500 to-fuchsia-400", bg: "bg-fuchsia-500/20" },
                    ].map(dim => {
                      const val = bestInterview.evaluation_data?.scores?.[dim.key] ?? 0;
                      return (
                        <div key={dim.key} className="bg-zinc-900/40 p-4 rounded-xl border border-white/5 space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="uppercase tracking-wider text-zinc-400">{dim.label}</span>
                            <span className="text-white">{val}/100</span>
                          </div>
                          <div className={`h-2 rounded-full overflow-hidden ${dim.bg}`}>
                            <div className={`h-full bg-gradient-to-r ${dim.color}`} style={{ width: `${val}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Earned Badges */}
                {bestInterview.evaluation_data?.achievements?.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">Badges Unlocked</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {bestInterview.evaluation_data.achievements.map((ach: any, i: number) => {
                        const badgeDef = ALL_BADGES.find(b => b.id === ach.id);
                        return (
                          <div key={i} className="bg-zinc-900/40 p-3 rounded-xl border border-amber-500/10 flex flex-col items-center text-center gap-2">
                            {badgeDef?.image ? (
                              <div className="w-16 h-16 relative rounded-full overflow-hidden bg-zinc-950 border-2 border-white/10 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                <Image src={badgeDef.image} alt={ach.name} fill className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                <Star className="w-5 h-5" />
                              </div>
                            )}
                            <div>
                              <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider leading-tight">{ach.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
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
            bestInterview={bestInterview} 
            onClose={() => setShowICardModal(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Holographic I-Card Component ────────────────────────────────────────────────
const HolographicICard = ({ user, gData, stats, bestInterview, onClose }: any) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const box = card.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const centerX = box.width / 2;
    const centerY = box.height / 2;
    
    const rotateXValue = ((y - centerY) / centerY) * -15;
    const rotateYValue = ((x - centerX) / centerX) * 15;
    
    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

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
    const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: null, useCORS: true });
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(null); return; }
        const file = new File([blob], "HireMind_ICard.png", { type: "image/png" });
        resolve(file);
      }, "image/png");
    });
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: null, useCORS: true });
    const link = document.createElement('a');
    link.download = 'HireMind_ICard.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
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
          className="relative w-full max-w-[340px] aspect-[1/1.65] flex items-center justify-center"
        >
          {/* We attach the ref to this inner div so html2canvas renders a flat, unrotated version by temporarily ignoring transforms, or we can just capture it as is (html2canvas ignores 3D transforms mostly, which is good for 2D capture). */}
          <motion.div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            animate={{ rotateX, rotateY }}
            transition={{ type: "spring", damping: 20, stiffness: 300, mass: 0.5 }}
            style={{ transformStyle: "preserve-3d" }}
            className="w-full h-full relative rounded-[1rem] bg-yellow-400 p-[12px] shadow-[0_0_50px_rgba(250,204,21,0.4)] cursor-pointer flex flex-col"
          >
            {/* Glossy shine effect overlaid on the whole card */}
            <div 
              className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 pointer-events-none z-50 rounded-[1rem]"
              style={{ transform: `translateZ(20px) translateX(${rotateY * 3}px) translateY(${rotateX * -3}px)` }}
            />

            {/* Inner Red/Orange Fire Background */}
            <div className="relative flex-1 w-full rounded-md bg-gradient-to-b from-orange-400 via-red-500 to-red-600 shadow-inner flex flex-col p-1.5 overflow-hidden">
              
              {/* Texture overlay for the fire */}
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none" />

              {/* Stage Badge (Top Left Overlapping) */}
              <div className="absolute -top-3 -left-3 bg-gradient-to-br from-yellow-200 to-yellow-600 border border-yellow-700 shadow-md p-1 z-20 flex flex-col items-center justify-center transform -rotate-6" style={{ width: "50px", height: "50px", clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}>
                <span className="text-[6px] font-black uppercase text-black leading-none mt-1">Stage</span>
                <span className="text-sm font-black text-black leading-none">{gData?.level || 1}</span>
              </div>

              {/* Header Bar */}
              <div className="flex justify-between items-end mb-1 pl-10 pr-1 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[6px] italic font-bold text-black/70 mb-[-2px]">Evolves from {gData?.rank_title || "Recruit"}</span>
                  <h2 className="text-xl font-black text-black tracking-tighter leading-none" style={{ fontFamily: "impact, sans-serif" }}>
                    {user?.username}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-black text-red-900 drop-shadow-sm leading-none">{gData?.total_xp?.toLocaleString() || 0} XP</span>
                  <div className="w-5 h-5 rounded-full bg-orange-600 border-2 border-yellow-300 flex items-center justify-center shadow-sm">
                    <Flame className="w-3 h-3 text-yellow-200 fill-yellow-200" />
                  </div>
                </div>
              </div>

              {/* Main Image Frame (Gold Beveled) */}
              <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 p-[3px] shadow-[2px_2px_5px_rgba(0,0,0,0.5)] z-10 mb-1">
                <div className="w-full h-full relative overflow-hidden shadow-inner bg-gradient-to-br from-red-600 via-orange-500 to-yellow-400 flex items-center justify-center">
                  {/* Starburst effect behind the image */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />
                  
                  {/* Profile / Rank Art */}
                  <div className="relative z-10 w-24 h-24 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
                    <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center border-4 border-yellow-400">
                      <span className="text-5xl font-black text-yellow-400">
                        {user?.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Gold Ribbon */}
              <div className="w-[104%] -ml-[2%] bg-gradient-to-r from-yellow-600 via-yellow-300 to-yellow-600 border border-yellow-700 py-0.5 px-2 text-center shadow-sm z-10 mb-2">
                <p className="text-[7px] font-bold text-black/80 italic tracking-wide">
                  NO. 001 Candidate HT: 5'10" WT: 150 lbs. Badges: {gData?.badges?.length || 0}
                </p>
              </div>

              {/* Abilities & Attacks Section */}
              <div className="flex-1 flex flex-col px-1 z-10">
                {/* Ability */}
                <div className="mb-2">
                  <h4 className="text-sm font-black text-red-900 italic tracking-tight">Ability: Fluent Orator</h4>
                  <p className="text-[8px] font-medium text-black leading-tight mt-0.5">
                    All communication responses are highly structured. Nullifies the effect of filler words.
                  </p>
                </div>
                
                <div className="w-full h-px bg-black/30 my-1" />

                {/* Attack */}
                <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-1">
                    <div className="flex gap-0.5">
                      <div className="w-3 h-3 rounded-full bg-orange-600 border border-yellow-300 flex items-center justify-center"><Flame className="w-2 h-2 text-white" /></div>
                      <div className="w-3 h-3 rounded-full bg-orange-600 border border-yellow-300 flex items-center justify-center"><Flame className="w-2 h-2 text-white" /></div>
                      <div className="w-3 h-3 rounded-full bg-orange-600 border border-yellow-300 flex items-center justify-center"><Flame className="w-2 h-2 text-white" /></div>
                    </div>
                    <span className="text-sm font-black text-black ml-1">{title}</span>
                  </div>
                  <span className="text-lg font-black text-black">{bestInterview?.overall || stats?.highest_score || 0}</span>
                </div>
                <p className="text-[8px] font-medium text-black leading-tight mt-1">
                  Discard 3 doubts attached to this Candidate. This attack does {bestInterview?.overall || 0} damage to the interviewer's expectations.
                </p>
              </div>

              {/* Footer Section */}
              <div className="mt-auto pt-1 border-t border-black/30 flex justify-between items-end z-10">
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-[6px] font-bold text-black">weakness</div>
                    <div className="w-3 h-3 rounded-full bg-blue-500 border border-white mx-auto mt-0.5" />
                  </div>
                  <div className="text-center">
                    <div className="text-[6px] font-bold text-black">resistance</div>
                    <div className="text-[8px] font-black text-black mt-0.5">-30</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[6px] font-bold text-black">retreat cost</div>
                    <div className="w-3 h-3 rounded-full bg-zinc-400 border border-white mx-auto mt-0.5" />
                  </div>
                </div>
                <div className="w-24 p-1 border border-black/20 bg-white/10 rounded-sm">
                  <p className="text-[5px] text-black italic leading-[1.2]">
                    Its logic can carry this Candidate close to an altitude of 4,600 feet. It blows out fire at very high temperatures.
                  </p>
                </div>
              </div>

              {/* Bottom Copyright */}
              <div className="flex justify-between items-center w-full px-1 mt-1 z-10">
                <span className="text-[5px] font-bold text-black">Illus. HireMind AI</span>
                <span className="text-[5px] font-bold text-black">©2026 HireMind</span>
                <span className="text-[5px] font-bold text-black">001/108 ★</span>
              </div>

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
        <div className="text-xs font-bold text-violet-300 uppercase tracking-widest drop-shadow-md">Share your story</div>
        <div className="flex items-center gap-4 bg-zinc-900/80 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          {/* WhatsApp / Message */}
          <button 
            onClick={(e) => shareToApp("WhatsApp", e)}
            className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 flex items-center justify-center transition-all group"
            title="Share to WhatsApp"
          >
            <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>

          {/* Instagram */}
          <button 
            onClick={(e) => shareToApp("Instagram", e)}
            className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/5 hover:border-fuchsia-500/50 hover:bg-fuchsia-500/20 text-zinc-300 hover:text-fuchsia-400 flex items-center justify-center transition-all group"
            title="Share to Instagram"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 group-hover:scale-110 transition-transform">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
            </svg>
          </button>

          {/* Facebook */}
          <button 
            onClick={(e) => shareToApp("Facebook", e)}
            className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/20 text-zinc-300 hover:text-blue-400 flex items-center justify-center transition-all group"
            title="Share to Facebook"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 group-hover:scale-110 transition-transform">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
          </button>

          <div className="w-px h-8 bg-white/10 mx-1" />

          {/* Download */}
          <button 
            onClick={handleDownload}
            className="w-12 h-12 rounded-xl bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all group shadow-[0_0_15px_rgba(139,92,246,0.4)]"
            title="Download Image"
          >
            <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
          </button>
        </div>
      </motion.div>

      {/* Close Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-zinc-500 text-[10px] uppercase tracking-widest font-bold pointer-events-none">
        Click background to close
      </div>
    </div>
  );
};
