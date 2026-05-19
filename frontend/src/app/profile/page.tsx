"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit, ArrowLeft, Trophy, Flame, Star, Zap, Eye,
  MessageSquare, Code, TrendingUp, Users, Target, BookOpen,
  Lock, Crown, Medal, Award, User, RefreshCw
} from "lucide-react";
import { API_BASE_URL } from "../config";

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
  { level: 1,  xp: 0,      rank: "Recruit",   color: "from-zinc-500 to-zinc-400" },
  { level: 2,  xp: 500,    rank: "Applicant",  color: "from-emerald-600 to-emerald-400" },
  { level: 3,  xp: 1500,   rank: "Contender",  color: "from-cyan-600 to-cyan-400" },
  { level: 4,  xp: 3500,   rank: "Specialist", color: "from-blue-600 to-blue-400" },
  { level: 5,  xp: 7000,   rank: "Expert",     color: "from-violet-600 to-violet-400" },
  { level: 6,  xp: 12000,  rank: "Senior",     color: "from-purple-600 to-purple-400" },
  { level: 7,  xp: 20000,  rank: "Principal",  color: "from-fuchsia-600 to-fuchsia-400" },
  { level: 8,  xp: 32000,  rank: "Director",   color: "from-pink-600 to-pink-400" },
  { level: 9,  xp: 50000,  rank: "VP",         color: "from-rose-600 to-amber-400" },
  { level: 10, xp: 75000,  rank: "Legend",     color: "from-amber-500 to-yellow-300" },
];

const ALL_BADGES = [
  { id: "first_blood",   name: "First Blood",        icon: "Zap",         description: "Completed your very first interview on HireMind." },
  { id: "fluent_speaker",name: "Fluent Communicator",icon: "MessageSquare",description: "< 5 filler words across the entire interview." },
  { id: "logic_master",  name: "Logic Master",       icon: "Zap",         description: "Structured reasoning across all problem-solving questions." },
  { id: "cracked_hard",  name: "Cracked Hard Round", icon: "Trophy",      description: "Successfully handled Hard-difficulty questions." },
  { id: "unshakable",    name: "Unshakable Focus",   icon: "Eye",         description: "High confidence score (>85) and steady answers." },
  { id: "clean_coder",   name: "Clean Coder",        icon: "Code",        description: "Precise and well-structured code explanations." },
  { id: "perfectionist", name: "Perfectionist",      icon: "Star",        description: "Achieved an overall score above 90." },
  { id: "speed_demon",   name: "Speed Demon",        icon: "Target",      description: "Concise, sharp answers with zero rambling." },
  { id: "comeback_kid",  name: "Comeback Kid",       icon: "TrendingUp",  description: "Recovered strongly after a weak opening answer." },
  { id: "deep_diver",    name: "Deep Diver",         icon: "BookOpen",    description: "Demonstrated expert depth beyond what was asked." },
  { id: "team_player",   name: "Team Player",        icon: "Users",       description: "Highlighted strong collaboration and leadership examples." },
  { id: "streak_3",      name: "On Fire",            icon: "Flame",       description: "Completed interviews 3 days in a row." },
  { id: "streak_7",      name: "Week Warrior",       icon: "Flame",       description: "Completed interviews 7 days in a row." },
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

  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) { router.push("/login?redirect=/profile"); return; }
    const loggedUser = JSON.parse(session);
    setUser(loggedUser);

    Promise.all([
      fetch(`${API_BASE_URL}/api/gamification/${loggedUser.id}`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/leaderboard`).then(r => r.json()),
    ]).then(([gam, lb]) => {
      setGData(gam);
      setLeaderboard(lb);
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
            <BrainCircuit className="w-5 h-5 text-violet-400" />
            <h1 className="text-lg font-bold text-white">My Progress Profile</h1>
          </div>
        </div>
        <button
          onClick={() => router.push("/interview")}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:opacity-90 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> New Interview
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
              <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${currentTier.color} flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.4)]`}>
                <span className="text-5xl font-black text-white">{gData?.level ?? 1}</span>
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

        {/* Level Roadmap Strip */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6"
        >
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-5">Rank Progression Roadmap</h3>
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {XP_LEVELS.map((tier, i) => {
              const unlocked = (gData?.level ?? 1) >= tier.level;
              const isCurrent = (gData?.level ?? 1) === tier.level;
              return (
                <div key={tier.level} className="flex items-center shrink-0">
                  <div className={`flex flex-col items-center gap-1.5 ${isCurrent ? "scale-110" : ""} transition-transform`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold border-2 transition-all ${
                      isCurrent
                        ? `bg-gradient-to-br ${tier.color} border-white/30 shadow-[0_0_15px_rgba(139,92,246,0.4)] text-white`
                        : unlocked
                        ? `bg-gradient-to-br ${tier.color} border-transparent text-white opacity-80`
                        : "bg-zinc-900 border-zinc-800 text-zinc-600"
                    }`}>
                      {unlocked ? tier.level : <Lock className="w-3.5 h-3.5" />}
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
            { id: "badges",      label: "Badge Vault",   icon: Award },
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

        {/* Badge Vault Tab */}
        <AnimatePresence mode="wait">
          {activeTab === "badges" && (
            <motion.div
              key="badges"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
            >
              {ALL_BADGES.map((badge, i) => {
                const earned = (gData?.badges ?? []).includes(badge.id);
                const Ic = ICON_MAP[badge.icon] || Trophy;
                return (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className={`group relative flex flex-col items-center text-center p-5 rounded-2xl border transition-all ${
                      earned
                        ? "bg-zinc-900/60 border-violet-500/20 hover:border-violet-500/40 hover:bg-zinc-900/80"
                        : "bg-zinc-950/50 border-white/5 opacity-50 grayscale"
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${
                      earned
                        ? "bg-violet-500/15 border border-violet-500/30 text-violet-400"
                        : "bg-zinc-900 text-zinc-700"
                    }`}>
                      {earned ? <Ic className="w-7 h-7" /> : <Lock className="w-6 h-6" />}
                    </div>
                    <span className="text-xs font-bold text-zinc-200 leading-tight mb-1">{badge.name}</span>
                    <span className="text-[9px] text-zinc-500 leading-relaxed">{badge.description}</span>
                    {earned && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
                    )}
                  </motion.div>
                );
              })}
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
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${tierColor} flex items-center justify-center text-xs font-extrabold text-white shrink-0`}>
                          {entry.level}
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
    </div>
  );
}
