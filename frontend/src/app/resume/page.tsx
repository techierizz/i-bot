"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, CheckCircle, AlertTriangle, ArrowLeft, Loader2, ChevronRight, Briefcase } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "../config";
// We import pdfjsLib dynamically inside the function to avoid SSR module not found errors.

export default function ResumeHub() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [resumeData, setResumeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Upload states
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) {
      router.push("/login?redirect=/resume");
      return;
    }
    const parsedUser = JSON.parse(session);
    setUser(parsedUser);

    fetch(`${API_BASE_URL}/api/resume/${parsedUser.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === "success" && data.data) {
          setResumeData(data.data);
        }
      })
      .catch(err => console.error("Error fetching resume:", err))
      .finally(() => setIsLoading(false));
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    // @ts-ignore
    const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      let rawText = "";
      if (file.type === "application/pdf") {
        rawText = await extractTextFromPDF(file);
      } else {
        rawText = await file.text();
      }

      if (rawText.trim().length < 50) {
        throw new Error("Resume appears to be empty or unreadable.");
      }

      const res = await fetch(`${API_BASE_URL}/api/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          raw_text: rawText
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to parse resume");

      // Reload page to show new ATS feedback
      window.location.reload();
      
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "An error occurred while analyzing the resume.");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  const feedback = resumeData?.ats_feedback_json;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12 relative overflow-hidden">
      {/* Back Link */}
      <Link href="/profile" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 relative z-10">
        <ArrowLeft className="w-4 h-4" />
        Back to Profile
      </Link>

      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 mb-2">
              My Resume
            </h1>
            <p className="text-zinc-400 text-lg">
              Manage your master resume and view ATS Optimization insights.
            </p>
          </div>
          <Link href="/interview" className="px-6 py-3 bg-white text-black font-semibold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all flex items-center gap-2">
            Start Interview <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Upload Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-primary-400" />
                Upload New Resume
              </h2>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-primary-500/50 hover:bg-white/5 transition-all cursor-pointer relative">
                  <input 
                    type="file" 
                    accept=".pdf,.txt" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileText className="w-10 h-10 text-zinc-500 mb-3" />
                  <p className="text-sm text-zinc-300 font-medium">
                    {file ? file.name : "Click or drag PDF here"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">PDF or TXT up to 5MB</p>
                </div>

                {uploadError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{uploadError}</p>
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                  ) : (
                    "Analyze with AI"
                  )}
                </button>
              </div>
            </div>

            {resumeData && (
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 text-sm">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-semibold">Resume Active</span>
                </div>
                <p className="text-zinc-400">
                  Last updated: {new Date(resumeData.created_at).toLocaleDateString()}
                </p>
                <p className="text-zinc-500 mt-2 text-xs">
                  This resume will automatically be used for your next interview unless you upload a new one.
                </p>
              </div>
            )}
          </div>

          {/* Feedback Column */}
          <div className="lg:col-span-2">
            {!feedback ? (
              <div className="h-full min-h-[400px] border border-white/5 bg-zinc-900/30 rounded-3xl flex flex-col items-center justify-center text-center p-8">
                <Briefcase className="w-12 h-12 text-zinc-700 mb-4" />
                <h3 className="text-xl font-medium text-zinc-300">No ATS Feedback Yet</h3>
                <p className="text-zinc-500 max-w-sm mt-2">
                  Upload your resume on the left to receive a comprehensive ATS (Applicant Tracking System) optimization report.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Score Impact */}
                <div className="bg-gradient-to-br from-emerald-950/40 to-zinc-900/40 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-emerald-400 font-semibold flex items-center gap-2 mb-1">
                      <CheckCircle className="w-5 h-5" />
                      ATS Optimization Ready
                    </h3>
                    <p className="text-zinc-400 text-sm">Applying these changes will improve your parse rate.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">+{feedback.ats_score_impact}%</div>
                    <div className="text-xs text-emerald-500 font-medium tracking-wider uppercase">Score Impact</div>
                  </div>
                </div>

                {/* Line Mods */}
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-white">Suggested Rewrites</h3>
                  <div className="space-y-4">
                    {feedback.line_modifications?.map((mod: any, i: number) => (
                      <div key={i} className="bg-zinc-950/50 rounded-xl p-4 border border-white/5">
                        <div className="mb-3">
                          <span className="text-xs text-red-400 font-medium uppercase tracking-wider mb-1 block">Original</span>
                          <p className="text-zinc-400 text-sm line-through decoration-red-500/50">{mod.exact_line}</p>
                        </div>
                        <div className="mb-3">
                          <span className="text-xs text-emerald-400 font-medium uppercase tracking-wider mb-1 block">Better</span>
                          <p className="text-white text-sm font-medium">{mod.suggested_change}</p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-zinc-400">{mod.modification_reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* General Tips */}
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-white">Formatting Tips</h3>
                  <ul className="space-y-3">
                    {feedback.top_tips?.map((tip: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        <span className="pt-0.5">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
