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
  const redirectUrl = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<"login" | "register" | "forgot_password" | "reset_password">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlMode = searchParams.get("mode");
    const urlToken = searchParams.get("token");
    if (urlMode === "reset" && urlToken) {
      setMode("reset_password");
      setResetToken(urlToken);
    } else {
      // If user is already logged in, send them straight to redirect URL
      const existing = localStorage.getItem("hiremind_user");
      if (existing) {
        router.push(redirectUrl);
      }
    }
  }, [redirectUrl, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (mode === "forgot_password") {
      if (!email.trim()) {
        setError("Please enter your email address.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Request failed.");
        setSuccessMsg(data.message);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === "reset_password") {
      if (!password || password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
      if (!passwordRegex.test(password)) {
        setError("Password must be at least 8 characters, with 1 uppercase, 1 number, and 1 special character (!@#$%^&*).");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, new_password: password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Reset failed.");
        setSuccessMsg("Password successfully reset! You can now log in.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!username.trim() || !password) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    if (mode === "register") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("Please enter a valid email address.");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
      if (!passwordRegex.test(password)) {
        setError("Password must be at least 8 characters, with 1 uppercase, 1 number, and 1 special character (!@#$%^&*).");
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
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setError(null);
        setSuccessMsg("Registration successful! You can now log in.");
      } else {
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
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative min-h-screen bg-black bg-gradient-to-br from-black via-[#0a0510] to-[#130822]">
      {/* Top Left Branding */}
      <Link href="/" className="absolute top-6 left-6 md:top-8 md:left-8 z-20">
        <span className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-primary-300 to-zinc-500 tracking-tighter drop-shadow-sm">HireMind</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        {/* Removed center branding header */}

        {/* Auth form card */}
        <div className="glass-card rounded-3xl p-6 md:p-8 relative overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(139,92,246,0.1)]">

          {/* Tab Selector */}
          {(mode === "login" || mode === "register") && (
            <div className="flex bg-zinc-950/80 p-1 rounded-xl border border-white/5 mb-6">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${mode === "login" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${mode === "register" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                Register
              </button>
            </div>
          )}

          {mode === "forgot_password" && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-2">Reset Password</h2>
              <p className="text-sm text-zinc-400">Enter your email and we'll send you a reset link.</p>
            </div>
          )}

          {mode === "reset_password" && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-2">Set New Password</h2>
              <p className="text-sm text-zinc-400">Enter your new secure password below.</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            {(mode === "login" || mode === "register") && (
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
            )}

            {/* Email (for registration and forgot password) */}
            {(mode === "register" || mode === "forgot_password") && (
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
            {(mode === "login" || mode === "register" || mode === "reset_password") && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Password</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot_password"); setError(null); setSuccessMsg(null); }}
                      className="text-[10px] text-primary-400 hover:text-primary-300 font-medium transition-colors cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
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
            )}

            {/* Confirm Password */}
            {(mode === "register" || mode === "reset_password") && (
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

            {/* Success alerts */}
            <AnimatePresence>
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-start gap-2.5 overflow-hidden"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
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
                  <span>
                    {mode === "login" ? "Sign In" :
                      mode === "register" ? "Register" :
                        mode === "forgot_password" ? "Send Reset Link" : "Reset Password"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Back to Login link */}
            {(mode === "forgot_password" || mode === "reset_password") && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); setSuccessMsg(null); }}
                  className="text-xs text-zinc-500 hover:text-white transition-colors cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            )}
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
