"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Trophy, Target, Award, Loader2, CheckCircle, GraduationCap, Calendar, Zap } from "lucide-react";
import { API_BASE_URL } from "../../config";
import Link from "next/link";

export default function VerifyPage() {
  const params = useParams();
  const uidString = params.uid as string;
  const isCert = uidString?.startsWith("CERT-");

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!uidString) return;
    
    const endpoint = isCert 
      ? `${API_BASE_URL}/api/public/certificate/verify/${uidString}`
      : `${API_BASE_URL}/api/verify/${uidString}`;

    fetch(endpoint)
      .then(r => r.json())
      .then(res => {
        if (res.status === "success") {
          setData(isCert ? res.certificate : res.data);
        } else {
          setError(res.detail || "Record not found or invalid ID.");
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [uidString, isCert]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <p className="text-zinc-500 font-mono text-sm tracking-widest uppercase">Verifying {isCert ? "Certificate" : "Profile"}...</p>
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

  if (isCert) {
    return <CertificateView data={data} uidString={uidString} />;
  }

  return <ProfileView data={data} uidString={uidString} />;
}

function CertificateView({ data, uidString }: { data: any, uidString: string }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(167,139,250,0.1)_0%,_transparent_50%)] pointer-events-none" />
      
      <div className="w-full max-w-lg relative z-10">
        {/* Verification Badge */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-violet-500 blur-xl opacity-20 rounded-full" />
            <div className="w-14 h-14 bg-violet-500/10 border border-violet-500/30 rounded-full flex items-center justify-center relative">
              <CheckCircle className="w-7 h-7 text-violet-400" />
            </div>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Verified Certificate</h1>
          <p className="text-violet-400 font-mono text-[10px] tracking-widest mt-0.5 uppercase">Authenticity Confirmed</p>
        </div>

        {/* Certificate Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
          
          <div className="p-8 text-center border-b border-white/5 relative">
            <GraduationCap className="w-12 h-12 text-zinc-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-zinc-400 uppercase tracking-widest text-xs font-bold mb-2">This certifies that</h3>
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 uppercase tracking-tight mb-4" style={{ fontFamily: "impact, sans-serif" }}>
              {data.student_username}
            </h2>
            <h3 className="text-zinc-400 uppercase tracking-widest text-xs font-bold mb-2">has successfully completed</h3>
            <h4 className="text-2xl font-bold text-violet-400 mb-2">{data.course_title}</h4>
          </div>

          <div className="p-6 grid grid-cols-2 gap-4 bg-black/20">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-zinc-600" />
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Issued On</p>
                <p className="text-white font-medium">{new Date(data.issued_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-zinc-600" />
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Score</p>
                <p className="text-emerald-400 font-bold">{data.score}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-block px-4 py-1.5 bg-violet-950/40 border border-violet-500/40 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.15)] mb-4">
            <p className="text-xs text-violet-400 font-black font-mono tracking-widest uppercase">ID: {uidString}</p>
          </div>
          <br/>
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
            Learn with HireMind AI
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProfileView({ data, uidString }: { data: any, uidString: string }) {
  const seed = encodeURIComponent(data.user.username);
  const hueRotate = Array.from(seed).reduce((acc: any, char: any) => acc + char.charCodeAt(0), 0) % 360;
  const avatarUrl = `https://robohash.org/${seed}.png?set=set1&size=400x400`;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.1)_0%,_transparent_50%)] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        
        {/* Verification Badge */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full" />
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center relative">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Verified Profile</h1>
          <p className="text-emerald-400 font-mono text-[10px] tracking-widest mt-0.5 uppercase">Authenticity Confirmed</p>
        </div>

        {/* Profile Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 flex flex-col items-center text-center border-b border-white/5">
            <div className="w-24 h-24 relative mb-4">
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
              <span className="text-2xl font-black text-white">{data.gamification.total_xp?.toLocaleString() || 0}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Total XP</span>
            </div>
            <div className="bg-black/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
              <Award className="w-5 h-5 text-purple-400 mb-2" />
              <span className="text-2xl font-black text-white">{data.gamification.badges?.length || 0}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Badges</span>
            </div>
            <div className="bg-black/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
              <Target className="w-5 h-5 text-emerald-400 mb-2" />
              <span className="text-2xl font-black text-white">{data.stats?.highest_score || 0}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Best Score</span>
            </div>
            <div className="bg-black/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center">
              <ShieldCheck className="w-5 h-5 text-blue-400 mb-2" />
              <span className="text-2xl font-black text-white">{data.stats?.total_interviews || 0}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Interviews</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <div className="inline-block px-4 py-1.5 bg-cyan-950/40 border border-cyan-500/40 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.15)] mb-4">
            <p className="text-xs text-cyan-400 font-black font-mono tracking-widest uppercase">ID: {uidString}</p>
          </div>
          <br/>
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
            Create your own HireMind Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
