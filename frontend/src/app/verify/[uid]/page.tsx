"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Trophy, Target, Award, Loader2 } from "lucide-react";
import { API_BASE_URL } from "../../config";
import Link from "next/link";

export default function VerifyProfilePage() {
  const params = useParams();
  const uidString = params.uid as string;
  
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!uidString) return;
    
    fetch(`${API_BASE_URL}/api/verify/${uidString}`)
      .then(r => r.json())
      .then(res => {
        if (res.status === "success" && res.data) {
          setData(res.data);
        } else {
          setError(res.detail || "Profile not found or invalid ID.");
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [uidString]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <p className="text-zinc-500 font-mono text-sm tracking-widest uppercase">Verifying Profile...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <ShieldCheck className="w-10 h-10 text-red-500 opacity-50" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
        <p className="text-zinc-400 mb-8 max-w-md">{error}</p>
        <Link href="/" className="px-6 py-3 bg-white text-black font-semibold rounded-xl">
          Return to HireMind
        </Link>
      </div>
    );
  }

  const seed = encodeURIComponent(data.user.username);
  const hueRotate = Array.from(seed).reduce((acc: any, char: any) => acc + char.charCodeAt(0), 0) % 360;
  const avatarUrl = `https://robohash.org/${seed}.png?set=set1&size=400x400`;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.1)_0%,_transparent_50%)] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        
        {/* Verification Badge */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full" />
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center relative">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Verified Profile</h1>
          <p className="text-emerald-400 font-mono text-sm tracking-widest mt-1 uppercase">Authenticity Confirmed</p>
        </div>

        {/* Profile Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-8 flex flex-col items-center text-center border-b border-white/5">
            <div className="w-32 h-32 relative mb-6">
              <div className="absolute inset-0 bg-cyan-400/20 blur-xl rounded-full mix-blend-screen" />
              <img 
                src={avatarUrl} 
                alt="Avatar" 
                className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
                style={{ filter: `hue-rotate(${hueRotate}deg)` }}
              />
            </div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500 uppercase tracking-tight mb-2" style={{ fontFamily: "impact, sans-serif" }}>
              {data.user.username}
            </h2>
            <div className="px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold text-sm tracking-widest uppercase">
              {data.gamification.current_rank} • Lvl {data.gamification.level}
            </div>
          </div>

          <div className="p-6 grid grid-cols-2 gap-4">
            <div className="bg-black/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
              <Trophy className="w-5 h-5 text-yellow-500 mb-2" />
              <span className="text-2xl font-black text-white">{data.gamification.total_xp.toLocaleString()}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Total XP</span>
            </div>
            <div className="bg-black/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
              <Award className="w-5 h-5 text-purple-400 mb-2" />
              <span className="text-2xl font-black text-white">{data.gamification.badges?.length || 0}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Badges</span>
            </div>
            <div className="bg-black/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
              <Target className="w-5 h-5 text-emerald-400 mb-2" />
              <span className="text-2xl font-black text-white">{data.stats.highest_score || 0}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Best Score</span>
            </div>
            <div className="bg-black/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
              <ShieldCheck className="w-5 h-5 text-blue-400 mb-2" />
              <span className="text-2xl font-black text-white">{data.stats.total_interviews || 0}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Interviews</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-600 font-mono mb-4">ID: {uidString}</p>
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
            Create your own HireMind Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
