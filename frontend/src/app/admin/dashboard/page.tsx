"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Layers,
  BarChart3,
  Trash2,
  Eye,
  LogOut,
  BrainCircuit,
  Search,
  Settings,
  Sliders,
  Activity,
  X,
  CheckCircle,
  FileText,
  ShieldAlert,
  Trophy,
  Crown,
  Medal,
  Award,
  Download
} from "lucide-react";
import { API_BASE_URL } from "../../config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EvaluationScores {
  technical: number;
  communication: number;
  confidence: number;
  problem_solving: number;
  overall: number;
}

interface EvaluationRecord {
  id: number;
  user_id: number;
  username: string;
  mode: string;
  overall: number;
  technical: number;
  communication: number;
  confidence: number;
  problem_solving: number;
  transcript: any[];
  evaluation_data: any;
  created_at: string;
}

export default function AdminDashboard() {
  const router = useRouter();

  // States
  const [adminUser, setAdminUser] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>({
    total_interviews: 0,
    total_candidates: 0,
    averages: { overall: 0, technical: 0, communication: 0, confidence: 0, problem_solving: 0 }
  });
  const [candidates, setCandidates] = useState<EvaluationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<EvaluationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptTemp, setPromptTemp] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("");
  
  // Leaderboard & Neon Modal States
  const [activeTab, setActiveTab] = useState<"logs" | "leaderboard">("logs");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedNeonCandidate, setSelectedNeonCandidate] = useState<any | null>(null);
  const [neonStatsLoading, setNeonStatsLoading] = useState(false);

  // Authenticate admin on mount
  useEffect(() => {
    const adminSession = localStorage.getItem("hiremind_admin");
    if (!adminSession) {
      router.push("/admin/login");
      return;
    }
    setAdminUser(JSON.parse(adminSession));
    fetchDashboardData();
  }, [router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch metrics
      const metricsRes = await fetch(`${API_BASE_URL}/api/admin/metrics`);
      const metricsData = await metricsRes.json();
      if (metricsRes.ok) setMetrics(metricsData);

      // Fetch candidates log
      const candidatesRes = await fetch(`${API_BASE_URL}/api/admin/candidates`);
      const candidatesData = await candidatesRes.json();
      if (candidatesRes.ok) setCandidates(candidatesData);

      // Fetch global leaderboard
      const lbRes = await fetch(`${API_BASE_URL}/api/leaderboard`);
      if (lbRes.ok) setLeaderboard(await lbRes.json());

      // Fetch settings
      const settingsRes = await fetch(`${API_BASE_URL}/api/admin/settings`);
      const settingsData = await settingsRes.json();
      if (settingsRes.ok) {
        setPromptTemp(settingsData.prompt_temp);
        setSystemPrompt(settingsData.system_prompt);
      }

    } catch (err) {
      console.error("Error loading admin data: ", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("hiremind_admin");
    router.push("/admin/login");
  };

  const handleDownloadPDF = (record: any) => {
    if (!record) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Title & Header
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text("Simulation Evaluation Report", 14, 22);

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Candidate: ${record.username}`, 14, 32);
    doc.text(`Simulation Mode: ${record.mode}`, 14, 38);
    
    // Scores Section
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Score Distribution", 14, 52);

    autoTable(doc, {
      startY: 56,
      head: [["Metric", "Score / 100"]],
      body: [
        ["Overall Performance", `${record.overall}`],
        ["Technical Skill", `${record.technical}`],
        ["Communication", `${record.communication}`],
        ["Confidence", `${record.confidence}`],
        ["Problem Solving", `${record.problem_solving}`]
      ],
      theme: "grid",
      headStyles: { fillColor: [147, 51, 234], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      styles: { fontSize: 11, cellPadding: 4 }
    });

    // Executive Summary
    const finalY = (doc as any).lastAutoTable.finalY || 56;
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Executive Summary", 14, finalY + 16);
    
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    const summaryText = record.evaluation_data?.feedback?.overall_summary || "No executive summary available for this simulation run.";
    const splitSummary = doc.splitTextToSize(summaryText, pageWidth - 28);
    doc.text(splitSummary, 14, finalY + 24);

    const summaryHeight = splitSummary.length * 5;
    
    // Transcript Log
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Simulation Transcript Log", 14, finalY + 24 + summaryHeight + 10);

    const transcriptBody = record.transcript.map((t: any) => [
      t.role === "assistant" || t.role === "interviewer" ? "Interviewer" : "Candidate",
      t.content
    ]);

    autoTable(doc, {
      startY: finalY + 24 + summaryHeight + 16,
      head: [["Role", "Message"]],
      body: transcriptBody,
      theme: "grid",
      styles: { cellPadding: 5, overflow: "linebreak", fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: "bold", textColor: [147, 51, 234] },
        1: { cellWidth: "auto", textColor: [60, 60, 60] }
      },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`${record.username}_Simulation_Report.pdf`);
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_temp: promptTemp,
          system_prompt: systemPrompt
        })
      });
      if (res.ok) {
        alert("Global configuration (Temperature & Prompt) saved successfully.");
      }
    } catch (err) {
      console.error("Failed to save settings", err);
    }
  };

  const handleApplyPrompt = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt
        })
      });
      if (res.ok) {
        alert("System prompt override applied globally.");
      }
    } catch (err) {
      console.error("Failed to apply prompt", err);
    }
  };

  const handleClearPrompt = async () => {
    setSystemPrompt("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: ""
        })
      });
      if (res.ok) {
        alert("System prompt override cleared. Default instructions will be used.");
      }
    } catch (err) {
      console.error("Failed to clear prompt", err);
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this candidate evaluation run?")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/evaluation/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setCandidates(candidates.filter(c => c.id !== id));
        // Refresh metrics
        const metricsRes = await fetch(`${API_BASE_URL}/api/admin/metrics`);
        const metricsData = await metricsRes.json();
        if (metricsRes.ok) setMetrics(metricsData);
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail}`);
      }
    } catch (e) {
      console.error(e);
    }
  };
  const handleOpenNeonModal = async (candidate: any) => {
    setSelectedNeonCandidate({ ...candidate, stats: null });
    setNeonStatsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${candidate.user_id}/stats`);
      const data = await res.json();
      if (data.status === "success") {
        setSelectedNeonCandidate({ ...candidate, stats: data.data });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNeonStatsLoading(false);
    }
  };

  // Filter candidates log
  const filteredCandidates = candidates.filter(c => {
    if (selectedCandidate && c.username !== selectedCandidate) return false;
    return c.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
           c.mode.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const uniqueCandidates = Array.from(new Set(candidates.map(c => c.username)));

  // SVG Radar grid formulas
  const center = 170;
  const radius = 80;
  const dimensions = [
    { key: "technical", label: "Technical Skill" },
    { key: "communication", label: "Communication" },
    { key: "confidence", label: "Confidence" },
    { key: "problem_solving", label: "Problem Solving" },
    { key: "overall", label: "Overall" },
  ];

  const getCoordinates = (scores: any, offsetMultiplier = 1) => {
    const keys = ["technical", "communication", "confidence", "problem_solving", "overall"];
    return keys.map((key, i) => {
      const angle = (i * 72 - 90) * (Math.PI / 180);
      const val = scores ? (scores[key] || 0) : 0;
      const dist = (val / 100) * radius * offsetMultiplier;
      return {
        x: center + dist * Math.cos(angle),
        y: center + dist * Math.sin(angle),
      };
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#050505] text-white relative">
      {/* Deep premium background texture */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[600px] bg-[radial-gradient(ellipse_100%_100%_at_50%_-20%,rgba(185,28,28,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.1] mix-blend-overlay" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header bar */}
        <header className="sticky top-0 z-40 bg-zinc-950/75 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-red-400 to-zinc-600 tracking-tighter drop-shadow-sm">
                HireMind
              </h1>
            </div>
          </div>

          {/* Centered Admin Portal */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500/80 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-500 uppercase tracking-[0.3em] drop-shadow-sm">Admin Portal</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider mt-1">Welcome, {adminUser?.username || "Admin"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-zinc-900 border border-white/5 hover:border-red-500/30 hover:bg-red-500/10 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-red-400 transition-all flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Main dashboard content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">

          {/* Metric widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              icon={<Users className="w-6 h-6 text-red-400" />}
              title="Total Candidates"
              value={metrics.total_candidates}
              sub="Unique candidate logins"
            />
            <MetricCard
              icon={<Layers className="w-6 h-6 text-amber-400" />}
              title="Interviews Conducted"
              value={metrics.total_interviews}
              sub="Concluded simulations"
            />
            <MetricCard
              icon={<BarChart3 className="w-6 h-6 text-emerald-400" />}
              title="Average Overall Score"
              value={`${metrics.averages.overall}/100`}
              sub="Global success average"
            />
            <MetricCard
              icon={<Activity className="w-6 h-6 text-blue-400" />}
              title="Average Technical Index"
              value={`${metrics.averages.technical}%`}
              sub="Tech competency rating"
            />
          </div>

          {/* Dashboard Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Tabs for Candidates Log / Leaderboard */}
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-6">
              
              <div className="flex bg-zinc-900/60 p-1.5 rounded-2xl border border-white/5 w-full max-w-sm mb-2">
                {[
                  { id: "logs", label: "Simulation Logs", icon: FileText },
                  { id: "leaderboard", label: "Global Leaderboard", icon: Crown },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                        isActive ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? "text-red-400" : ""}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === "logs" ? (
                <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  {selectedCandidate ? (
                    <>
                      <button
                        onClick={() => {
                          setSelectedCandidate(null);
                          setSearchQuery("");
                        }}
                        className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-2xl font-black mb-1"
                        title="Back"
                      >
                        ←
                      </button>
                      <h2 className="text-xl font-black text-white uppercase tracking-widest">{selectedCandidate}</h2>
                    </>
                  ) : (
                    <h2 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      Candidate Simulation Logs
                    </h2>
                  )}
                </div>

                {/* Search - Only show if a candidate is selected */}
                {selectedCandidate && (
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 w-4 h-4 text-zinc-500 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="search runs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-zinc-500">Querying candidate tables...</p>
                </div>
              ) : selectedCandidate === null ? (
                <div className="flex flex-wrap gap-4 pt-4">
                  {uniqueCandidates.map(username => (
                    <div 
                      key={username}
                      onClick={() => setSelectedCandidate(username)}
                      className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-zinc-900/80 border border-white/5 hover:border-red-500/50 hover:bg-red-500/10 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all cursor-pointer group/pill"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-xs font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.6)] group-hover/pill:animate-pulse">
                        {username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-white text-sm tracking-wide group-hover/pill:text-red-300 transition-colors pr-2">
                        {username}
                      </span>
                    </div>
                  ))}
                  {uniqueCandidates.length === 0 && (
                    <div className="w-full text-center py-20 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                      <p className="text-sm text-zinc-500">No candidates have completed simulations yet.</p>
                    </div>
                  )}
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                  <p className="text-sm text-zinc-500">No matching simulation records found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Candidate</th>
                        <th className="pb-3 font-semibold">Mode</th>
                        <th className="pb-3 font-semibold text-center">Overall</th>
                        <th className="pb-3 font-semibold text-center">Tech</th>
                        <th className="pb-3 font-semibold text-center">Comm</th>
                        <th className="pb-3 font-semibold text-center">Date</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredCandidates.map((c) => (
                        <tr key={c.id} className="group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
                          <td className="py-4 px-2">
                            <div 
                              onClick={() => setSearchQuery(c.username)}
                              title="Click to filter by this candidate"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/5 hover:border-red-500/50 hover:bg-red-500/10 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all cursor-pointer group/pill"
                            >
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-[10px] font-black text-white shadow-[0_0_8px_rgba(239,68,68,0.8)] group-hover/pill:animate-pulse">
                                {c.username.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold text-white text-xs tracking-wide group-hover/pill:text-red-300 transition-colors">
                                {c.username}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] text-zinc-300 font-medium tracking-wide">
                              {c.mode}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-center">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide ${c.overall >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                c.overall >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                  'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                              {c.overall}/100
                            </span>
                          </td>
                          <td className="py-4 px-2 text-center text-zinc-400 font-mono text-[10px]">{c.technical}</td>
                          <td className="py-4 px-2 text-center text-zinc-400 font-mono text-[10px]">{c.communication}</td>
                          <td className="py-4 px-2 text-center text-zinc-500 text-[10px]">{new Date(c.created_at).toLocaleDateString()}</td>
                          <td className="py-4 px-2 text-right flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedRecord(c)}
                              className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-white/20 hover:scale-105 transition-all cursor-pointer shadow-lg"
                              title="Inspect Report"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(c.id)}
                              className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-500 hover:border-red-400 hover:scale-105 transition-all cursor-pointer shadow-lg shadow-red-500/10"
                              title="Delete Run"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </>
            ) : (
                <div className="overflow-x-auto">
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                      <p className="text-sm text-zinc-500">No candidates on the global leaderboard yet.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-wider">
                          <th className="pb-3 font-semibold text-center w-16">Rank</th>
                          <th className="pb-3 font-semibold">Candidate</th>
                          <th className="pb-3 font-semibold">Title</th>
                          <th className="pb-3 font-semibold text-center">Streak</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {leaderboard.map((c, i) => (
                          <tr key={c.user_id} onClick={() => handleOpenNeonModal(c)} className="group hover:bg-white/[0.04] transition-all border-b border-white/5 last:border-0 cursor-pointer">
                            <td className="py-4 px-2 text-center">
                              {i === 0 ? <Crown className="w-5 h-5 mx-auto text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" /> :
                               i === 1 ? <Medal className="w-5 h-5 mx-auto text-zinc-300 drop-shadow-[0_0_8px_rgba(212,212,216,0.6)]" /> :
                               i === 2 ? <Award className="w-5 h-5 mx-auto text-amber-700 drop-shadow-[0_0_8px_rgba(180,83,9,0.6)]" /> :
                              <span className="text-sm font-black text-zinc-500">#{i + 1}</span>}
                            </td>
                            <td className="py-4 px-2">
                              <span className="font-bold text-white text-xs tracking-wide">
                                {c.username}
                              </span>
                            </td>
                            <td className="py-4 px-2">
                              <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] text-zinc-300 font-medium tracking-wide">
                                {c.rank_title}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-center text-orange-400 font-bold text-[10px]">🔥 {c.streak}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Settings panel card (30% width) */}
            <div className="flex flex-col gap-6">

              {/* Global configurations */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-5">
                <div className="flex items-center gap-2 text-red-400">
                  <Settings className="w-5 h-5" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Evaluation Prompt Settings</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1 text-[10px] font-semibold text-zinc-400">
                      <span>LLM GENERATION TEMPERATURE</span>
                      <span className="text-red-400 font-bold">{promptTemp}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={promptTemp}
                      onChange={(e) => setPromptTemp(parseFloat(e.target.value))}
                      className="w-full accent-red-500 cursor-pointer h-1 rounded bg-zinc-800"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-950/50 border border-white/10 space-y-3 relative overflow-hidden group shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    <label className="text-[10px] font-black text-zinc-300 block tracking-widest relative z-10 flex items-center gap-2">
                      <span className="w-1 h-3 bg-red-500 rounded-full inline-block"></span>
                      SYSTEM PROMPT OVERRIDE
                    </label>
                    <textarea
                      rows={4}
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Leave blank for default behavior..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 resize-none leading-relaxed relative z-10 transition-all shadow-inner"
                    />
                    <div className="flex gap-3 relative z-10 pt-1">
                      <button
                        onClick={handleClearPrompt}
                        className="flex-1 py-2 bg-zinc-900/80 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-white/5 hover:border-red-500/30 transition-all cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleApplyPrompt}
                        className="flex-1 py-2 bg-gradient-to-b from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl border border-white/10 hover:border-white/20 transition-all cursor-pointer shadow-md"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2 shadow-lg shadow-red-500/20"
                  >
                    <Sliders className="w-3.5 h-3.5" /> Save Configuration
                  </button>
                </div>
              </div>

              {/* System Health console */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Engine Integrity status
                </h3>
                <div className="space-y-2 text-[11px] text-zinc-500">
                  <div className="flex justify-between">
                    <span>SQLite database</span>
                    <span className="text-emerald-400 font-medium">CONNECTED (hiremind.db)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gemini API Node</span>
                    <span className="text-emerald-400 font-medium">ONLINE (V2.5 FLASH)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Sessions</span>
                    <span className="text-zinc-300">3 current candidate channels</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </main>

        {/* Record Inspection Modal Overlay */}
        <AnimatePresence>
          {selectedRecord && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-4xl bg-[#0B0914]/95 backdrop-blur-3xl border border-purple-500/20 rounded-3xl p-6 md:p-8 shadow-[0_0_60px_rgba(147,51,234,0.15)] relative overflow-hidden flex flex-col max-h-[85vh]"
              >
                {/* Glowing borders */}
                <div className="absolute inset-0 pointer-events-none rounded-3xl border border-transparent [background:linear-gradient(45deg,rgba(59,130,246,0.15),rgba(147,51,234,0.15))_border-box] [mask:linear-gradient(#fff_0_0)_padding-box,linear-gradient(#fff_0_0)] mask-composite-exclude shadow-[inset_0_0_30px_rgba(147,51,234,0.05)]" />

                {/* Actions */}
                <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
                  <button
                    onClick={() => handleDownloadPDF(selectedRecord)}
                    className="p-2.5 rounded-full hover:bg-purple-500/10 border border-transparent hover:border-purple-500/30 hover:text-purple-400 text-zinc-500 transition-all cursor-pointer shadow-inner"
                    title="Download PDF Report"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-2.5 rounded-full hover:bg-red-500/10 border border-transparent hover:border-red-500/30 hover:text-red-400 text-zinc-500 transition-all cursor-pointer shadow-inner"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-8 relative z-10">
                  <span className="px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black tracking-[0.2em] uppercase shadow-[0_0_15px_rgba(147,51,234,0.2)]">
                    Report Inspection
                  </span>
                  <h2 className="text-4xl font-black text-white mt-5 tracking-wide">{selectedRecord.username}</h2>
                  <p className="text-sm text-indigo-300/90 mt-2 uppercase tracking-[0.15em] font-bold">Completed a {selectedRecord.mode} Simulation</p>
                </div>

                {/* Scrollable container for inspection columns */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-6 relative z-10 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

                    {/* Radar Chart */}
                    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-[#13111C]/90 to-[#0A0910]/95 p-8 rounded-[2rem] border border-white/5 shadow-inner hover:border-purple-500/30 transition-all duration-500">
                      <h3 className="text-xs font-black text-indigo-300/80 uppercase tracking-[0.2em] mb-8">Competency Map</h3>
                      <svg viewBox="0 0 340 300" className="w-full max-w-[280px] h-auto overflow-visible">
                        <defs>
                          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#9333ea" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                          </radialGradient>
                        </defs>

                        {/* Concentric pentagon rings */}
                        {[0.2, 0.4, 0.6, 0.8, 1].map((scale, sIdx) => {
                          const levelCoords = getCoordinates(
                            { technical: 100, communication: 100, confidence: 100, problem_solving: 100, overall: 100 },
                            scale
                          );
                          const pathStr = levelCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ") + " Z";
                          return (
                            <path
                              key={sIdx}
                              d={pathStr}
                              fill="none"
                              stroke="rgba(255, 255, 255, 0.05)"
                              strokeWidth="1"
                              strokeDasharray={sIdx !== 4 ? "4 4" : "none"}
                            />
                          );
                        })}

                        {/* Axes */}
                        {getCoordinates({ technical: 100, communication: 100, confidence: 100, problem_solving: 100, overall: 100 }).map((c, i) => (
                          <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={c.x}
                            y2={c.y}
                            stroke="rgba(255, 255, 255, 0.05)"
                            strokeWidth="1"
                          />
                        ))}

                        {/* Filled score polygon */}
                        <path
                          d={
                            getCoordinates(selectedRecord)
                              .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`)
                              .join(" ") + " Z"
                          }
                          fill="url(#radarGlow)"
                          stroke="rgba(147, 51, 234, 0.8)"
                          strokeWidth="2"
                          className="transition-all duration-1000 drop-shadow-[0_0_8px_rgba(147,51,234,0.5)]"
                        />

                        {/* Score vertices */}
                        {getCoordinates(selectedRecord).map((c, i) => (
                          <circle
                            key={i}
                            cx={c.x}
                            cy={c.y}
                            r="4"
                            className="fill-[#0B0914] stroke-blue-400 stroke-[2.5px]"
                          />
                        ))}

                        {/* Outer dimension Labels */}
                        {getCoordinates({ technical: 100, communication: 100, confidence: 100, problem_solving: 100, overall: 100 }, 1.18).map((c, i) => {
                          const isLeft = c.x < center;
                          return (
                            <text
                              key={i}
                              x={c.x}
                              y={c.y + 4}
                              textAnchor={Math.abs(c.x - center) < 10 ? "middle" : isLeft ? "end" : "start"}
                              className="fill-indigo-300/70 font-bold text-[9.5px] uppercase tracking-[0.2em]"
                            >
                              {dimensions[i].label}
                            </text>
                          );
                        })}
                      </svg>

                      {/* Numeric breakdown list */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-6 w-full text-xs text-indigo-300/70 font-mono">
                        {dimensions.map((d) => (
                          <div key={d.key} className="flex justify-between border-b border-white/5 py-2">
                            <span className="uppercase tracking-[0.15em]">{d.label}:</span>
                            <span className="font-bold text-white tracking-widest text-[13px]">{(selectedRecord as any)[d.key]}/100</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary & transcript review */}
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-[#13111C]/90 to-[#0A0910]/95 p-8 rounded-[2rem] border border-white/5 space-y-4 hover:border-purple-500/30 transition-all duration-500 shadow-inner">
                        <h4 className="text-xs font-black text-indigo-300/80 uppercase tracking-[0.2em] flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-purple-400 drop-shadow-[0_0_8px_rgba(147,51,234,0.5)]" /> Executive Summary
                        </h4>
                        <p className="text-[15px] text-zinc-300 leading-relaxed font-light">
                          {selectedRecord.evaluation_data?.feedback?.overall_summary ||
                            "Demonstrated consistent competence, though optimization pathways are suggested below."}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-[#13111C]/90 to-[#0A0910]/95 p-8 rounded-[2rem] border border-white/5 space-y-4 hover:border-purple-500/30 transition-all duration-500 shadow-inner">
                        <h4 className="text-xs font-black text-indigo-300/80 uppercase tracking-[0.2em]">Compensatory feedback</h4>
                        <div className="space-y-4 max-h-[180px] overflow-y-auto pr-2">
                          {dimensions.slice(0, 4).map((dim) => {
                            const detail = selectedRecord.evaluation_data?.feedback?.[dim.key];
                            return detail ? (
                              <div key={dim.key} className="text-[13px] leading-relaxed">
                                <span className="font-black text-white/90 uppercase tracking-[0.1em] text-[11px] bg-white/5 px-2 py-1 rounded mr-2">{dim.label}</span>
                                <span className="text-zinc-400 font-light block mt-1.5">{detail}</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Interview Transcript logs */}
                  <div className="bg-gradient-to-br from-[#13111C]/90 to-[#0A0910]/95 p-8 rounded-[2rem] border border-white/5 space-y-5 hover:border-purple-500/30 transition-all duration-500 shadow-inner">
                    <h3 className="text-xs font-black text-indigo-300/80 uppercase tracking-[0.2em] border-b border-white/5 pb-4">
                      Simulation Transcript Log ({selectedRecord.transcript.length} turns)
                    </h3>
                    <div className="space-y-5 max-h-[250px] overflow-y-auto pr-3">
                      {selectedRecord.transcript.map((t, idx) => (
                        <div key={idx} className="space-y-2">
                          <p className={`font-black uppercase tracking-[0.2em] text-[10px] ${t.role === "assistant" || t.role === "interviewer" ? "text-purple-400 drop-shadow-[0_0_8px_rgba(147,51,234,0.5)]" : "text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                            }`}>
                            {t.role === "assistant" || t.role === "interviewer" ? "Interviewer" : "Candidate"}
                          </p>
                          <p className="text-[14px] text-zinc-300 leading-relaxed pl-4 border-l-2 border-white/10 bg-[#0B0914]/80 p-3.5 rounded-r-2xl font-light">{t.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </motion.div>

            </div>
          )}
        </AnimatePresence>

      </div>

        {/* Neon Candidate Modal */}
        <AnimatePresence>
          {selectedNeonCandidate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedNeonCandidate(null)}
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-gradient-to-b from-[#1a0505]/95 to-[#0a0000]/95 backdrop-blur-3xl border border-[#ff4500]/20 rounded-[2.5rem] overflow-hidden z-10 shadow-[0_0_80px_rgba(255,69,0,0.15)]"
              >
                {/* Glowing borders */}
                <div className="absolute inset-0 pointer-events-none rounded-[2.5rem] border border-transparent [background:linear-gradient(45deg,rgba(255,69,0,0.3),rgba(220,38,38,0.1))_border-box] [mask:linear-gradient(#fff_0_0)_padding-box,linear-gradient(#fff_0_0)] mask-composite-exclude shadow-[inset_0_0_40px_rgba(255,69,0,0.1)]" />
                
                <div className="relative z-10 p-10 flex flex-col items-center">
                  <button
                    onClick={() => setSelectedNeonCandidate(null)}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-[#ff4500]/10 text-zinc-500 hover:text-[#ff4500] transition-colors z-20"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="w-24 h-24 rounded-full border-2 border-[#ff4500]/40 shadow-[0_0_40px_rgba(255,69,0,0.4)] flex items-center justify-center bg-gradient-to-br from-[#ff4500]/30 to-[#4a0000]/80 mb-5 mt-2 relative">
                    <div className="absolute inset-0 rounded-full border border-white/10" />
                    <span className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]">
                      {selectedNeonCandidate.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  
                  <h3 className="text-4xl font-black text-white tracking-wide">{selectedNeonCandidate.username}</h3>
                  <span className="px-5 py-1.5 rounded-full bg-gradient-to-r from-[#ff4500]/20 to-red-600/10 border border-[#ff4500]/30 text-[#ff4500] text-[11px] font-black uppercase tracking-[0.2em] mt-3 mb-10 shadow-[0_0_20px_rgba(255,69,0,0.2)]">
                    {selectedNeonCandidate.rank_title}
                  </span>

                  {neonStatsLoading ? (
                    <div className="grid grid-cols-2 gap-5 w-full">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-gradient-to-b from-[#2a0808]/60 to-[#100202]/80 rounded-[1.5rem] p-5 border border-white/5 flex flex-col justify-center items-center h-[110px]">
                          <div className="w-6 h-6 border-2 border-[#ff4500]/30 border-t-[#ff4500] rounded-full animate-spin mb-3" />
                          <div className="h-2 w-16 bg-white/10 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : selectedNeonCandidate.stats ? (
                    <div className="grid grid-cols-2 gap-5 w-full">
                      <div className="bg-gradient-to-b from-[#2a0808]/60 to-[#100202]/80 rounded-[1.5rem] p-5 border border-[#ff4500]/10 text-center flex flex-col justify-center items-center group hover:border-[#ff4500]/50 hover:shadow-[inset_0_0_30px_rgba(255,69,0,0.15)] transition-all duration-500 h-[110px]">
                        <span className="text-[10px] text-orange-200/50 group-hover:text-[#ff4500]/90 font-black uppercase tracking-[0.2em] mb-2 transition-colors">Interviews</span>
                        <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] group-hover:drop-shadow-[0_0_15px_rgba(255,69,0,0.6)] transition-all">{selectedNeonCandidate.stats.total_interviews}</span>
                      </div>
                      
                      <div className="bg-gradient-to-b from-[#2a0808]/60 to-[#100202]/80 rounded-[1.5rem] p-5 border border-[#ff4500]/10 text-center flex flex-col justify-center items-center group hover:border-[#ff4500]/50 hover:shadow-[inset_0_0_30px_rgba(255,69,0,0.15)] transition-all duration-500 h-[110px]">
                        <span className="text-[10px] text-orange-200/50 group-hover:text-[#ff4500]/90 font-black uppercase tracking-[0.2em] mb-2 transition-colors">Total XP</span>
                        <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] group-hover:drop-shadow-[0_0_15px_rgba(255,69,0,0.6)] transition-all">{selectedNeonCandidate.stats.total_xp.toLocaleString()}</span>
                      </div>
                      
                      <div className="bg-gradient-to-b from-[#2a0808]/60 to-[#100202]/80 rounded-[1.5rem] p-5 border border-[#ff4500]/10 text-center flex flex-col justify-center items-center group hover:border-[#ff4500]/50 hover:shadow-[inset_0_0_30px_rgba(255,69,0,0.15)] transition-all duration-500 h-[110px]">
                        <span className="text-[10px] text-orange-200/50 group-hover:text-[#ff4500]/90 font-black uppercase tracking-[0.2em] mb-2 transition-colors">Badges</span>
                        <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] group-hover:drop-shadow-[0_0_15px_rgba(255,69,0,0.6)] transition-all">{selectedNeonCandidate.stats.badges_count}</span>
                      </div>
                      
                      <div className="bg-gradient-to-b from-[#2a0808]/60 to-[#100202]/80 rounded-[1.5rem] p-5 border border-[#ff4500]/10 text-center flex flex-col justify-center items-center group hover:border-[#ff4500]/50 hover:shadow-[inset_0_0_30px_rgba(255,69,0,0.15)] transition-all duration-500 h-[110px]">
                        <span className="text-[10px] text-orange-200/50 group-hover:text-[#ff4500]/90 font-black uppercase tracking-[0.2em] mb-2 transition-colors">Best Score</span>
                        <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] group-hover:drop-shadow-[0_0_15px_rgba(255,69,0,0.6)] transition-all">{selectedNeonCandidate.stats.highest_score}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-400 text-sm">Failed to load stats.</p>
                  )}
                  
                  <div className="mt-10 text-center text-[10px] text-[#ff4500]/50 font-bold uppercase tracking-[0.3em]">
                    Candidate Profile Snapshot
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </div>
  );
}

      interface MetricCardProps {
        icon: ReactNode;
      title: string;
      value: string | number;
      sub: string;
}

      function MetricCard({icon, title, value, sub}: MetricCardProps) {
  return (
      <div className="relative overflow-hidden p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-zinc-900/80 to-[#080808] hover:border-red-500/30 hover:shadow-[0_0_40px_rgba(239,68,68,0.12)] hover:-translate-y-1 transition-all duration-500 group">
        {/* Animated glowing top border line */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-red-500/50 transition-all duration-700" />

        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{title}</span>
          </div>
          <p className="text-4xl font-black text-white mt-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-red-300 group-hover:to-red-600 transition-all duration-500">{value}</p>
          <span className="text-[10px] text-zinc-500 font-medium tracking-wide mt-1">{sub}</span>
        </div>
      </div>
      );
}
