"use client";

import { useState, useEffect } from "react";
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
  FileText
} from "lucide-react";
import { API_BASE_URL } from "../../config";

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
  const [selectedRecord, setSelectedRecord] = useState<EvaluationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptTemp, setPromptTemp] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a Senior Technical Interviewer assessing candidates on technical coding, architecture, confidence, and filler-word flags..."
  );

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

  // Filter candidates log
  const filteredCandidates = candidates.filter(
    (c) =>
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mode.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-950 text-white">
      {/* Header bar */}
      <header className="sticky top-0 z-40 bg-zinc-950/75 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center text-white">
            <BrainCircuit className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
              HireMind <span className="text-red-500 font-light text-sm bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-widest">Admin Portal</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-zinc-300">Welcome, {adminUser?.username || "Admin"}</p>
            <p className="text-[10px] text-zinc-500">Security Access Level: root</p>
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
          
          {/* Candidates table card (70% width on large screens) */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-md font-bold text-white uppercase tracking-wider">Candidate Simulation Logs</h2>
                <p className="text-xs text-zinc-500 mt-1">Review, monitor, and delete candidate evaluation runs</p>
              </div>
              
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 w-4 h-4 text-zinc-500 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="search by name or mode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-zinc-500">Querying candidate tables...</p>
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
                      <tr key={c.id} className="group hover:bg-zinc-900/30 transition-colors">
                        <td className="py-4 font-bold text-white group-hover:text-red-400 transition-colors">{c.username}</td>
                        <td className="py-4 text-zinc-400">{c.mode}</td>
                        <td className="py-4 text-center text-red-400 font-bold">{c.overall}/100</td>
                        <td className="py-4 text-center text-zinc-400">{c.technical}</td>
                        <td className="py-4 text-center text-zinc-400">{c.communication}</td>
                        <td className="py-4 text-center text-zinc-500 text-[10px]">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="py-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedRecord(c)}
                            className="p-1.5 rounded-lg bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all cursor-pointer"
                            title="Inspect Report"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(c.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-500 transition-all cursor-pointer"
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
                
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 block mb-1">SYSTEM PROMPT OVERRIDE</label>
                  <textarea
                    rows={4}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl p-3 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-red-500 resize-none leading-relaxed"
                  />
                </div>

                <button
                  onClick={() => alert("System evaluation configurations successfully updated globally.")}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Close trigger */}
              <button
                onClick={() => setSelectedRecord(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/5 hover:text-white text-zinc-400 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <span className="px-2.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold tracking-widest uppercase">
                  Candidate Report Inspection
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">{selectedRecord.username}</h2>
                <p className="text-xs text-zinc-500">Completed a {selectedRecord.mode} Simulation</p>
              </div>

              {/* Scrollable container for inspection columns */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  
                  {/* Radar Chart */}
                  <div className="flex flex-col items-center justify-center bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Competency Map</h3>
                    <svg viewBox="0 0 340 300" className="w-full max-w-[280px] h-auto overflow-visible">
                      <defs>
                        <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
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
                          stroke="rgba(255, 255, 255, 0.08)"
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
                        stroke="rgba(239, 68, 68, 0.7)"
                        strokeWidth="2"
                        className="transition-all duration-1000"
                      />

                      {/* Score vertices */}
                      {getCoordinates(selectedRecord).map((c, i) => (
                        <circle
                          key={i}
                          cx={c.x}
                          cy={c.y}
                          r="4"
                          className="fill-zinc-950 stroke-red-500 stroke-2"
                        />
                      ))}

                      {/* Outer dimension Labels */}
                      {getCoordinates({ technical: 100, communication: 100, confidence: 100, problem_solving: 100, overall: 100 }, 1.14).map((c, i) => {
                        const isLeft = c.x < center;
                        return (
                          <text
                            key={i}
                            x={c.x}
                            y={c.y + 4}
                            textAnchor={Math.abs(c.x - center) < 10 ? "middle" : isLeft ? "end" : "start"}
                            className="fill-zinc-400 font-semibold text-[8px] uppercase tracking-wide"
                          >
                            {dimensions[i].label}
                          </text>
                        );
                      })}
                    </svg>

                    {/* Numeric breakdown list */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 w-full text-[10px] text-zinc-400 font-mono">
                      {dimensions.map((d) => (
                        <div key={d.key} className="flex justify-between border-b border-white/5 py-1">
                          <span className="uppercase">{d.label}:</span>
                          <span className="font-bold text-white">{(selectedRecord as any)[d.key]}/100</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary & transcript review */}
                  <div className="space-y-4">
                    <div className="bg-zinc-950/40 p-5 rounded-2xl border border-white/5 space-y-2">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-red-400" /> Executive Summary
                      </h4>
                      <p className="text-xs text-zinc-300 leading-relaxed font-light">
                        {selectedRecord.evaluation_data?.feedback?.overall_summary || 
                         "Demonstrated consistent competence, though optimization pathways are suggested below."}
                      </p>
                    </div>

                    <div className="bg-zinc-950/40 p-5 rounded-2xl border border-white/5 space-y-2">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Compensatory feedback</h4>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {dimensions.slice(0, 4).map((dim) => {
                          const detail = selectedRecord.evaluation_data?.feedback?.[dim.key];
                          return detail ? (
                            <div key={dim.key} className="text-[11px]">
                              <span className="font-bold text-white uppercase">{dim.label}</span>:{" "}
                              <span className="text-zinc-400 leading-relaxed">{detail}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Interview Transcript logs */}
                <div className="bg-zinc-950/40 p-5 rounded-2xl border border-white/5 space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">
                    Simulation Transcript Log ({selectedRecord.transcript.length} turns)
                  </h3>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 text-xs">
                    {selectedRecord.transcript.map((t, idx) => (
                      <div key={idx} className="space-y-1">
                        <p className={`font-bold uppercase tracking-wider text-[9px] ${
                          t.role === "assistant" || t.role === "interviewer" ? "text-red-400" : "text-amber-500"
                        }`}>
                          {t.role === "assistant" || t.role === "interviewer" ? "Interviewer" : "Candidate"}
                        </p>
                        <p className="text-zinc-300 leading-relaxed pl-2 border-l border-white/10 bg-zinc-900/10 py-1">{t.content}</p>
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
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  sub: string;
}

function MetricCard({ icon, title, value, sub }: MetricCardProps) {
  return (
    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2 hover:border-red-500/20 hover:bg-zinc-900/40 transition-all group">
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{title}</span>
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-105 transition-transform">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-extrabold text-white mt-2 group-hover:text-red-400 transition-colors">{value}</p>
      <span className="text-[10px] text-zinc-500 font-medium">{sub}</span>
    </div>
  );
}
