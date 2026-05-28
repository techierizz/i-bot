"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Lock, User, ShieldAlert, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "../../config";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If admin is already logged in, redirect immediately
    const existing = localStorage.getItem("hiremind_admin");
    if (existing) {
      router.push("/admin/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.detail || "Admin authentication failed.");
      }

      // Save admin session state
      localStorage.setItem("hiremind_admin", JSON.stringify(resData.user));
      router.push("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative min-h-screen bg-zinc-950">
      {/* Elegant Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(220,38,38,0.2),rgba(24,24,27,0))]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]" />
      </div>

      {/* Top Left Branding */}
      <Link href="/" className="absolute top-6 left-6 md:top-8 md:left-8 z-20">
        <span className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-red-400 to-zinc-600 tracking-tighter drop-shadow-sm">HireMind</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        {/* Removed center branding header */}

        {/* Form Card */}
        <div className="glass-card rounded-3xl p-6 md:p-8 relative overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(239,68,68,0.12)]">
          <div className="flex items-center gap-2 mb-6 text-red-400 bg-red-500/5 border border-red-500/15 p-3 rounded-xl">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider leading-relaxed">
              Authorized Personnel Only
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1.5">Admin ID</label>
              <div className="relative flex items-center">
                <User className="absolute left-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="admin username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1.5">Secure Key</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5 overflow-hidden"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg hover:shadow-red-500/10 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Authenticate</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Seeding note */}
          <div className="mt-6 border-t border-white/5 pt-4 text-[9px] text-zinc-500 leading-normal">
            Welcome admin!!
          </div>

        </div>

        {/* Back to candidate login */}
        <div className="text-center mt-6">
          <Link href="/login">
            <span className="text-xs text-zinc-500 hover:text-zinc-300 font-medium transition-colors cursor-pointer">
              Looking for candidate portal? <span className="text-primary-400 hover:underline">Access Candidate Portal</span>
            </span>
          </Link>
        </div>

      </motion.div>
    </div>
  );
}
