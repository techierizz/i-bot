"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, BrainCircuit, LineChart, FileText, ArrowRight, LogOut, Shield, User } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [candidateUser, setCandidateUser] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<any>(null);

  useEffect(() => {
    // Read session states from localStorage
    const candidateSession = localStorage.getItem("hiremind_user");
    if (candidateSession) {
      setCandidateUser(JSON.parse(candidateSession));
    }
    const adminSession = localStorage.getItem("hiremind_admin");
    if (adminSession) {
      setAdminUser(JSON.parse(adminSession));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("hiremind_user");
    localStorage.removeItem("hiremind_admin");
    setCandidateUser(null);
    setAdminUser(null);
    window.location.reload();
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      
      {/* Top Header Navigation */}
      <header className="w-full bg-zinc-950/40 backdrop-blur-md border-b border-white/5 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-primary-500 to-secondary-500 flex items-center justify-center text-white">
              <BrainCircuit className="w-5.5 h-5.5" />
            </div>
            <span className="font-bold text-white tracking-tight text-sm">
              HireMind <span className="text-primary-400 font-light">AI</span>
            </span>
          </div>

          <nav className="flex items-center gap-3">
            {adminUser ? (
              <>
                <Link href="/admin/dashboard">
                  <button className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                    <Shield className="w-3.5 h-3.5" /> Admin Console
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 bg-zinc-900 border border-white/5 hover:border-zinc-700 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            ) : candidateUser ? (
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-primary-400" /> {candidateUser.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-2 bg-zinc-900 border border-white/5 hover:border-zinc-700 hover:bg-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <span className="text-xs font-bold text-zinc-400 hover:text-white transition-all px-3 py-2 cursor-pointer">
                    Sign In
                  </span>
                </Link>
                <Link href="/login?mode=register">
                  <button className="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-500 hover:to-secondary-500 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-primary-500/10 cursor-pointer">
                    Get Started
                  </button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Hero Landing content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 md:py-20 max-w-6xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border-primary-500/30 text-primary-400 text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
            </span>
            V1.1 Auth & Admin console
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Master the Interview with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]">HireMind AI</span>
          </h1>
          
          <p className="text-lg md:text-xl text-zinc-400 font-medium">
            Upload your resume, choose your dream company, and experience a hyper-realistic, voice-driven AI interview with real-time feedback.
          </p>
          
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/setup" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-500 hover:to-secondary-500 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
                Start Free Interview <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <button className="w-full sm:w-auto px-8 py-4 glass-card hover:bg-zinc-800/60 rounded-xl font-semibold transition-all cursor-pointer">
              Watch Demo
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-24 w-full"
        >
          <FeatureCard 
            icon={<FileText className="w-6 h-6 text-primary-400" />}
            title="Resume Context"
            description="AI extracts your skills and projects to ask tailored, personalized questions."
          />
          <FeatureCard 
            icon={<BrainCircuit className="w-6 h-6 text-secondary-400" />}
            title="Adaptive Difficulty"
            description="Questions get harder if you excel, simulating a real senior engineering interview."
          />
          <FeatureCard 
            icon={<Mic className="w-6 h-6 text-emerald-400" />}
            title="Voice-Driven"
            description="Speak naturally. The AI detects hesitation, filler words, and confidence."
          />
          <FeatureCard 
            icon={<LineChart className="w-6 h-6 text-blue-400" />}
            title="Actionable Feedback"
            description="Get radar charts and a weekly growth roadmap to crack your dream role."
          />
        </motion.div>
      </div>

    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col gap-3 group hover:border-primary-500/50 transition-colors">
      <div className="w-12 h-12 rounded-xl bg-zinc-800/80 flex items-center justify-center border border-zinc-700/50 group-hover:bg-zinc-800 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-zinc-100">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}
