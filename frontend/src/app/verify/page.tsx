"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle, XCircle, Shield, Award, Calendar, User, Zap, Lock, GraduationCap } from "lucide-react";
import { API_BASE_URL } from "../config";

function VerifyContent() {
  const searchParams = useSearchParams();
  const [certId, setCertId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setCertId(id.toUpperCase());
    }
  }, [searchParams]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certId.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/public/certificate/verify/${certId.trim()}`);
      const data = await res.json();

      if (res.ok && data.status === "valid") {
        setResult(data.certificate);
      } else {
        setError(data.detail || "Certificate not found or invalid.");
      }
    } catch (err) {
      setError("An error occurred while connecting to the verification server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] bg-violet-600/10 pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] bg-emerald-600/10 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl z-10"
      >
        <div className="text-center mb-10 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 border border-white/5 mb-2 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
            <Shield className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Credential Verification
          </h1>
          <p className="text-zinc-400 max-w-lg mx-auto text-sm md:text-base">
            Enter a HireMind Certificate ID below to mathematically verify its authenticity and check the ledger record.
          </p>
        </div>

        {/* Search Box */}
        <form onSubmit={handleVerify} className="relative mb-8">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-32 py-5 bg-zinc-900/60 border border-white/10 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all font-mono text-lg shadow-inner"
            placeholder="e.g. CERT-31060FF7"
            value={certId}
            onChange={(e) => setCertId(e.target.value.toUpperCase())}
            required
          />
          <button
            type="submit"
            disabled={loading || !certId.trim()}
            className="absolute right-2 top-2 bottom-2 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "VERIFY"
            )}
          </button>
        </form>

        {/* Results Area */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center text-center space-y-3"
            >
              <XCircle className="w-10 h-10 text-red-400" />
              <div>
                <h3 className="text-red-400 font-bold text-lg">Verification Failed</h3>
                <p className="text-zinc-400 text-sm mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {result && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-emerald-500/30 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.1)] relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
              
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold tracking-widest text-xs uppercase">100% Authentic</span>
                    </div>
                    <h2 className="text-2xl font-black text-white">{result.course_title}</h2>
                    <p className="text-zinc-400 text-sm mt-1">Official Course Certification</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Credential ID</span>
                    <span className="font-mono text-zinc-300 bg-zinc-950 px-3 py-1.5 rounded-lg border border-white/5">{result.certificate_id}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950/50 p-6 rounded-2xl border border-white/5">
                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500 uppercase"><User className="w-3.5 h-3.5" /> Candidate</span>
                    <p className="font-bold text-white text-lg">{result.candidate_name}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500 uppercase"><Award className="w-3.5 h-3.5" /> Skill Verified</span>
                    <p className="font-bold text-white">{result.skill_name} <span className="text-zinc-500 text-sm font-normal">({result.difficulty})</span></p>
                  </div>

                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500 uppercase"><GraduationCap className="w-3.5 h-3.5" /> Evaluated By</span>
                    <p className="font-bold text-violet-300">{result.evaluator_name}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500 uppercase"><Calendar className="w-3.5 h-3.5" /> Issue Date</span>
                    <p className="font-bold text-white">{new Date(result.issue_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {result.secure_matrix && (
                      <div className="grid grid-cols-5 gap-[2px]">
                        {result.secure_matrix.map((isFilled: boolean, i: number) => (
                          <div 
                            key={i} 
                            className={`w-2.5 h-2.5 rounded-sm ${isFilled ? 'bg-amber-400' : 'bg-indigo-950/50 border border-white/5'}`} 
                          />
                        ))}
                      </div>
                    )}
                    <div>
                      <span className="block text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" /> Cryptographic Hash Match
                      </span>
                      <span className="block font-mono text-xs text-zinc-400 mt-1">{result.secure_hash}</span>
                      <span className="block text-[10px] text-zinc-500 mt-0.5">Tamper-proof digital ledger entry</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default function VerifyCertificatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
