"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Lock, User, Mail, ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "../config";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/setup";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If user is already logged in, send them straight to redirect URL
    const existing = localStorage.getItem("hiremind_user");
    if (existing) {
      router.push(redirectUrl);
    }
  }, [redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!username.trim() || !password) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    if (mode === "register") {
      if (!email.trim()) {
        setError("Please enter a valid email address.");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        setLoading(false);
        return;
      }
    }

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "login" 
        ? { username, password } 
        : { username, email, password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.detail || "Authentication request failed.");
      }

      if (mode === "register") {
        // Automatically switch to login tab with success state
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setError(null);
        alert("Registration successful! You can now log in.");
      } else {
        // Save candidate session info locally
        localStorage.setItem("hiremind_user", JSON.stringify(resData.user));
        router.push(redirectUrl);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative min-h-screen">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[20%] left-[15%] w-80 h-80 rounded-full blur-[100px] bg-primary-600/15 pointer-events-none" />
      <div className="absolute bottom-[20%] right-[15%] w-80 h-80 rounded-full blur-[100px] bg-secondary-600/15 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        {/* Branding header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-500 to-secondary-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-primary-500/20">
            <BrainCircuit className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-1">
            HireMind <span className="text-primary-400 font-light">AI</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Autonomous Interactive Interview Simulation</p>
        </div>

        {/* Auth form card */}
        <div className="glass-card rounded-3xl p-6 md:p-8 relative overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(139,92,246,0.1)]">
          
          {/* Tab Selector */}
          <div className="flex bg-zinc-950/80 p-1 rounded-xl border border-white/5 mb-6">
            <button
              onClick={() => { setMode("login"); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                mode === "login" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                mode === "register" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username */}
            <div>
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1.5">Username</label>
              <div className="relative flex items-center">
                <User className="absolute left-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </div>

            {/* Email (only for registration) */}
            {mode === "register" && (
              <div>
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1.5">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </div>

            {/* Confirm Password (only for registration) */}
            {mode === "register" && (
              <div>
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1.5">Confirm Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Error alerts */}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg hover:shadow-primary-500/10 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === "login" ? "Sign In" : "Register"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Prompt banner for demo */}
          <div className="mt-6 border-t border-white/5 pt-4 flex items-start gap-2 text-[10px] text-zinc-500 leading-normal">
            <Sparkles className="w-4 h-4 text-primary-400/60 shrink-0 mt-0.5" />
            <span>Welcome to the demo! Log in with your candidate account or Register a new one.</span>
          </div>

        </div>

        {/* Administrator access link */}
        <div className="text-center mt-6">
          <Link href="/admin/login">
            <span className="text-xs text-zinc-500 hover:text-zinc-300 font-medium transition-colors cursor-pointer">
              Are you an Administrator? <span className="text-secondary-400 hover:underline">Access Admin Portal</span>
            </span>
          </Link>
        </div>

      </motion.div>
    </div>
  );
}
