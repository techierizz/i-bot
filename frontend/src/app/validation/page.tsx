"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "../config";
import { CheckCircle, AlertTriangle, UploadCloud, FileText, ChevronRight, Loader2, ShieldCheck, XCircle, Shield, Search, Brain } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Experience {
  id: number;
  company: string;
  role: string;
  start_date: string;
  end_date: string;
  verification_status: "Pending" | "Verified" | "Rejected";
  fraud_reason?: string;
}

function ValidationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromProfile = searchParams.get("from") === "profile";

  const [user, setUser] = useState<any>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI Phases: "celebration" -> "validation"
  const [phase, setPhase] = useState<"celebration" | "validation">(fromProfile ? "validation" : "celebration");
  
  // Upload states mapping exp.id -> File
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File>>({});
  const [validatingExpId, setValidatingExpId] = useState<number | null>(null);
  const [validationTimeline, setValidationTimeline] = useState<{ step: number; status: "loading" | "success" | "error" } | null>(null);
  const [validationAlert, setValidationAlert] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) {
      router.push("/login?redirect=/validation");
      return;
    }
    const parsedUser = JSON.parse(session);
    setUser(parsedUser);
    
    // Fetch experiences
    fetch(`${API_BASE_URL}/api/user/${parsedUser.id}/experiences`)
      .then(r => r.json())
      .then(data => {
        if (data.status === "success") {
          const exps = data.data.experiences;
          if (exps.length === 0) {
            // Freshers skip validation
            router.push("/results");
          } else {
            setExperiences(exps);
            setIsLoading(false);
            
            // Trigger phase transition after 3 seconds if not from profile
            if (!fromProfile) {
              setTimeout(() => {
                setPhase("validation");
              }, 3000);
            }
          }
        }
      })
      .catch(err => {
        console.error("Error fetching experiences:", err);
        router.push("/profile");
      });
  }, [router]);

  const handleFileSelect = (expId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file (PNG, JPG, etc).");
        return;
      }
      setSelectedFiles(prev => ({ ...prev, [expId]: file }));
    }
  };

  const handleValidate = async (expId: number) => {
    const file = selectedFiles[expId];
    if (!file || !user) return;

    setValidatingExpId(expId);
    setValidationTimeline({ step: 1, status: "loading" });
    setValidationAlert(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("experience_id", expId.toString());
    formData.append("user_id", user.id.toString());

    try {
      const fetchPromise = fetch(`${API_BASE_URL}/api/experiences/validate`, {
        method: "POST",
        body: formData
      });

      // Timeline Animation Sync
      // Step 1: Initializing secure connection
      await new Promise(r => setTimeout(r, 1000));
      setValidationTimeline({ step: 2, status: "loading" });
      
      // Step 2: Querying Google Search databases
      await new Promise(r => setTimeout(r, 1500));
      setValidationTimeline({ step: 3, status: "loading" });
      
      // Step 3: Forensic Visual Analysis (wait for actual response)
      const res = await fetchPromise;
      const data = await res.json();
      
      if (res.ok && data.status === "success") {
        if (data.is_valid) {
          setValidationTimeline({ step: 3, status: "success" });
          await new Promise(r => setTimeout(r, 800)); // Brief pause to show green
          setValidationTimeline(null);
          setExperiences(prev => prev.map(exp => exp.id === expId ? { ...exp, verification_status: "Verified" } : exp));
        } else {
          setValidationTimeline({ step: 3, status: "error" });
          await new Promise(r => setTimeout(r, 1000)); // Show red before disappearing
          setValidationTimeline(null);
          
          const isFraudulent = data.message.includes("FRAUDULENT");
          setValidationAlert({ 
            type: isFraudulent ? "error" : "warning", 
            message: data.message 
          });
          setExperiences(prev => prev.filter(exp => exp.id !== expId));
        }
      } else {
        throw new Error(data.detail || data.message || "Validation failed due to server error.");
      }
    } catch (err: any) {
      console.error(err);
      setValidationTimeline({ step: 3, status: "error" });
      await new Promise(r => setTimeout(r, 1000));
      setValidationTimeline(null);
      setValidationAlert({ type: "error", message: err.message || "Network error during validation." });
    } finally {
      setValidatingExpId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-4" />
        <p className="text-zinc-500 font-medium">Checking credentials...</p>
      </div>
    );
  }

  const allVerified = experiences.every(exp => exp.verification_status === "Verified");

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-950 text-white overflow-hidden relative selection:bg-primary-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-5xl mx-auto min-h-screen relative z-10">
        
        {/* Custom Alert Modal */}
        <AnimatePresence>
          {validationAlert && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className={`w-full max-w-md bg-zinc-900 border rounded-2xl p-6 shadow-2xl ${
                  validationAlert.type === 'error' 
                    ? 'border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.1)]' 
                    : 'border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.1)]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-full shrink-0 ${
                    validationAlert.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold mb-2 ${
                      validationAlert.type === 'error' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {validationAlert.type === 'error' ? 'Fraud Detected' : 'Validation Warning'}
                    </h3>
                    <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                      {validationAlert.message}
                    </p>
                    <button 
                      onClick={() => setValidationAlert(null)}
                      className={`w-full py-3 rounded-xl font-bold transition-all ${
                        validationAlert.type === 'error' 
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30' 
                          : 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      }`}
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence mode="wait">
          {phase === "celebration" && (
            <motion.div
              key="celebration"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -50, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-center flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mb-8 shadow-[0_0_80px_rgba(16,185,129,0.5)]">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-green-500 drop-shadow-lg">
                Interview Completed!
              </h1>
              <p className="text-xl md:text-2xl text-zinc-400 font-medium max-w-2xl mx-auto">
                Excellent work. Your technical performance has been recorded.
              </p>
            </motion.div>
          )}

          {phase === "validation" && (
            <motion.div
              key="validation"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full flex flex-col items-center relative"
            >
              {fromProfile && (
                <button
                  onClick={() => router.push("/profile")}
                  className="absolute -top-4 left-0 md:-left-8 p-2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                  title="Back to Profile"
                >
                  <XCircle className="w-8 h-8" />
                </button>
              )}
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight text-white">
                  Experience Validation
                </h1>
                <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                  HireMind maintains a high-trust ecosystem. Please upload your digital certificates, offer letters, or verification IDs for the experiences you claimed. 
                  <span className="block mt-2 text-yellow-500 font-semibold text-sm">
                    ⚠️ Note: You may skip this step and complete it later from your profile, but your I-Card will be marked as "Verification Pending".
                  </span>
                </p>
              </div>

              <div className="w-full max-w-3xl space-y-6">
                {experiences.map(exp => (
                  <div key={exp.id} className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden relative">
                    {/* Background gradient hint based on status */}
                    <div className={`absolute inset-0 opacity-10 pointer-events-none transition-colors duration-500 ${
                      exp.verification_status === "Verified" ? "bg-emerald-500" :
                      exp.verification_status === "Rejected" ? "bg-red-500" : "bg-transparent"
                    }`} />
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-1">{exp.role}</h3>
                        <p className="text-primary-400 font-medium text-lg mb-2">{exp.company}</p>
                        <p className="text-sm text-zinc-500 font-mono bg-black/40 inline-block px-3 py-1 rounded-lg">
                          {exp.start_date || "Unknown"} — {exp.end_date || "Present"}
                        </p>
                      </div>
                      
                      <div className="flex-shrink-0 flex items-center justify-end">
                        {exp.verification_status === "Verified" ? (
                          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                            <ShieldCheck className="w-10 h-10 text-emerald-400 mb-2" />
                            <span className="text-emerald-400 font-bold text-sm tracking-widest uppercase">Verified</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 min-w-[220px]">
                            <label className="relative flex items-center justify-center px-4 py-3 bg-zinc-950 border border-zinc-700 hover:border-primary-500 hover:bg-zinc-900 rounded-xl cursor-pointer transition-all group">
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleFileSelect(exp.id, e)} 
                                disabled={validatingExpId === exp.id}
                              />
                              <div className="flex items-center gap-2 text-zinc-300 group-hover:text-primary-400">
                                {selectedFiles[exp.id] ? (
                                  <>
                                    <FileText className="w-5 h-5" />
                                    <span className="text-sm font-medium truncate max-w-[120px]">{selectedFiles[exp.id].name}</span>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud className="w-5 h-5" />
                                    <span className="text-sm font-medium">Select Certificate</span>
                                  </>
                                )}
                              </div>
                            </label>
                            
                            {validatingExpId === exp.id ? (
                              <div className="w-full flex flex-col gap-3 p-4 bg-zinc-950/50 rounded-xl border border-primary-500/20 relative overflow-hidden">
                                <div className="absolute inset-0 bg-primary-500/5 animate-pulse pointer-events-none" />
                                
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${validationTimeline?.step && validationTimeline.step >= 1 ? (validationTimeline.step === 1 && validationTimeline.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-primary-500/20 text-primary-400') : 'bg-zinc-800 text-zinc-500'}`}>
                                    {validationTimeline?.step === 1 && validationTimeline.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                  </div>
                                  <span className={`text-sm font-medium ${validationTimeline?.step && validationTimeline.step >= 1 ? (validationTimeline.step === 1 && validationTimeline.status === 'error' ? 'text-red-400' : 'text-primary-300') : 'text-zinc-500'}`}>Initializing connection...</span>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${validationTimeline?.step && validationTimeline.step >= 2 ? (validationTimeline.step === 2 && validationTimeline.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-primary-500/20 text-primary-400') : 'bg-zinc-800 text-zinc-500'}`}>
                                    {validationTimeline?.step === 2 && validationTimeline.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                  </div>
                                  <span className={`text-sm font-medium ${validationTimeline?.step && validationTimeline.step >= 2 ? (validationTimeline.step === 2 && validationTimeline.status === 'error' ? 'text-red-400' : 'text-primary-300') : 'text-zinc-500'}`}>Querying online databases...</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${validationTimeline?.step && validationTimeline.step >= 3 ? (validationTimeline.status === 'error' ? 'bg-red-500/20 text-red-400' : (validationTimeline.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary-500/20 text-primary-400')) : 'bg-zinc-800 text-zinc-500'}`}>
                                    {validationTimeline?.step === 3 && validationTimeline.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                                  </div>
                                  <span className={`text-sm font-medium ${validationTimeline?.step && validationTimeline.step >= 3 ? (validationTimeline.status === 'error' ? 'text-red-400' : (validationTimeline.status === 'success' ? 'text-emerald-400' : 'text-primary-300')) : 'text-zinc-500'}`}>Forensic visual analysis...</span>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleValidate(exp.id)}
                                disabled={!selectedFiles[exp.id]}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                                  !selectedFiles[exp.id]
                                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                    : "bg-primary-600 hover:bg-primary-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                                }`}
                              >
                                Run AI Validation
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {experiences.length === 0 && (
                  <div className="text-center p-8 bg-zinc-900/50 rounded-2xl border border-white/5">
                    <p className="text-zinc-400">All uploaded experiences processed.</p>
                  </div>
                )}
              </div>

              {!fromProfile && (
                <div className="mt-12">
                  <button
                    onClick={() => router.push("/results")}
                    className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg transition-all ${
                      allVerified 
                        ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]" 
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                    }`}
                  >
                    {allVerified ? "Go to Results" : "Skip to Results"}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function ValidationPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-4" />
        <p className="text-zinc-500 font-medium">Loading...</p>
      </div>
    }>
      <ValidationContent />
    </Suspense>
  );
}
