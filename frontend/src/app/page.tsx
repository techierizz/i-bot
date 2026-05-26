"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, LineChart, FileText, ArrowRight, LogOut, Shield, User, PlayCircle, CheckCircle2, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const [candidateUser, setCandidateUser] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-950 text-white overflow-hidden selection:bg-primary-500/30">

      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/30 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-600/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Top Header Navigation */}
      <header className="w-full bg-zinc-950/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 fixed top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center w-full">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 overflow-hidden rounded-xl bg-zinc-900 border border-white/10 group-hover:border-primary-500/50 transition-colors">
              <Image
                src="/logo.png"
                alt="HireMind AI Logo"
                fill
                className="object-cover"
              />
            </div>
            <span className="font-extrabold tracking-tight text-lg">
              HireMind <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400">AI</span>
            </span>
          </Link>

          <nav className="flex items-center gap-4">
            {adminUser ? (
              <>
                <Link href="/admin/dashboard">
                  <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
                    <Shield className="w-4 h-4" /> Admin Console
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2.5 bg-zinc-900 border border-white/10 hover:border-zinc-700 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : candidateUser ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-zinc-300 flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-white/5">
                  <User className="w-4 h-4 text-primary-400" /> {candidateUser.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-zinc-900 border border-white/10 hover:border-zinc-700 hover:bg-zinc-800 rounded-xl text-sm font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <span className="text-sm font-bold text-zinc-400 hover:text-white transition-all px-3 py-2">
                    Sign In
                  </span>
                </Link>
                <Link href="/login?mode=register">
                  <button className="px-5 py-2.5 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl text-sm font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95">
                    Get Started
                  </button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Flow */}
      <main className="flex-1 w-full relative z-10 pt-24">

        {/* Section 1: Hero */}
        <section className="min-h-[85vh] flex flex-col items-center justify-center p-6 md:p-12 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center space-y-8 max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/80 border border-primary-500/30 text-primary-300 text-sm font-medium mb-2 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              The Future of Interview Prep
            </motion.div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1]">
              Don't just practice.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-secondary-400">
                Master the Interview.
              </span>
            </h1>

            <p className="text-lg md:text-2xl text-zinc-400 font-medium max-w-2xl mx-auto leading-relaxed pb-12">
              Step into a hyper-realistic, voice-driven AI interview. Get grilled like a real candidate, and get hired like a pro.
            </p>
          </motion.div>

          {/* Scroll Indicator */}
          <AnimatePresence>
            {!isScrolled && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, 15, 0] }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.5 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex justify-center items-center text-primary-500"
              >
                <motion.div
                  animate={{ y: [0, 15, 0] }}
                  transition={{ delay: 1.5, duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ChevronDown className="w-10 h-10 drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Section 2: The Problem */}
        <section className="py-32 px-6 relative border-t border-white/5 bg-zinc-950/50">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-3xl mx-auto mb-20"
            >
              <h2 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">Interviews are terrifying.</span>
              </h2>
              <p className="text-xl text-zinc-400 leading-relaxed">
                You apply, you wait, you finally get the call—and then you freeze. Without realistic practice and honest feedback, you're going in blind.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: "Zero Feedback", desc: "Rejection emails don't tell you why you failed. We do." },
                { title: "Nerve-Racking", desc: "Anxiety kills performance. Practice until you're bulletproof." },
                { title: "Generic Prep", desc: "Static question banks don't adapt to your resume. HireMind does." }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.2 }}
                  className="p-8 rounded-3xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                    <span className="text-red-400 font-bold">0{i + 1}</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-zinc-400">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: The Solution / How it works */}
        <section className="py-32 px-6 relative">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-3xl mx-auto mb-24"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary-900/30 border border-secondary-500/30 text-secondary-300 text-sm font-medium mb-6">
                The Solution
              </div>
              <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Your Personal Interviewer</span>
              </h2>
              <p className="text-xl text-zinc-400">
                A seamless flow designed to extract your best performance.
              </p>
            </motion.div>

            <div className="space-y-24">
              {/* Step 1 */}
              <div className="flex flex-col md:flex-row items-center gap-12 md:gap-24">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 space-y-6"
                >
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <FileText className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-3xl font-bold">1. Context-Aware</h3>
                  <p className="text-lg text-zinc-400 leading-relaxed">
                    Upload your resume. HireMind analyzes your experience, projects, and skills to generate tailored, hyper-specific questions just like a real hiring manager.
                  </p>
                  <ul className="space-y-3 pt-4">
                    {['PDF Parsing', 'Skill Extraction', 'Custom Question Banks'].map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-zinc-300">
                        <CheckCircle2 className="w-5 h-5 text-blue-400" /> {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 w-full aspect-square md:aspect-video rounded-3xl bg-zinc-900 border border-white/10 relative overflow-hidden flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent" />
                  {/* Abstract representation of UI */}
                  <div className="w-3/4 h-3/4 rounded-xl border border-white/5 bg-zinc-950 p-6 shadow-2xl flex flex-col gap-4">
                    <div className="w-1/3 h-4 bg-zinc-800 rounded-full" />
                    <div className="w-full h-32 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-center border-dashed">
                      <span className="text-zinc-600 font-medium">Drag & Drop Resume.pdf</span>
                    </div>
                    <div className="w-2/3 h-4 bg-zinc-800 rounded-full" />
                    <div className="w-1/2 h-4 bg-zinc-800 rounded-full" />
                  </div>
                </motion.div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-24">
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 space-y-6"
                >
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Mic className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-3xl font-bold">2. Voice-Driven & Adaptive</h3>
                  <p className="text-lg text-zinc-400 leading-relaxed">
                    Speak naturally. The AI listens, understands, and dynamically adjusts the difficulty. If you excel, it digs deeper. If you struggle, it pivots.
                  </p>
                  <ul className="space-y-3 pt-4">
                    {['Real-time Voice Transcription', 'Dynamic Follow-ups', 'Tone Analysis'].map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-zinc-300">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" /> {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 w-full aspect-square md:aspect-video rounded-3xl bg-zinc-900 border border-white/10 relative overflow-hidden flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
                  <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full border border-emerald-500/50 animate-ping" />
                    <Mic className="w-10 h-10 text-emerald-400" />
                  </div>
                </motion.div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col md:flex-row items-center gap-12 md:gap-24">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 space-y-6"
                >
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <LineChart className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-3xl font-bold">3. Actionable Feedback</h3>
                  <p className="text-lg text-zinc-400 leading-relaxed">
                    Instantly receive a comprehensive breakdown of your performance. Identify weak points, filler words, and get a concrete roadmap to improvement.
                  </p>
                  <ul className="space-y-3 pt-4">
                    {['Performance Radar Charts', 'Filler Word Detection', 'Ideal Answer Suggestions'].map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-zinc-300">
                        <CheckCircle2 className="w-5 h-5 text-purple-400" /> {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 w-full aspect-square md:aspect-video rounded-3xl bg-zinc-900 border border-white/10 relative overflow-hidden flex items-center justify-center p-8"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-transparent" />
                  <div className="w-full h-full flex flex-col gap-4">
                    <div className="flex gap-4 h-1/2">
                      <div className="flex-1 bg-zinc-950 rounded-xl border border-white/5 p-4 flex flex-col justify-end">
                        <div className="w-full h-3/4 bg-purple-500/20 rounded-t-lg border-t border-purple-500/50" />
                      </div>
                      <div className="flex-1 bg-zinc-950 rounded-xl border border-white/5 p-4 flex flex-col justify-end">
                        <div className="w-full h-full bg-emerald-500/20 rounded-t-lg border-t border-emerald-500/50" />
                      </div>
                    </div>
                    <div className="h-1/2 bg-zinc-950 rounded-xl border border-white/5 p-4 flex flex-col gap-3">
                      <div className="w-1/3 h-4 bg-zinc-800 rounded-full" />
                      <div className="w-full h-2 bg-zinc-800 rounded-full" />
                      <div className="w-5/6 h-2 bg-zinc-800 rounded-full" />
                      <div className="w-4/6 h-2 bg-zinc-800 rounded-full" />
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 px-6 relative border-t border-white/5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary-900/20 pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center space-y-8 relative z-10"
          >
            <h2 className="text-5xl md:text-7xl font-black">Ready to land the offer?</h2>
            <p className="text-xl text-zinc-400">Join thousands of engineers who mastered their interviews with HireMind AI.</p>
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-5">
              <Link href="/setup" className="w-full sm:w-auto group">
                <button className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-500 hover:to-secondary-500 rounded-2xl font-black text-white text-xl shadow-[0_0_40px_rgba(139,92,246,0.3)] transition-all hover:shadow-[0_0_60px_rgba(139,92,246,0.5)] hover:scale-105 active:scale-95 flex items-center justify-center gap-3 cursor-pointer">
                  Start Your Free Interview <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <button className="w-full sm:w-auto px-10 py-5 bg-zinc-900/80 border border-white/10 hover:bg-zinc-800 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-3 backdrop-blur-sm cursor-pointer">
                <PlayCircle className="w-6 h-6 text-zinc-400" /> Watch Demo
              </button>
            </div>
          </motion.div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-8 text-center text-zinc-500 text-sm relative z-10 bg-zinc-950">
        <p>© {new Date().getFullYear()} HireMind AI. All rights reserved.</p>
      </footer>

    </div>
  );
}
