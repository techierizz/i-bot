"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, ChevronRight, Settings, Briefcase, Code, Terminal, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "../config";

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
      
      // Store the parsed context in localStorage or a global state manager for the interview page
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
    <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-6xl mx-auto min-h-screen">
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Configure Your Interview</h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Upload your resume and select the interview parameters. HireMind AI will automatically extract your context and tailor the questions to your specific background.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        
        {/* Step 1: Resume Upload */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 flex flex-col h-full"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">1</div>
            <h2 className="text-2xl font-semibold">Upload Resume</h2>
          </div>
          
          <div 
            className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 transition-colors ${
              isDragging ? "border-primary-500 bg-primary-500/10" : 
              file ? "border-green-500/50 bg-green-500/5" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"
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
              <div className="flex flex-col items-center text-center">
                <FileText className="w-16 h-16 text-green-400 mb-4" />
                <h3 className="text-xl font-medium text-zinc-200">{file.name}</h3>
                <p className="text-zinc-400 mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="mt-6 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center cursor-pointer">
                <Upload className={`w-16 h-16 mb-4 ${isDragging ? "text-primary-400" : "text-zinc-500"}`} />
                <h3 className="text-xl font-medium text-zinc-300 mb-2">Drag & drop your PDF</h3>
                <p className="text-zinc-500">or click to browse files</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Step 2: Configuration */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-6"
        >
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">2</div>
              <h2 className="text-2xl font-semibold">Interview Mode</h2>
            </div>
            
            <div className="grid gap-3">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMode(m.id)}
                  className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                    selectedMode === m.id 
                      ? "border-primary-500 bg-primary-500/10 shadow-[0_0_15px_rgba(139,92,246,0.1)]" 
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800"
                  }`}
                >
                  <div className={`mt-0.5 ${selectedMode === m.id ? "text-primary-400" : "text-zinc-400"}`}>
                    {m.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-100">{m.id}</h3>
                    <p className="text-sm text-zinc-400 mt-1">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-8 flex-1">
            <h3 className="text-lg font-medium text-zinc-300 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Interviewer Persona
            </h3>
            <div className="flex flex-wrap gap-3">
              {personas.map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPersona(p)}
                  className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                    selectedPersona === p 
                      ? "border-primary-500 bg-primary-500/20 text-primary-300" 
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500"
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-12 w-full flex justify-end"
      >
        <button
          onClick={handleSubmit}
          disabled={!file || isUploading || uploadSuccess}
          className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all ${
            uploadSuccess ? "bg-green-500 text-black" :
            !file 
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
              : "bg-primary-500 hover:bg-primary-400 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transform hover:-translate-y-1"
          }`}
        >
          {uploadSuccess ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Processing Complete
            </>
          ) : isUploading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Parsing Resume...
            </div>
          ) : (
            <>
              Start Interview
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </motion.div>
      
    </div>
  );
}
