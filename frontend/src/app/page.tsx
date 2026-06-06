"use client";

import { useState, useEffect, useRef, MouseEvent } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { Mic, LineChart, FileText, ArrowRight, LogOut, Shield, User, PlayCircle, CheckCircle2, ChevronDown, Sparkles, Activity, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// --- Components ---

const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-zinc-950">
      {/* Base Grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      
      {/* Animated Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 100, 0],
          y: [0, -50, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-600/30 blur-[100px] rounded-full mix-blend-screen"
        style={{ willChange: "transform, opacity" }}
      />
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -100, 0],
          y: [0, 50, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-600/20 blur-[100px] rounded-full mix-blend-screen"
        style={{ willChange: "transform, opacity" }}
      />
    </div>
  );
};

const TiltCard = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={`glass-card p-8 rounded-3xl relative overflow-hidden transition-colors hover:border-white/20 group ${className || ""}`}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
      <div style={{ transform: "translateZ(30px)" }}>{children}</div>
    </motion.div>
  );
};

const WordReveal = ({ text, className }: { text: string; className?: string }) => {
  const words = text.split(" ");
  return (
    <h1 className={`flex flex-wrap justify-center ${className || ""}`}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: i * 0.15, ease: [0.2, 0.65, 0.3, 0.9] }}
          className="mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </h1>
  );
};

export default function Home() {
  const [candidateUser, setCandidateUser] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [hasCompletedInterview, setHasCompletedInterview] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  
  const { scrollY, scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  
  const headerBg = useTransform(scrollY, [0, 50], ["rgba(9, 9, 11, 0)", "rgba(9, 9, 11, 0.8)"]);
  const headerBorder = useTransform(scrollY, [0, 50], ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.05)"]);
  const headerPy = useTransform(scrollY, [0, 50], ["24px", "16px"]);
  const headerBackdrop = useTransform(scrollY, [0, 50], ["blur(0px)", "blur(12px)"]);
  const scrollIndicatorOpacity = useTransform(scrollY, [0, 50], [1, 0]);

  useEffect(() => {
    const candidateSession = localStorage.getItem("hiremind_user");
    if (candidateSession) setCandidateUser(JSON.parse(candidateSession));
    const adminSession = localStorage.getItem("hiremind_admin");
    if (adminSession) setAdminUser(JSON.parse(adminSession));
    if (localStorage.getItem("hiremind_eval_id")) setHasCompletedInterview(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("hiremind_user");
    localStorage.removeItem("hiremind_admin");
    setCandidateUser(null);
    setAdminUser(null);
    window.location.reload();
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen text-white overflow-x-hidden selection:bg-primary-500/30">
      <AnimatedBackground />

      {/* Top Header Navigation */}
      <motion.header 
        style={{ 
          backgroundColor: headerBg, 
          borderBottomColor: headerBorder, 
          paddingTop: headerPy, 
          paddingBottom: headerPy,
          backdropFilter: headerBackdrop,
          WebkitBackdropFilter: headerBackdrop
        }}
        className="w-full fixed top-0 z-50 border-b border-transparent"
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center w-full px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 overflow-hidden rounded-xl bg-zinc-900 border border-white/10 group-hover:border-primary-500/50 group-hover:shadow-[0_0_15px_rgba(139,92,246,0.5)] transition-all">
              <Image src="/logo.png" alt="HireMind AI Logo" fill className="object-cover" />
            </div>
            <span className="font-extrabold tracking-tight text-lg">
              HireMind <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400">AI</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            {adminUser ? (
              <>
                <Link href="/admin/dashboard">
                  <button className="px-3 sm:px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-[10px] sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 transition-all hover:scale-105 active:scale-95 whitespace-nowrap">
                    <Shield className="w-3 h-3 sm:w-4 sm:h-4" /> Admin
                  </button>
                </Link>
                <button onClick={handleLogout} className="p-2 sm:p-2.5 bg-zinc-900 border border-white/10 hover:border-red-500/50 hover:text-red-400 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-all hover:scale-105 active:scale-95">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : candidateUser ? (
              <div className="flex items-center gap-2 sm:gap-4">
                {hasCompletedInterview && (
                  <Link href="/resume">
                    <button className="text-xs sm:text-sm font-bold text-zinc-300 flex items-center gap-1.5 sm:gap-2 bg-zinc-900/50 glass px-2 sm:px-3 py-1.5 rounded-lg border border-white/5 hover:border-emerald-500/30 hover:bg-zinc-800/80 transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap">
                      <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" /> <span className="hidden sm:inline">Resume Hub</span>
                    </button>
                  </Link>
                )}
                <Link href="/profile">
                  <button className="text-xs sm:text-sm font-bold text-zinc-300 flex items-center gap-1.5 sm:gap-2 bg-zinc-900/50 glass px-2 sm:px-3 py-1.5 rounded-lg border border-white/5 hover:border-primary-500/30 hover:bg-zinc-800/80 transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap">
                    <User className="w-3 h-3 sm:w-4 sm:h-4 text-primary-400" /> {candidateUser.username}
                  </button>
                </Link>
                <button onClick={handleLogout} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-zinc-900 border border-white/10 hover:border-red-500/50 hover:bg-zinc-800 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-400 hover:text-red-400 transition-all flex items-center gap-1.5 sm:gap-2 hover:scale-105 active:scale-95 whitespace-nowrap">
                  <LogOut className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <span className="text-xs sm:text-sm font-bold text-zinc-400 hover:text-white transition-all px-2 sm:px-3 py-2 whitespace-nowrap">Sign In</span>
                </Link>
                <Link href="/login?mode=register">
                  <button className="relative px-4 sm:px-6 py-2 sm:py-2.5 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95 overflow-hidden group">
                    <span className="relative z-10 whitespace-nowrap">Get Started</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                  </button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </motion.header>

      <main className="flex-1 w-full relative z-10 pt-24">
        {/* Section 1: Hero */}
        <section className="min-h-[90vh] flex flex-col items-center justify-center p-6 md:p-12 relative">
          <motion.div style={{ y }} className="text-center space-y-8 max-w-5xl mx-auto flex flex-col items-center">
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8, type: "spring" }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass border border-primary-500/30 text-primary-300 text-sm font-semibold mb-4 shadow-[0_0_30px_rgba(139,92,246,0.15)]"
            >
              <Sparkles className="w-4 h-4 text-primary-400 animate-pulse" />
              The Future of Interview Prep
            </motion.div>

            <WordReveal 
              text="Don't just practice." 
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1]" 
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.8, duration: 1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1] relative"
            >
              <span className="absolute inset-0 blur-2xl opacity-40 bg-gradient-to-r from-primary-400 via-purple-400 to-secondary-400 bg-clip-text text-transparent animate-pulse">
                Master the Interview.
              </span>
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-fuchsia-400 to-secondary-400 bg-[length:200%_auto] animate-[gradient_8s_linear_infinite]">
                Master the Interview.
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="text-lg md:text-2xl text-zinc-400 font-medium max-w-2xl mx-auto leading-relaxed pb-8 pt-6"
            >
              Step into a hyper-realistic, voice-driven AI interview. Get grilled like a real candidate, and get hired like a pro.
            </motion.p>
            

          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            style={{ opacity: scrollIndicatorOpacity }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex justify-center items-center text-primary-500 pointer-events-none"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: [0, 15, 0] }}
              transition={{ delay: 2, duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown className="w-10 h-10 drop-shadow-[0_0_15px_rgba(139,92,246,0.5)] opacity-50" />
            </motion.div>
          </motion.div>
        </section>

        {/* Section 2: The Problem */}
        <section className="py-32 px-6 relative border-t border-white/5 bg-zinc-950/40">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-3xl mx-auto mb-20"
            >
              <h2 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400 drop-shadow-sm">Interviews are terrifying.</span>
              </h2>
              <p className="text-xl text-zinc-400 leading-relaxed">
                You apply, you wait, you finally get the call—and then you freeze. Without realistic practice and honest feedback, you're going in blind.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 perspective-1000">
              {[
                { title: "Zero Feedback", desc: "Rejection emails don't tell you why you failed. We do.", num: "01", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
                { title: "Nerve-Racking", desc: "Anxiety kills performance. Practice until you're bulletproof.", num: "02", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
                { title: "Generic Prep", desc: "Static question banks don't adapt to your resume. HireMind does.", num: "03", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30, rotateX: 10 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.2 }}
                >
                  <TiltCard className="h-full flex flex-col justify-start">
                    <div className={`w-14 h-14 rounded-2xl ${item.bg} border ${item.border} flex items-center justify-center mb-6 shadow-lg`}>
                      <span className={`${item.color} font-black text-xl`}>{item.num}</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                    <p className="text-zinc-400 text-lg leading-relaxed">{item.desc}</p>
                  </TiltCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: The Solution / How it works */}
        <section className="py-32 px-6 relative border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-3xl mx-auto mb-32"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-500/30 text-emerald-300 text-sm font-medium mb-6 glass">
                <Sparkles className="w-4 h-4" /> The Solution
              </div>
              <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">Your Personal Interviewer</span>
              </h2>
              <p className="text-xl text-zinc-400">
                A seamless flow designed to extract your best performance.
              </p>
            </motion.div>

            <div className="space-y-32">
              {/* Step 1 */}
              <div className="flex flex-col md:flex-row items-center gap-12 md:gap-24">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 space-y-6"
                >

                  <h3 className="text-4xl font-bold">1. Context-Aware</h3>
                  <p className="text-xl text-zinc-400 leading-relaxed">
                    Upload your resume. HireMind analyzes your experience, projects, and skills to generate tailored, hyper-specific questions just like a real hiring manager.
                  </p>
                  <ul className="space-y-4 pt-4">
                    {['PDF Parsing & Analysis', 'Skill Extraction', 'Custom Question Generation'].map((f, i) => (
                      <li key={i} className="flex items-center gap-4 text-zinc-300 text-lg">
                        <CheckCircle2 className="w-6 h-6 text-blue-400" /> {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 50, rotateY: -10 }}
                  whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 w-full aspect-square md:aspect-video rounded-3xl glass-card relative overflow-hidden flex items-center justify-center p-8 group"
                  style={{ perspective: 1000 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-transparent opacity-50" />
                  <div className="relative w-full h-full rounded-3xl overflow-hidden">
                     <Image src="/context-aware.png" alt="Context Aware Analysis" fill className="object-cover transform group-hover:scale-105 transition-transform duration-700" />
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

                  <h3 className="text-4xl font-bold">2. Voice-Driven & Adaptive</h3>
                  <p className="text-xl text-zinc-400 leading-relaxed">
                    Speak naturally. The AI listens, understands, and dynamically adjusts the difficulty. If you excel, it digs deeper. If you struggle, it pivots.
                  </p>
                  <ul className="space-y-4 pt-4">
                    {['Real-time Voice Transcription', 'Dynamic Follow-ups', 'Conversational Tone'].map((f, i) => (
                      <li key={i} className="flex items-center gap-4 text-zinc-300 text-lg">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" /> {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -50, rotateY: 10 }}
                  whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 w-full aspect-square md:aspect-video rounded-3xl glass-card relative overflow-hidden flex items-center justify-center p-8 group"
                  style={{ perspective: 1000 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-50" />
                  <div className="relative w-full h-full rounded-3xl overflow-hidden">
                     <Image src="/voice-driven.png" alt="Voice Driven Interview" fill className="object-cover transform group-hover:scale-105 transition-transform duration-700" />
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

                  <h3 className="text-4xl font-bold">3. Actionable Feedback</h3>
                  <p className="text-xl text-zinc-400 leading-relaxed">
                    Instantly receive a comprehensive breakdown of your performance. Identify weak points, filler words, and get a concrete roadmap to improvement.
                  </p>
                  <ul className="space-y-4 pt-4">
                    {['Detailed Metric Breakdowns', 'Filler Word Detection', 'Ideal Answer Suggestions'].map((f, i) => (
                      <li key={i} className="flex items-center gap-4 text-zinc-300 text-lg">
                        <CheckCircle2 className="w-6 h-6 text-purple-400" /> {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 50, rotateY: -10 }}
                  whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="flex-1 w-full aspect-square md:aspect-video rounded-3xl glass-card relative overflow-hidden flex items-center justify-center p-8 group"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 via-transparent to-transparent opacity-50" />
                  <div className="relative w-full h-full rounded-3xl overflow-hidden">
                     <Image src="/actionable-feedback.png" alt="Actionable Feedback" fill className="object-cover transform group-hover:scale-105 transition-transform duration-700" />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-40 px-6 relative border-t border-white/5 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary-900/30 pointer-events-none" />
          
          {/* Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
             {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                     y: [Math.random() * 500, Math.random() * -500],
                     opacity: [0, 0.5, 0],
                  }}
                  transition={{ duration: 5 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 5 }}
                  className="absolute bg-white rounded-full w-1 h-1 blur-[1px]"
                  style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                />
             ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center space-y-10 relative z-10 glass-card p-12 md:p-20 rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(139,92,246,0.15)]"
          >
            <h2 className="text-5xl md:text-7xl font-black">Ready to land the offer?</h2>
            <p className="text-xl md:text-2xl text-zinc-300 font-medium">Join thousands of engineers who mastered their interviews with HireMind AI.</p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link href="/setup" className="w-full sm:w-auto group">
                <button className="w-full sm:w-auto px-12 py-6 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-500 hover:to-secondary-500 rounded-2xl font-black text-white text-xl shadow-[0_0_40px_rgba(139,92,246,0.5)] transition-all hover:shadow-[0_0_80px_rgba(139,92,246,0.8)] hover:scale-105 active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12" />
                  Start Your Free Interview <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform relative z-10" />
                </button>
              </Link>
              <button onClick={() => setShowDemoModal(true)} className="w-full sm:w-auto px-12 py-6 bg-zinc-900/80 border border-white/10 hover:bg-zinc-800 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-3 backdrop-blur-md hover:scale-105 active:scale-95 hover:border-white/20 group">
                <PlayCircle className="w-6 h-6 text-zinc-400 group-hover:text-white transition-colors" /> Watch Demo
              </button>
            </div>
          </motion.div>
        </section>

      </main>

      {/* Demo Cinematic Modal */}
      <AnimatePresence>
        {showDemoModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDemoModal(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-3xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl aspect-video bg-zinc-950 border border-white/10 rounded-[2rem] shadow-[0_0_150px_rgba(139,92,246,0.15)] overflow-hidden z-10 flex items-center justify-center group"
            >
              <button 
                onClick={() => setShowDemoModal(false)}
                className="absolute top-6 right-6 w-12 h-12 rounded-full bg-zinc-900/80 border border-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/10 transition-colors z-20 text-zinc-400 hover:text-white hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center">
                <video 
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  playsInline
                  src="/demo.mp4"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-12 text-center text-zinc-500 text-sm relative z-10 bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-2 opacity-50 grayscale">
           <Image src="/logo.png" alt="HireMind AI Logo" width={24} height={24} />
           <span className="font-bold">HireMind AI</span>
        </div>
        <p>© {new Date().getFullYear()} HireMind AI. All rights reserved.</p>
      </footer>
      
    </div>
  );
}
