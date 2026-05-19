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
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative min-h-screen">
      {/* Red Glowing Orbs */}
      <div className="absolute top-[20%] left-[15%] w-80 h-80 rounded-full blur-[110px] bg-red-600/10 pointer-events-none" />
      <div className="absolute bottom-[20%] right-[15%] w-80 h-80 rounded-full blur-[110px] bg-amber-600/10 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        {/* Branding header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-red-500/20">
            <BrainCircuit className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-1">
            HireMind <span className="text-red-500 font-light">Admin</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Management Portal & Performance Console</p>
        </div>

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
