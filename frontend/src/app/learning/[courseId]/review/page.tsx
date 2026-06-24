"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, BrainCircuit, Code, Eye, X, Loader2, CheckCircle, 
  ShieldAlert, Trash2, GraduationCap, Award, PlayCircle, Terminal, 
  ChevronRight, Sliders, Settings, Activity, Sparkles
} from "lucide-react";
import { API_BASE_URL } from "../../../config";

interface StudentSubmission {
  id: number;
  user_id: number;
  username: string;
  course_id: number;
  course_title: string;
  challenge_title: string;
  student_code: string;
  language: string;
  ai_score: number;
  mentor_score: number | null;
  warnings: number;
  is_passed: boolean;
  feedback: string;
  is_final: boolean;
  created_at: string;
}

interface ProctoringViolation {
  id: number;
  user_id: number;
  username: string;
  course_id: number;
  course_title: string;
  image_path: string;
  created_at: string;
}

export default function MentorReviewPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = Number(params.courseId);

  const [user, setUser] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [violations, setViolations] = useState<ProctoringViolation[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);

  const [mentorScore, setMentorScore] = useState("");
  const [mentorFeedback, setMentorFeedback] = useState("");
  const [submittingScore, setSubmittingScore] = useState(false);
  const [viewAsMarkdown, setViewAsMarkdown] = useState(false);

  // Authenticate mentor on mount
  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) {
      router.push("/login?redirect=/learning");
      return;
    }
    const loggedUser = JSON.parse(session);
    if (loggedUser.role !== "mentor" && loggedUser.role !== "admin") {
      alert("Unauthorized Access. Only course mentors are permitted to review candidate submissions.");
      router.push("/learning");
      return;
    }
    setUser(loggedUser);
    fetchData(loggedUser);
  }, [courseId, router]);

  const fetchData = async (currentUser: any) => {
    try {
      setLoading(true);
      // 1. Fetch course details
      const courseRes = await fetch(`${API_BASE_URL}/api/learning/courses/${courseId}?user_id=${currentUser.id}`);
      if (!courseRes.ok) throw new Error("Course not found");
      const courseData = await courseRes.json();
      setCourse(courseData);

      // 2. Fetch submissions & violations in parallel
      const [subsRes, viosRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/mentor/submissions?mentor_id=${currentUser.id}`),
        fetch(`${API_BASE_URL}/api/mentor/violations`)
      ]);


      if (subsRes.ok) {
        const allSubs = await subsRes.json();
        // Filter submissions for this specific course
        const filteredSubs = allSubs.filter((s: StudentSubmission) => s.course_id === courseId);
        setSubmissions(filteredSubs);
      }

      if (viosRes.ok) {
        const allVios = await viosRes.json();
        // Filter violations for this specific course
        const filteredVios = allVios.filter((v: ProctoringViolation) => v.course_id === courseId);
        setViolations(filteredVios);
      }
    } catch (err) {
      console.error("Error loading review data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission || submittingScore || !user) return;
    
    const scoreVal = Number(mentorScore);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      alert("Please enter a valid score between 0 and 100.");
      return;
    }
    
    setSubmittingScore(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mentor/submissions/${selectedSubmission.id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentor_score: scoreVal,
          feedback: mentorFeedback,
          mentor_id: user.id
        }),
      });
      
      if (res.ok) {
        alert("Exam graded successfully!");
        
        // Find and delete ALL associated proctoring violations for this student and course
        const associatedViolations = violations.filter(
          (v) => v.user_id === selectedSubmission.user_id && v.course_id === selectedSubmission.course_id
        );
        if (associatedViolations.length > 0) {
          try {
            await Promise.all(
              associatedViolations.map((v) =>
                fetch(`${API_BASE_URL}/api/mentor/violations/${v.id}/acknowledge`, {
                  method: "POST"
                })
              )
            );
            setViolations((prev) =>
              prev.filter(
                (v) => !(v.user_id === selectedSubmission.user_id && v.course_id === selectedSubmission.course_id)
              )
            );
          } catch (ackErr) {
            console.error("Error acknowledging violations on override submit: ", ackErr);
          }
        }

        setSelectedSubmission(null);
        setMentorScore("");
        setMentorFeedback("");
        fetchData(user); // Refresh submissions list
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to submit score.");
      }
    } catch (err) {
      console.error(err);
      alert("Connection error. Failed to grade exam.");
    } finally {
      setSubmittingScore(false);
    }
  };

  const handleCloseReviewModal = async () => {
    if (selectedSubmission) {
      // Find and delete ALL associated proctoring violations for this student to enforce one-time play
      const associatedViolations = violations.filter(
        (v) => v.user_id === selectedSubmission.user_id && v.course_id === selectedSubmission.course_id
      );
      if (associatedViolations.length > 0) {
        try {
          await Promise.all(
            associatedViolations.map((v) =>
              fetch(`${API_BASE_URL}/api/mentor/violations/${v.id}/acknowledge`, {
                method: "POST"
              })
            )
          );
          setViolations((prev) =>
            prev.filter(
              (v) => !(v.user_id === selectedSubmission.user_id && v.course_id === selectedSubmission.course_id)
            )
          );
        } catch (ackErr) {
          console.error("Error acknowledging violations on modal close: ", ackErr);
        }
      }
    }
    setSelectedSubmission(null);
    setMentorScore("");
    setMentorFeedback("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Loading student submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-x-hidden pb-10">
      {/* Background ambient glows */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] bg-violet-600/10 pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] bg-fuchsia-600/8 pointer-events-none" />

      {/* Header bar */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/learning/${courseId}`)}
            className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">

            <span className="text-sm font-extrabold text-white truncate max-w-xs">{course?.title || "Review Portal"}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-zinc-300">Welcome, {user?.username}</p>
            <p className="text-[10px] text-zinc-500">Security Access Level: course mentor</p>
          </div>
        </div>
      </header>

      {/* Content wrapper */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        
        {/* Course Details summary card */}
        <div className="p-6 rounded-3xl border border-white/10 bg-zinc-900/30 backdrop-blur-md relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] bg-violet-500/10 pointer-events-none" />
          <div className="space-y-1">

            <h2 className="text-2xl font-black text-white mt-1.5">{course?.title}</h2>
            <p className="text-xs text-zinc-500">Analyze compiler metrics, candidate codes, and gaze tracking screenrecordings.</p>
          </div>

          <div className="flex gap-4 shrink-0 font-mono text-xs">
            <div className="p-3 bg-zinc-950/80 rounded-2xl border border-white/5 text-center min-w-[100px]">
              <span className="text-zinc-500 uppercase block text-[9px] mb-1">Submissions</span>
              <span className="text-xl font-extrabold text-white">{submissions.length}</span>
            </div>
            <div className="p-3 bg-zinc-950/80 rounded-2xl border border-white/5 text-center min-w-[100px]">
              <span className="text-zinc-500 uppercase block text-[9px] mb-1">Active Alerts</span>
              <span className={`text-xl font-extrabold ${violations.length > 0 ? "text-red-400 animate-pulse" : "text-zinc-500"}`}>{violations.length}</span>
            </div>
          </div>
        </div>

        {/* Submissions table section */}
        <div className="glass-card rounded-3xl border border-white/10 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider">Candidate Submissions</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Click "Review Candidate" to view the code answer, proctoring WebM, and override score.</p>
          </div>

          {submissions.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
              <p className="text-sm text-zinc-500">No student submissions registered for this course yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Student</th>
                    <th className="pb-3 font-semibold">Challenge Scope</th>
                    <th className="pb-3 font-semibold text-center">AI Grade</th>
                    <th className="pb-3 font-semibold text-center">Warnings</th>
                    <th className="pb-3 font-semibold text-center">Mentor Grade</th>
                    <th className="pb-3 font-semibold text-center">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="group hover:bg-zinc-900/30 transition-colors">
                      <td className="py-4 font-bold text-white group-hover:text-violet-400 transition-colors">{sub.username}</td>
                      <td className="py-4 text-zinc-400">
                        <div className="flex flex-col gap-1">
                          <span>{sub.challenge_title}</span>
                          {sub.is_final ? (
                            <span className="w-fit px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 text-[9px] font-bold tracking-wider uppercase">
                              Final Exam
                            </span>
                          ) : (
                            <span className="w-fit px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30 text-[9px] font-bold tracking-wider uppercase">
                              Syllabus Quiz
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-center font-semibold text-zinc-300">{sub.ai_score}%</td>
                      <td className="py-4 text-center font-bold">
                        <div className="flex flex-col items-center gap-1.5 justify-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            sub.warnings >= 3 
                              ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                              : sub.warnings > 0 
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                                : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {sub.warnings} warnings
                          </span>
                          {violations.some(v => v.user_id === sub.user_id) && sub.warnings >= 3 && (
                            <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-extrabold animate-pulse uppercase tracking-wider flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Gaze Video
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-center font-bold text-violet-400">
                        {sub.mentor_score !== null ? `${sub.mentor_score}%` : "—"}
                      </td>
                      <td className="py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                          sub.mentor_score !== null 
                            ? sub.is_passed 
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}>
                          {sub.mentor_score !== null ? (sub.is_passed ? "PASSED" : "FAILED") : "PENDING"}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedSubmission(sub);
                            setMentorScore(sub.mentor_score !== null ? String(sub.mentor_score) : String(sub.ai_score));
                            setMentorFeedback(sub.feedback || "");
                          }}
                          className="px-2.5 py-1.5 bg-zinc-800 border border-white/5 hover:border-violet-500/30 hover:bg-violet-500/10 rounded-lg text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
                        >
                          <Code className="w-3.5 h-3.5" />
                          <span>Review Candidate</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Main Review Modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Close trigger */}
              <button
                onClick={handleCloseReviewModal}
                className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/5 hover:text-white text-zinc-400 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <span className="px-2.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold tracking-widest uppercase">
                  Coding Challenge Evaluation
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">{selectedSubmission.username}</h2>
                <p className="text-xs text-zinc-500">Syllabus Quiz: {selectedSubmission.challenge_title} ({selectedSubmission.language})</p>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  
                  {/* Left Column: Code viewer */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Code className="w-4 h-4 text-violet-400" /> Submitted Answer Code
                      </h3>
                      <button
                        onClick={() => setViewAsMarkdown(!viewAsMarkdown)}
                        className="px-3 py-1 bg-zinc-900 border border-white/5 rounded-lg text-[10px] text-zinc-400 font-bold hover:text-white transition-all uppercase tracking-widest cursor-pointer"
                      >
                        {viewAsMarkdown ? "View as Raw Code" : "Render Markdown"}
                      </button>
                    </div>
                    {viewAsMarkdown ? (
                      <div className="p-4 bg-zinc-950 rounded-xl border border-white/5 max-h-[400px] overflow-auto text-zinc-300 font-sans prose prose-invert prose-violet prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {selectedSubmission.student_code}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <pre className="font-mono text-xs text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-white/5 max-h-[400px] overflow-auto leading-relaxed tab-size-4">
                        <code>{selectedSubmission.student_code}</code>
                      </pre>
                    )}
                  </div>

                  {/* Right Column: AI Metrics & Grade Override form */}
                  <div className="space-y-6">
                    <div className="bg-zinc-950/40 p-5 rounded-2xl border border-white/5 space-y-3">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">AI Evaluator Feedback</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                          <p className="text-[10px] text-zinc-500 uppercase">AI Grade</p>
                          <p className="text-xl font-black text-white">{selectedSubmission.ai_score}%</p>
                        </div>
                        <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                          <p className="text-[10px] text-zinc-500 uppercase">Warnings count</p>
                          <p className={`text-xl font-black ${selectedSubmission.warnings >= 3 ? 'text-red-400' : 'text-zinc-300'}`}>{selectedSubmission.warnings}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase mb-1">AI Evaluator Notes</p>
                        <p className="text-xs text-zinc-300 leading-relaxed font-light bg-zinc-950/50 p-3 rounded-lg border border-white/5 max-h-[120px] overflow-y-auto font-mono">
                          {selectedSubmission.feedback || "No AI feedback recorded."}
                        </p>
                      </div>
                    </div>

                    {/* Associated Proctoring Alert */}
                    {(() => {
                      const violation = violations.find(
                        (v) => v.user_id === selectedSubmission.user_id && v.course_id === selectedSubmission.course_id
                      );
                      if (!violation) return null;
                      return (
                        <div className="bg-red-950/15 border border-red-500/20 p-5 rounded-2xl space-y-3">
                          <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                            Classified Proctoring Screenrecording
                          </h4>
                          
                          <p className="text-[11px] text-zinc-400 leading-relaxed font-light">
                            A gaze tracking proctoring alert was recorded during the test.
                          </p>

                          {/* Inline Video Player */}
                          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                            <video
                              src={`${API_BASE_URL}/${violation.image_path}`}
                              controls
                              autoPlay
                              loop
                              className="w-full rounded-lg border border-white/10"
                            />
                          </div>

                          <div className="bg-red-950/30 border border-red-500/10 p-3 rounded-lg text-[10px] text-red-400 leading-relaxed">
                            <strong>⚠️ One-Time Security Policy:</strong> This screenrecording is classified for student privacy. Closing this review page or submitting the grade will permanently erase this WebM file from server disk and database storage.
                          </div>
                        </div>
                      );
                    })()}

                    {/* Mentor grading form */}
                    <form onSubmit={handleOverrideScore} className="bg-zinc-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
                      <h4 className="text-xs font-bold text-violet-400 uppercase tracking-widest">Mentor Evaluation Override</h4>
                      
                      <div>
                        <label className="text-[10px] font-semibold text-zinc-400 block mb-1">MENTOR OVERRIDE SCORE (0 - 100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={mentorScore}
                          onChange={(e) => setMentorScore(e.target.value)}
                          placeholder="Enter final score (>= 80 passes)"
                          required
                          className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 [color-scheme:dark]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-zinc-400 block mb-1">MENTOR EVALUATION FEEDBACK</label>
                        <textarea
                          rows={4}
                          value={mentorFeedback}
                          onChange={(e) => setMentorFeedback(e.target.value)}
                          placeholder="Provide feedback on logic complexity, formatting, and performance overrides..."
                          required
                          className="w-full bg-zinc-950 border border-white/5 rounded-xl p-3 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingScore}
                        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {submittingScore ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Updating Submission...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Submit Mentor Grade</span>
                          </>
                        )}
                      </button>
                    </form>
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
