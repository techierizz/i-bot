"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, ChevronRight, Settings, Briefcase, Code, Terminal, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "../config";
import Link from "next/link";
import Image from "next/image";

export default function SetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [candidateUser, setCandidateUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) {
      router.push("/login?redirect=/setup");
      return;
    }
    setCandidateUser(JSON.parse(session));
    setIsCheckingAuth(false);
  }, [router]);
  
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  const [selectedMode, setSelectedMode] = useState("General");
  const [selectedPersona, setSelectedPersona] = useState("Friendly");
  
  const modes = [
    { id: "General", icon: <Briefcase className="w-5 h-5" />, desc: "Standard behavioral and background questions." },
    { id: "Technical", icon: <Code className="w-5 h-5" />, desc: "Deep dive into tech stack and coding concepts." },
    { id: "System Design", icon: <Terminal className="w-5 h-5" />, desc: "Architecture, scalability, and system tradeoffs." },
  ];
  
  const personas = ["Friendly", "Strict", "Fast-paced"];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        alert("Please upload a PDF file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", selectedMode);
    formData.append("persona", selectedPersona);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/setup/upload`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload");
      }
      
      const data = await response.json();
      console.log("Upload Success:", data);
      
      localStorage.setItem("hiremind_context", JSON.stringify({
        ...data.data.extracted_context,
        user_id: candidateUser?.id,
        username: candidateUser?.username
      }));
      localStorage.setItem("hiremind_config", JSON.stringify({ 
        mode: selectedMode, 
        persona: selectedPersona,
        user_id: candidateUser?.id,
        username: candidateUser?.username
      }));
      
      setUploadSuccess(true);
      setTimeout(() => {
        router.push("/interview");
      }, 1500);
      
    } catch (error) {
      console.error("Error uploading:", error);
      alert("Error processing the resume. Make sure the backend is running!");
      setIsUploading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950 text-white min-h-screen">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-zinc-500 font-medium">Validating candidate session...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-950 text-white overflow-hidden selection:bg-primary-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/30 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-600/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Top Header */}
      <header className="w-full bg-zinc-950/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 fixed top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center w-full">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-6xl mx-auto min-h-screen pt-32 relative z-10">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/80 border border-primary-500/30 text-primary-300 text-sm font-medium mb-6 backdrop-blur-sm">
             Step 1 of 2
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-secondary-400">
              Configure Your Interview
            </span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Upload your resume and select the interview parameters. HireMind AI will automatically extract your context and tailor the questions to your specific background.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          
          {/* Step 1: Resume Upload */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl bg-zinc-900/40 border border-white/5 p-8 flex flex-col h-full hover:border-primary-500/30 transition-all shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">1</div>
              <h2 className="text-3xl font-bold">Upload Resume</h2>
            </div>
            
            <div 
              className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 transition-all duration-300 ${
                isDragging ? "border-primary-500 bg-primary-500/10 scale-105" : 
                file ? "border-green-500/50 bg-green-500/5 shadow-[0_0_30px_rgba(34,197,94,0.1)]" : "border-zinc-700 hover:border-primary-500/50 hover:bg-zinc-800/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".pdf" 
                className="hidden" 
              />
              
              {file ? (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/50">
                    <FileText className="w-10 h-10 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{file.name}</h3>
                  <p className="text-zinc-400 mt-2 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="mt-6 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/20 hover:text-red-300 transition-colors"
                  >
                    Remove file
                  </button>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center text-center cursor-pointer">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${isDragging ? "bg-primary-500/20" : "bg-zinc-800"}`}>
                    <Upload className={`w-10 h-10 ${isDragging ? "text-primary-400" : "text-zinc-400"}`} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Drag & drop your PDF</h3>
                  <p className="text-zinc-400 text-lg">or click to browse files</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Step 2: Configuration */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-6"
          >
            <div className="rounded-3xl bg-zinc-900/40 border border-white/5 p-8 shadow-2xl backdrop-blur-xl hover:border-secondary-500/30 transition-all">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-secondary-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">2</div>
                <h2 className="text-3xl font-bold">Interview Mode</h2>
              </div>
              
              <div className="grid gap-4">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMode(m.id)}
                    className={`flex items-start gap-5 p-5 rounded-2xl border text-left transition-all duration-300 ${
                      selectedMode === m.id 
                        ? "border-secondary-500 bg-secondary-500/10 shadow-[0_0_20px_rgba(217,70,239,0.15)] scale-[1.02]" 
                        : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-600 hover:bg-zinc-800"
                    }`}
                  >
                    <div className={`mt-1 p-2 rounded-xl ${selectedMode === m.id ? "bg-secondary-500/20 text-secondary-400" : "bg-zinc-800 text-zinc-400"}`}>
                      {m.icon}
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${selectedMode === m.id ? "text-white" : "text-zinc-300"}`}>{m.id}</h3>
                      <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-900/40 border border-white/5 p-8 flex-1 shadow-2xl backdrop-blur-xl hover:border-emerald-500/30 transition-all">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400"><Settings className="w-5 h-5" /></div>
                Interviewer Persona
              </h3>
              <div className="flex flex-wrap gap-4">
                {personas.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPersona(p)}
                    className={`px-6 py-3 rounded-xl border text-base font-semibold transition-all duration-300 ${
                      selectedPersona === p 
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                        : "border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

        </div>

        {/* Action Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-16 w-full flex justify-end mb-16"
        >
          <button
            onClick={handleSubmit}
            disabled={!file || isUploading || uploadSuccess}
            className={`flex items-center justify-center gap-3 px-10 py-5 rounded-2xl font-black text-xl transition-all duration-300 w-full md:w-auto ${
              uploadSuccess ? "bg-green-500 text-zinc-950 shadow-[0_0_40px_rgba(34,197,94,0.4)]" :
              !file 
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700" 
                : "bg-gradient-to-r from-primary-600 to-secondary-600 text-white shadow-[0_0_40px_rgba(139,92,246,0.3)] hover:shadow-[0_0_60px_rgba(139,92,246,0.5)] transform hover:scale-105 active:scale-95 cursor-pointer"
            }`}
          >
            {uploadSuccess ? (
              <>
                <CheckCircle2 className="w-6 h-6" />
                Processing Complete
              </>
            ) : isUploading ? (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                Parsing Resume...
              </div>
            ) : (
              <>
                Start Interview
                <ChevronRight className="w-6 h-6" />
              </>
            )}
          </button>
        </motion.div>
      </main>
    </div>
  );
}
