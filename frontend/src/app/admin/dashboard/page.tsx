"use client";

import { useState, useEffect, ReactNode, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  BrainCircuit,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  Crown,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Medal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sliders,
  Trash2,
  Trophy,
  Users,
  X,
  LayoutGrid,
  ChevronDown
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
    active_sessions: 0,
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
  const [activeTab, setActiveTab] = useState<"logs" | "leaderboard" | "exams" | "mentor_management" | "assignment_history" | "course_deletion">("logs");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
// Coding Exams Tab States
    const [exams, setExams] = useState<any[]>([]);
  const [latestEndedExam, setLatestEndedExam] = useState<any | null>(null);
  const [archivedExams, setArchivedExams] = useState<any[]>([]);
  const [activeReviewExam, setActiveReviewExam] = useState<any | null>(null);
  const [reviewSubmissions, setReviewSubmissions] = useState<any[]>([]);
  const [selectedExamSubmission, setSelectedExamSubmission] = useState<any | null>(null);
  const [gradingScore, setGradingScore] = useState<string>("");
  const [gradingFeedback, setGradingFeedback] = useState<string>("");
  const [submittingGrade, setSubmittingGrade] = useState<boolean>(false);
  const [loadingExamsData, setLoadingExamsData] = useState<boolean>(false);
  const [actionLoadingExamId, setActionLoadingExamId] = useState<string | null>(null);
  const [violations, setViolations] = useState<any[]>([]);

  // Mentor Management States
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [allMentors, setAllMentors] = useState<any[]>([]);
  const [availableMentors, setAvailableMentors] = useState<any[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<Record<number, any[]>>({});
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [selectedAssignCourseId, setSelectedAssignCourseId] = useState("");
  const [selectedAssignMentorId, setSelectedAssignMentorId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Course Deletion States
  const [deletionLogs, setDeletionLogs] = useState<any[]>([]);
  const [deletionLogPage, setDeletionLogPage] = useState(1);
  const [deletionLogPages, setDeletionLogPages] = useState(0);
  const [deletionLogTotal, setDeletionLogTotal] = useState(0);
  const [loadingDeletionLogs, setLoadingDeletionLogs] = useState(false);
  
  // Deletion Multi-Step Workflow States
  const [deletionSummary, setDeletionSummary] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showDeleteWorkflow, setShowDeleteWorkflow] = useState<boolean>(false);
  const [deleteStep, setDeleteStep] = useState<number>(1);
  const [selectedDeleteCourse, setSelectedDeleteCourse] = useState<any | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [confirmDeletePassword, setConfirmDeletePassword] = useState("");
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  
  // Restore / Purge States
  const [showPasswordConfirmModal, setShowPasswordConfirmModal] = useState<boolean>(false);
  const [passwordConfirmAction, setPasswordConfirmAction] = useState<"restore" | "purge" | null>(null);
  const [selectedActionCourse, setSelectedActionCourse] = useState<any | null>(null);
  const [confirmActionPassword, setConfirmActionPassword] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionErrorMessage, setActionErrorMessage] = useState("");

  // Search/Filter, Toast, and Confirm modal states
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" | "info" }>>([]);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedNeonCandidate, setSelectedNeonCandidate] = useState<any | null>(null);
  const [neonStatsLoading, setNeonStatsLoading] = useState(false);

  // Authenticate admin on mount
  useEffect(() => {
    let sessionStr = localStorage.getItem("hiremind_admin");
    if (!sessionStr) {
      sessionStr = localStorage.getItem("hiremind_user");
    }
    
    if (!sessionStr) {
      router.push("/admin/login");
      return;
    }

    const sessionData = JSON.parse(sessionStr);
    if (sessionData.role !== "admin" && sessionData.role !== "mentor") {
      router.push("/admin/login");
      return;
    }

    setAdminUser(sessionData);
    fetchDashboardData();
  }, [router]);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const selectExamForReview = (ex: any) => {
    setSelectedExamSubmission(null);
    setReviewSubmissions([]);
    setGradingScore("");
    setGradingFeedback("");

    if (activeReviewExam && activeReviewExam.id === ex.id && activeReviewExam.exam_type === ex.exam_type) {
      setActiveReviewExam(null);
      return;
    }

    setActiveReviewExam(ex);
    if (adminUser) {
      fetchSubmissions(ex.id, ex.exam_type, adminUser.id);
    }
  };

  // Pagination states for audit logs
  const [assignmentLogs, setAssignmentLogs] = useState<any[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logLimit] = useState(10); // Limit of 10 for paginated logs display
  const [logPages, setLogPages] = useState(0);
  const [logTotal, setLogTotal] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch available mentors reactively when modal is open and course changes
  useEffect(() => {
    if (showAssignModal && selectedAssignCourseId && adminUser) {
      fetch(`${API_BASE_URL}/api/admin/courses/${selectedAssignCourseId}/available-mentors?admin_id=${adminUser.id}`)
        .then(r => r.json())
        .then(data => {
          setAvailableMentors(Array.isArray(data) ? data : []);
        })
        .catch(err => console.error("Error fetching available mentors:", err));
    } else {
      setAvailableMentors([]);
    }
  }, [selectedAssignCourseId, showAssignModal, adminUser]);

  const fetchMentorManagementData = async (adminId: number) => {
    try {
      setLoadingAssignments(true);
      const coursesRes = await fetch(`${API_BASE_URL}/api/admin/courses?admin_id=${adminId}`);
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setAllCourses(coursesData);
        
        // Fetch assignments for each course
        const assignments: Record<number, any[]> = {};
        await Promise.all(
          coursesData.map(async (c: any) => {
            const res = await fetch(`${API_BASE_URL}/api/admin/courses/${c.id}/mentors?admin_id=${adminId}`);
            if (res.ok) {
              assignments[c.id] = await res.json();
            }
          })
        );
        setCourseAssignments(assignments);
      }

      // Fetch all mentors
      const mentorsRes = await fetch(`${API_BASE_URL}/api/admin/mentors?admin_id=${adminId}`);
      if (mentorsRes.ok) {
        setAllMentors(await mentorsRes.json());
      }
    } catch (err) {
      console.error("Error loading assignments:", err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchAssignmentLogs = async (adminId: number, page: number) => {
    try {
      setLoadingLogs(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/mentor-assignment-events?admin_id=${adminId}&page=${page}&limit=${logLimit}`);
      if (res.ok) {
        const data = await res.json();
        setAssignmentLogs(data.items || []);
        setLogPages(data.pages || 0);
        setLogTotal(data.total || 0);
        setLogPage(data.page || 1);
      }
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchDeletionLogs = async (page: number) => {
    if (!adminUser) return;
    try {
      setLoadingDeletionLogs(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/course-deletion-events?admin_id=${adminUser.id}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setDeletionLogs(data.events || []);
        setDeletionLogPages(data.pages || 0);
        setDeletionLogTotal(data.total || 0);
        setDeletionLogPage(data.page || 1);
      }
    } catch (err) {
      console.error("Error loading deletion logs:", err);
    } finally {
      setLoadingDeletionLogs(false);
    }
  };

  const openDeleteWorkflow = async (course: any) => {
    setSelectedDeleteCourse(course);
    setDeleteStep(1);
    setConfirmDeleteText("");
    setConfirmDeletePassword("");
    setDeleteErrorMessage("");
    setShowDeleteWorkflow(true);
    setDeletionSummary(null);
    
    if (!adminUser) return;
    try {
      setLoadingSummary(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/courses/${course.id}/deletion-summary?admin_id=${adminUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setDeletionSummary(data);
      } else {
        const errData = await res.json();
        setDeleteErrorMessage(errData.message || "Failed to load deletion summary.");
      }
    } catch (err) {
      console.error("Error fetching summary:", err);
      setDeleteErrorMessage("Connection error loading summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const executeDeleteCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser || !selectedDeleteCourse) return;
    setSubmittingDelete(true);
    setDeleteErrorMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/courses/${selectedDeleteCourse.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_id: adminUser.id,
          password: confirmDeletePassword
        })
      });
      const data = await res.json();
      if (res.ok || data.status === "success") {
        showToast(data.message || "Course successfully soft-deleted.", "success");
        setShowDeleteWorkflow(false);
        fetchMentorManagementData(adminUser.id);
        fetchDeletionLogs(1);
      } else {
        setDeleteErrorMessage(data.message || "Failed to delete course.");
        showToast(data.message || "Failed to delete course.", "error");
      }
    } catch (err) {
      console.error("Error deleting course:", err);
      setDeleteErrorMessage("Network error deleting course.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  const handleActionClick = (course: any, action: "restore" | "purge") => {
    setSelectedActionCourse(course);
    setPasswordConfirmAction(action);
    setConfirmActionPassword("");
    setActionErrorMessage("");
    setShowPasswordConfirmModal(true);
  };

  const executeActionWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser || !selectedActionCourse || !passwordConfirmAction) return;
    setSubmittingAction(true);
    setActionErrorMessage("");
    try {
      if (passwordConfirmAction === "restore") {
        const res = await fetch(`${API_BASE_URL}/api/admin/courses/${selectedActionCourse.id}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admin_id: adminUser.id,
            password: confirmActionPassword
          })
        });
        const data = await res.json();
        if (res.ok || data.status === "success") {
          showToast(data.message || "Course successfully restored.", "success");
          setShowPasswordConfirmModal(false);
          fetchMentorManagementData(adminUser.id);
          fetchDeletionLogs(1);
        } else {
          setActionErrorMessage(data.message || "Failed to restore course.");
          showToast(data.message || "Failed to restore course.", "error");
        }
      } else if (passwordConfirmAction === "purge") {
        const res = await fetch(
          `${API_BASE_URL}/api/admin/courses/${selectedActionCourse.id}/purge?admin_id=${adminUser.id}&password=${encodeURIComponent(confirmActionPassword)}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (res.ok || data.status === "success") {
          showToast(data.message || "Course permanently purged.", "success");
          setShowPasswordConfirmModal(false);
          fetchMentorManagementData(adminUser.id);
          fetchDeletionLogs(1);
        } else {
          setActionErrorMessage(data.message || "Failed to purge course.");
          showToast(data.message || "Failed to purge course.", "error");
        }
      }
    } catch (err) {
      console.error("Error executing action:", err);
      setActionErrorMessage("Network error executing action.");
    } finally {
      setSubmittingAction(false);
    }
  };

  useEffect(() => {
    if (adminUser && activeTab === "mentor_management") {
      fetchMentorManagementData(adminUser.id);
      fetchAssignmentLogs(adminUser.id, 1);
    } else if (adminUser && activeTab === "assignment_history") {
      fetchAssignmentLogs(adminUser.id, 1);
    } else if (adminUser && activeTab === "course_deletion") {
      fetchMentorManagementData(adminUser.id);
      fetchDeletionLogs(1);
    }
  }, [activeTab, adminUser]);

  const handleAssignMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser || !selectedAssignCourseId || !selectedAssignMentorId) return;
    setAssigning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/courses/assign-mentor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_id: adminUser.id,
          mentor_id: Number(selectedAssignMentorId),
          course_id: Number(selectedAssignCourseId)
        })
      });
      const data = await res.json();
      if (res.ok || data.success) {
        showToast(data.message || "Mentor assigned successfully!", "success");
        setShowAssignModal(false);
        setSelectedAssignCourseId("");
        setSelectedAssignMentorId("");
        fetchMentorManagementData(adminUser.id);
        fetchAssignmentLogs(adminUser.id, 1);
      } else {
        showToast(data.message || data.detail || "Failed to assign mentor.", "error");
      }
    } catch (err) {
      console.error("Error assigning:", err);
      showToast("Error assigning mentor.", "error");
    } finally {
      setAssigning(false);
    }
  };

  const executeRemoveMentor = async (courseId: number, mentorId: number) => {
    if (!adminUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/courses/${courseId}/mentor/${mentorId}?admin_id=${adminUser.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok || data.success) {
        showToast(data.message || "Mentor removed successfully!", "success");
        fetchMentorManagementData(adminUser.id);
        fetchAssignmentLogs(adminUser.id, 1);
      } else {
        showToast(data.message || data.detail || "Failed to remove mentor.", "error");
      }
    } catch (err) {
      console.error("Error removing:", err);
      showToast("Error removing mentor.", "error");
    }
  };

  const handleRemoveMentorClick = (courseId: number, mentorId: number, mentorName: string, courseTitle: string) => {
    setConfirmModal({
      title: "Remove Mentor",
      message: `Are you sure you want to remove ${mentorName} from "${courseTitle}"?`,
      onConfirm: () => {
        executeRemoveMentor(courseId, mentorId);
      }
    });
  };

  const renderStatusBadge = (status: string) => {
    let badgeStyle = "bg-zinc-800 text-zinc-400 border border-white/5";
    let badgeText = "⚫ Archived";
    
    if (status === "active") {
      badgeStyle = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      badgeText = "🟢 Active";
    } else if (status === "ended") {
      badgeStyle = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      badgeText = "🔴 Ended";
    }
    
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${badgeStyle}`}>
        {badgeText}
      </span>
    );
  };

  // Authenticate admin/mentor on mount
  useEffect(() => {
    const adminSession = localStorage.getItem("hiremind_admin");
    const userSession = localStorage.getItem("hiremind_user");
    
    let activeUser = null;
    if (adminSession) {
      activeUser = JSON.parse(adminSession);
    } else if (userSession) {
      const parsed = JSON.parse(userSession);
      if (parsed.role === "candidate") {
        router.push("/learning");
        return;
      }
      if (parsed.role === "mentor" || parsed.role === "admin") {
        activeUser = parsed;
      }
    }
    
    if (!activeUser) {
      router.push("/admin/login");
      return;
    }
    
    setAdminUser(activeUser);
    
    if (activeUser.role === "mentor") {
      setActiveTab("exams");
      fetchExamsData(activeUser.id);
    } else {
      fetchDashboardData();
      fetchExamsData(activeUser.id);
    }
  }, [router]);

  const fetchExamsData = async (mentorId: number) => {
    try {
      setLoadingExamsData(true);
      // 1. Fetch all course exams
      const examsRes = await fetch(`${API_BASE_URL}/api/mentor/exams?mentor_id=${mentorId}`);
      if (examsRes.ok) {
        const examsData = await examsRes.json();
        setExams(examsData);
      }

      // 2. Fetch dashboard (latest ended + archived list)
      const dashRes = await fetch(`${API_BASE_URL}/api/mentor/exams/dashboard?mentor_id=${mentorId}`);
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (dashData.status === "success") {
          setLatestEndedExam(dashData.latest_ended_exam);
          setArchivedExams(dashData.archived_exams || []);
          
          // Default selection to latest ended exam
          if (dashData.latest_ended_exam) {
            setActiveReviewExam(dashData.latest_ended_exam);
            fetchSubmissions(dashData.latest_ended_exam.id, dashData.latest_ended_exam.exam_type, mentorId);
          }
        }
      }

      // 3. Fetch violations for webcam / gaze player
      const viosRes = await fetch(`${API_BASE_URL}/api/mentor/violations`);
      if (viosRes.ok) {
        setViolations(await viosRes.json());
      }
    } catch (err) {
      console.error("Error fetching exams data:", err);
    } finally {
      setLoadingExamsData(false);
    }
  };

  const fetchSubmissions = async (examId: number, examType: string, mentorId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/mentor/exams/${examId}/submissions?exam_type=${examType}&mentor_id=${mentorId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setReviewSubmissions(data.submissions || []);
        }
      }
    } catch (err) {
      console.error("Error fetching submissions:", err);
    }
  };

  const handleExamAction = async (examId: number, examType: string, action: "end" | "reopen" | "archive") => {
    if (!adminUser) return;
    const actionKey = `${action}-${examId}-${examType}`;
    setActionLoadingExamId(actionKey);
    try {
      const endpoint = examType === "final"
        ? `${API_BASE_URL}/api/mentor/final-exams/${examId}/${action}`
        : `${API_BASE_URL}/api/mentor/exams/${examId}/${action}`;
        
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentor_id: adminUser.id })
      });
      
      if (res.ok) {
        showToast(`Exam successfully ${action === "end" ? "ended" : action === "reopen" ? "reopened" : "archived"}.`, "success");
        // Refresh exams lists
        await fetchExamsData(adminUser.id);
        
        // If the active review exam was affected, update its status
        if (activeReviewExam && activeReviewExam.id === examId && activeReviewExam.exam_type === examType) {
          setActiveReviewExam((prev: any) => prev ? {
            ...prev,
            status: action === "end" ? "ended" : action === "reopen" ? "active" : "archived"
          } : null);
        }
      } else {
        const err = await res.json();
        showToast(err.detail || `Failed to perform ${action} action.`, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error. Action failed.", "error");
    } finally {
      setActionLoadingExamId(null);
    }
  };

  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamSubmission || submittingGrade || !adminUser) return;
    
    const scoreVal = Number(gradingScore);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      showToast("Please enter a valid score between 0 and 100.", "error");
      return;
    }
    
    setSubmittingGrade(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mentor/submissions/${selectedExamSubmission.id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentor_score: scoreVal,
          feedback: gradingFeedback,
          mentor_id: adminUser.id
        })
      });
      
      if (res.ok) {
        showToast("Submission graded and reviewed successfully!", "success");
        
        // Acknowledge associated proctoring violation if it exists
        const associatedViolation = violations.find(
          (v) => v.user_id === selectedExamSubmission.user_id && v.course_id === selectedExamSubmission.course_id
        );
        if (associatedViolation) {
          try {
            await fetch(`${API_BASE_URL}/api/mentor/violations/${associatedViolation.id}/acknowledge`, {
              method: "POST"
            });
            setViolations((prev) => prev.filter(v => v.id !== associatedViolation.id));
          } catch (vErr) {
            console.error("Error acknowledging violation:", vErr);
          }
        }

        setSelectedExamSubmission(null);
        setGradingScore("");
        setGradingFeedback("");
        
        if (activeReviewExam) {
          fetchSubmissions(activeReviewExam.id, activeReviewExam.exam_type, adminUser.id);
        }
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to grade submission.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Connection error. Failed to grade submission.", "error");
    } finally {
      setSubmittingGrade(false);
    }
  };

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
    localStorage.removeItem("hiremind_user");
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
      const x = center + radius * (val / 100) * Math.cos(angle) * offsetMultiplier;
      const y = center + radius * (val / 100) * Math.sin(angle) * offsetMultiplier;
      return { x, y };
    });
  };

  const isEligibleForPurge = (deletedAtStr: string | null) => {
    if (!deletedAtStr) return true;
    const deletedAt = new Date(deletedAtStr);
    const now = new Date();
    const diffTime = deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000 - now.getTime();
    return diffTime <= 0;
  };

  const getPurgeCountdownText = (deletedAtStr: string | null) => {
    if (!deletedAtStr) return "Eligible For Purge";
    const deletedAt = new Date(deletedAtStr);
    const now = new Date();
    const diffTime = deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000 - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return "Eligible For Purge";
    }
    return `Purge Available In: ${diffDays} Day${diffDays > 1 ? 's' : ''}`;
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
            {adminUser?.role === "mentor" ? (
              <button onClick={() => router.back()} className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer">
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
                <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-red-400 to-zinc-600 tracking-tighter drop-shadow-sm">
                  HireMind
                </h1>
              </Link>
            )}
          </div>

          {/* Centered Admin Portal */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500/80 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-500 uppercase tracking-[0.3em] drop-shadow-sm">
              {adminUser?.role === "mentor" ? "Mentor Console" : "Admin Portal"}
            </span>
            
            {adminUser?.role !== "mentor" && (
            <div className="relative ml-2" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-[#111] border border-white/10 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] rounded-full text-zinc-400 hover:text-amber-400 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                title="Learning Hub"
              >
                <div className="absolute inset-0 bg-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
                <GraduationCap className="w-4 h-4 relative z-10 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300" />
              </button>

              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-12 left-1/2 -translate-x-1/2 w-56 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col p-2"
                  >
                    {[
                      { id: "exams", label: "Coding Exams", icon: FileCode },
                      { id: "mentor_management", label: "Mentor Management", icon: Users },
                      { id: "assignment_history", label: "Assignment Logs", icon: Archive },
                      { id: "course_deletion", label: "Course Deletions", icon: Trash2 },
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setActiveTab(tab.id as any);
                            setIsMenuOpen(false);
                          }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            isActive ? "bg-red-500/10 text-red-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            )}
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
          {!["exams", "mentor_management", "assignment_history", "course_deletion"].includes(activeTab) && (
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
          )}

          {/* Dashboard Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Tabs for Candidates Log / Leaderboard */}
            <div className={`${!["exams", "mentor_management", "assignment_history", "course_deletion"].includes(activeTab) ? "lg:col-span-2" : "lg:col-span-3"} glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-6 transition-all duration-500`}>
              
              {["exams", "mentor_management", "assignment_history", "course_deletion"].includes(activeTab) && (
                 <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-4">
                   <h2 className="text-xl font-bold text-white tracking-widest uppercase flex items-center gap-3">
                     {activeTab === "exams" ? <><FileCode className="w-5 h-5 text-violet-400" /> Coding Exams</> : 
                      activeTab === "mentor_management" ? <><Users className="w-5 h-5 text-emerald-400" /> Mentor Management</> : 
                      activeTab === "assignment_history" ? <><Archive className="w-5 h-5 text-amber-400" /> Assignment Logs</> : <><Trash2 className="w-5 h-5 text-red-400" /> Course Deletions</>}
                   </h2>
                   {adminUser?.role !== "mentor" && (
                   <button onClick={() => setActiveTab("logs")} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors border border-white/10 hover:border-white/20 shadow-lg cursor-pointer">
                     <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                   </button>
                   )}
                 </div>
              )}

              {!["exams", "mentor_management", "assignment_history", "course_deletion"].includes(activeTab) && (
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
                          isActive ? "bg-zinc-800 text-white shadow" : "text-zinc-400 hover:text-zinc-300"
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? "text-red-400" : ""}`} />
                        {tab.label}
                      </button>
                    );
                  })}
              </div>
              )}

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
                        className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-2xl font-black mb-1"
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
                      <Search className="absolute left-3 w-4 h-4 text-zinc-400 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="search runs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-zinc-400">Querying candidate tables...</p>
                </div>
              ) : selectedCandidate === null ? (
                <div className="flex flex-wrap gap-4 pt-4">
                  {uniqueCandidates.map(username => (
                    <button 
                      type="button"
                      aria-label={`View simulation logs for ${username}`}
                      key={username}
                      onClick={() => setSelectedCandidate(username)}
                      className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-zinc-900/80 border border-white/5 hover:border-red-500/50 hover:bg-red-500/10 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all cursor-pointer group/pill focus:outline-none focus:ring-2 focus:ring-red-500 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-xs font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.6)] group-hover/pill:animate-pulse">
                        {username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-white text-sm tracking-wide group-hover/pill:text-red-300 transition-colors pr-2">
                        {username}
                      </span>
                    </button>
                  ))}
                  {uniqueCandidates.length === 0 && (
                    <div className="w-full text-center py-20 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                      <p className="text-sm text-zinc-400">No candidates have completed simulations yet.</p>
                    </div>
                  )}
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                  <p className="text-sm text-zinc-400">No matching simulation records found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] text-zinc-400 uppercase tracking-wider">
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
                            <button 
                              type="button"
                              onClick={() => setSearchQuery(c.username)}
                              title="Click to filter by this candidate"
                              aria-label={`Filter logs by candidate ${c.username}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/5 hover:border-red-500/50 hover:bg-red-500/10 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all cursor-pointer group/pill focus:outline-none focus:ring-2 focus:ring-red-500 text-left"
                            >
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-[10px] font-black text-white shadow-[0_0_8px_rgba(239,68,68,0.8)] group-hover/pill:animate-pulse">
                                {c.username.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold text-white text-xs tracking-wide group-hover/pill:text-red-300 transition-colors">
                                {c.username}
                              </span>
                            </button>
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
                          <td className="py-4 px-2 text-center text-zinc-400 text-[10px]">{new Date(c.created_at).toLocaleDateString()}</td>
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
              ) : activeTab === "leaderboard" ? (
                <div className="overflow-x-auto">
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                      <p className="text-sm text-zinc-400">No candidates on the global leaderboard yet.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] text-zinc-400 uppercase tracking-wider">
                          <th className="pb-3 font-semibold text-center w-16">Rank</th>
                          <th className="pb-3 font-semibold">Candidate</th>
                          <th className="pb-3 font-semibold">Title</th>
                          <th className="pb-3 font-semibold text-center">Streak</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {leaderboard.map((c, i) => (
                          <tr 
                            key={c.user_id} 
                            onClick={() => handleOpenNeonModal(c)} 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOpenNeonModal(c);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`View statistics for ${c.username}`}
                            className="group hover:bg-white/[0.04] transition-all border-b border-white/5 last:border-0 cursor-pointer focus:outline-none focus:bg-white/[0.08]"
                          >
                            <td className="py-4 px-2 text-center">
                              {i === 0 ? <Crown className="w-5 h-5 mx-auto text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" /> :
                               i === 1 ? <Medal className="w-5 h-5 mx-auto text-zinc-300 drop-shadow-[0_0_8px_rgba(212,212,216,0.6)]" /> :
                               i === 2 ? <Award className="w-5 h-5 mx-auto text-amber-700 drop-shadow-[0_0_8px_rgba(180,83,9,0.6)]" /> :
                              <span className="text-sm font-black text-zinc-400">#{i + 1}</span>}
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
              ) : null}
        {activeTab === "exams" && (
          <>

            {/* Coding Exam metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <MetricCard 
                icon={<FileCode className="w-6 h-6 text-violet-400" />}
                title="Total Managed Exams"
                value={exams.length}
                sub="Lesson and Final exams configured"
              />
              <MetricCard 
                icon={<Play className="w-6 h-6 text-emerald-400" />}
                title="Active Exams"
                value={exams.filter(e => e.status === "active").length}
                sub="Open for new attempts"
              />
              <MetricCard 
                icon={<Clock className="w-6 h-6 text-rose-400" />}
                title="Ended Exams"
                value={exams.filter(e => e.status === "ended").length}
                sub="Completed & awaiting reviews"
              />
              <MetricCard 
                icon={<Layers className="w-6 h-6 text-amber-400" />}
                title="Active Review Submissions"
                value={reviewSubmissions.length}
                sub="Submissions for current review queue"
              />
            </div>

            {/* Exam Management Console */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-6">
              <div>
                <h2 className="text-md font-bold text-white uppercase tracking-wider">Exam Gating & Lifecycle Management</h2>
                <p className="text-xs text-zinc-500 mt-1">Control active state, view completion metadata, and change testing windows.</p>
              </div>

              {loadingExamsData ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                  <p className="text-xs text-zinc-500">Querying exams logs...</p>
                </div>
              ) : exams.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl">
                  <p className="text-sm text-zinc-500">No exams configured in your courses yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {exams.map((ex) => {
                    const isActionLoading = actionLoadingExamId?.includes(`${ex.id}-${ex.exam_type}`);
                    const isActive = activeReviewExam?.id === ex.id && activeReviewExam?.exam_type === ex.exam_type;
                    
                    return (
                      <div 
                        key={`${ex.exam_type}-${ex.id}`} 
                        className={`glass-card rounded-2xl p-6 border transition-all flex flex-col gap-4 bg-zinc-900/40 hover:bg-zinc-900/60 ${
                          isActive 
                            ? "border-violet-500/30 ring-1 ring-violet-500/20" 
                            : "border-white/5"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <h3 className="text-base font-extrabold text-white tracking-tight leading-snug break-words line-clamp-3">
                            {ex.title}
                          </h3>
                          {renderStatusBadge(ex.status)}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider block">Course</span>
                            <span className="text-zinc-300 font-medium">{ex.course_title}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider block">Lesson</span>
                            <span className="text-zinc-300 font-medium">
                              {ex.exam_type === "final" ? "Final Exam" : `Lesson ${ex.lesson_id}`}
                            </span>
                          </div>
                        </div>

                        {ex.status === "ended" && ex.ended_at && (
                          <div className="text-[10px] text-zinc-500 font-mono border-t border-white/5 pt-2 flex flex-col gap-0.5">
                            <span>Ended: {new Date(ex.ended_at).toLocaleString()}</span>
                            <span>By ID: {ex.ended_by}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/5 mt-auto">
                          {ex.status === "active" && (
                            <button
                              onClick={() => handleExamAction(ex.id, ex.exam_type, "end")}
                              disabled={!!isActionLoading}
                              className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-white hover:bg-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 border-0"
                            >
                              {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              End Test
                            </button>
                          )}

                          {ex.status === "ended" && (
                            <>
                              <button
                                onClick={() => selectExamForReview(ex)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isActive
                                    ? "bg-violet-600 text-white shadow shadow-violet-600/25"
                                    : "bg-zinc-800 border border-white/5 text-zinc-300 hover:text-white hover:border-violet-500/30 hover:bg-violet-500/10"
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Review Test
                              </button>

                              <button
                                onClick={() => handleExamAction(ex.id, ex.exam_type, "reopen")}
                                disabled={!!isActionLoading}
                                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:text-white hover:bg-emerald-600 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 border-0"
                              >
                                {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Reopen Test
                              </button>

                              <button
                                onClick={() => handleExamAction(ex.id, ex.exam_type, "archive")}
                                disabled={!!isActionLoading}
                                className="px-4 py-2 bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ml-auto flex items-center gap-1.5 border-0"
                              >
                                {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Archive
                              </button>
                            </>
                          )}

                          {ex.status === "archived" && (
                            <button
                              onClick={() => selectExamForReview(ex)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                isActive
                                  ? "bg-violet-600 text-white shadow shadow-violet-600/25"
                                  : "bg-zinc-800 border border-white/5 text-zinc-300 hover:text-white hover:border-violet-500/30 hover:bg-violet-500/10"
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Review
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submissions Review and Archived Reviews Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column (2/3 width) - Review Workspace */}
              <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-6">
                <div>
                  <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BookOpenCheck className="w-5 h-5 text-violet-400" />
                    {activeReviewExam 
                      ? `Review Queue: ${activeReviewExam.title}` 
                      : "Review Dashboard"}
                  </h3>
                  {activeReviewExam && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Showing student submissions for course: <span className="font-bold text-zinc-300">{activeReviewExam.course_title}</span>
                    </p>
                  )}
                </div>

                {!activeReviewExam ? (
                  <div className="text-center py-16 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                    <p className="text-sm text-zinc-500">Select an exam from the Management section or Archived list to start grading.</p>
                  </div>
                ) : reviewSubmissions.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                    <p className="text-sm text-zinc-500">No candidate submissions recorded for this exam yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-wider">
                          <th className="pb-3 font-semibold">Student</th>
                          <th className="pb-3 font-semibold text-center">AI Score</th>
                          <th className="pb-3 font-semibold text-center">Warnings</th>
                          <th className="pb-3 font-semibold text-center">Mentor Score</th>
                          <th className="pb-3 font-semibold text-center">Review Status</th>
                          <th className="pb-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {reviewSubmissions.map((sub) => (
                          <tr key={sub.id} className="group hover:bg-zinc-900/30 transition-colors">
                            <td className="py-4 font-bold text-white group-hover:text-violet-400 transition-colors">{sub.username}</td>
                            <td className="py-4 text-center text-zinc-400 font-semibold">{sub.ai_score}%</td>
                            <td className="py-4 text-center font-semibold">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  sub.warnings >= 3 
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                                    : sub.warnings > 0 
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                                      : "bg-emerald-500/10 text-emerald-400"
                                }`}>
                                  {sub.warnings} warnings
                                </span>
                                {violations.some(v => v.user_id === sub.user_id && v.course_id === sub.course_id) && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-extrabold animate-pulse uppercase tracking-wider flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3" /> Gaze Telemetry
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 text-center font-bold text-violet-400">
                              {sub.mentor_score !== null ? `${sub.mentor_score}%` : "—"}
                            </td>
                            <td className="py-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                sub.review_status === "reviewed"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}>
                                {sub.review_status}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedExamSubmission(sub);
                                  setGradingScore(sub.mentor_score !== null ? String(sub.mentor_score) : String(sub.ai_score));
                                  setGradingFeedback(sub.mentor_feedback || "");
                                }}
                                className="px-2.5 py-1.5 bg-zinc-800 border border-white/5 hover:border-violet-500/30 hover:bg-violet-500/10 rounded-lg text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer ml-auto flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>{sub.review_status === "reviewed" ? "Inspect" : "Grade & Review"}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right Column (1/3 width) - Archived Reviews */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-violet-400">
                  <Archive className="w-5 h-5" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Archived Reviews</h3>
                </div>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  Older ended or archived exams configured in your courses. Click on any to load its submission history.
                </p>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Latest Ended Exam Queue</div>
                  {latestEndedExam ? (
                    <button
                      onClick={() => selectExamForReview(latestEndedExam)}
                      className={`w-full p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                        activeReviewExam?.id === latestEndedExam.id && activeReviewExam?.exam_type === latestEndedExam.exam_type
                          ? "bg-violet-600/15 border-violet-500/30 text-white"
                          : "bg-zinc-950 border-transparent hover:border-white/5 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold block truncate">{latestEndedExam.title}</span>
                        <span className="shrink-0 px-1 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[8px] font-bold uppercase tracking-wide">Latest</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-zinc-500">
                        <span>{latestEndedExam.course_title}</span>
                        <span>{latestEndedExam.exam_type === "final" ? "Final" : "Lesson"}</span>
                      </div>
                    </button>
                  ) : (
                    <div className="text-[10px] text-zinc-600 py-2 border border-dashed border-white/5 rounded-xl text-center bg-zinc-950/20">No ended exams active.</div>
                  )}

                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-4 mb-1">Archived Exams</div>
                  {archivedExams.length === 0 ? (
                    <div className="text-[10px] text-zinc-600 py-4 border border-dashed border-white/5 rounded-xl text-center bg-zinc-950/20">No archived reviews found.</div>
                  ) : (
                    archivedExams.map((arch) => (
                      <button
                        key={`${arch.exam_type}-${arch.id}`}
                        onClick={() => selectExamForReview(arch)}
                        className={`w-full p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                          activeReviewExam?.id === arch.id && activeReviewExam?.exam_type === arch.exam_type
                            ? "bg-violet-600/15 border-violet-500/30 text-white"
                            : "bg-zinc-950 border-transparent hover:border-white/5 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold block truncate">{arch.title}</span>
                          {renderStatusBadge(arch.status)}
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-zinc-500">
                          <span>{arch.course_title}</span>
                          <span>{arch.exam_type === "final" ? "Final" : "Lesson"}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "mentor_management" && adminUser?.role === "admin" && (
          <div className="space-y-8">
            {/* Header / Dashboard Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center gap-4 bg-zinc-900/40 animate-fade-in">
                <div className="p-3.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Courses</p>
                  <p className="text-2xl font-black text-white">{allCourses.length}</p>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center gap-4 bg-zinc-900/40 animate-fade-in">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Mentors</p>
                  <p className="text-2xl font-black text-white">{allMentors.length}</p>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center gap-4 bg-zinc-900/40 animate-fade-in">
                <div className="p-3.5 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Assignments</p>
                  <p className="text-2xl font-black text-white">
                    {Object.values(courseAssignments).reduce((acc, curr) => acc + curr.length, 0)}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center gap-4 bg-zinc-900/40 animate-fade-in">
                <div className="p-3.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Recent Assignment Events</p>
                  <p className="text-2xl font-black text-white">{logTotal}</p>
                </div>
              </div>
            </div>

            {/* Current Course Assignments Card Section */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-6 bg-zinc-900/40">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-violet-400" /> Current Course Assignments
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">Assign multiple mentors to courses and view current access lists.</p>
                </div>
                
                {/* Search / Filter for Course Assignments */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 w-4 h-4 text-zinc-500 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={courseSearchQuery}
                    onChange={(e) => setCourseSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              {loadingAssignments ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                  <p className="text-xs text-zinc-500">Retrieving assignments...</p>
                </div>
              ) : allCourses.filter(c => c.title.toLowerCase().includes(courseSearchQuery.toLowerCase())).length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                  <p className="text-sm text-zinc-500">No courses matching search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {allCourses
                    .filter(c => c.title.toLowerCase().includes(courseSearchQuery.toLowerCase()))
                    .map((course) => {
                      const mentors = courseAssignments[course.id] || [];
                      // Find the most recent assignment metadata
                      const lastAssignment = mentors.reduce((latest, current) => {
                        if (!latest) return current;
                        if (!current.assigned_at) return latest;
                        return new Date(current.assigned_at) > new Date(latest.assigned_at) ? current : latest;
                      }, null as any);

                      const assignedBy = lastAssignment?.assigned_by ? `@${lastAssignment.assigned_by}` : "System Sync";
                      const lastUpdated = lastAssignment?.assigned_at ? new Date(lastAssignment.assigned_at).toLocaleDateString() : "—";

                      return (
                        <div key={course.id} className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col gap-5 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all hover:border-violet-500/20">
                          <div>
                            <h3 className="text-base font-bold text-white tracking-tight leading-snug break-words">
                              {course.title}
                            </h3>
                            <p className="text-xs text-zinc-500 mt-1">Course ID: {course.id}</p>
                          </div>

                          <div className="flex-1 space-y-3">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Assigned Mentors</div>
                            {mentors.length === 0 ? (
                              <p className="text-xs text-zinc-600 italic">No mentors assigned</p>
                            ) : (
                              <ul className="space-y-2">
                                {mentors.map((m) => (
                                  <li key={m.id} className="flex items-center justify-between gap-3 text-xs bg-zinc-950/40 p-2 rounded-lg border border-white/5">
                                    <span className="font-medium text-zinc-300">@{m.name}</span>
                                    <button
                                      onClick={() => handleRemoveMentorClick(course.id, m.id, m.name, course.title)}
                                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border-0"
                                    >
                                      Remove
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-[11px] text-zinc-500 border-t border-white/5 pt-4">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-zinc-600 block">Assigned By</span>
                              <span className="font-bold text-zinc-400">{assignedBy}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-zinc-600 block">Last Updated</span>
                              <span className="font-bold text-zinc-400">{lastUpdated}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedAssignCourseId(String(course.id));
                              setSelectedAssignMentorId("");
                              setShowAssignModal(true);
                            }}
                            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Assign Mentor
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "assignment_history" && adminUser?.role === "admin" && (
          <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-6 bg-zinc-900/40">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" /> Assignment History Logs
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Audit trail of all administrative mentor assignments and removals.</p>
              </div>

              {/* Search / Filter for Audit Logs */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 w-4 h-4 text-zinc-500 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                <p className="text-xs text-zinc-500">Querying audit trail...</p>
              </div>
            ) : assignmentLogs.filter(log => 
                log.course.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                log.mentor.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                log.admin.toLowerCase().includes(logSearchQuery.toLowerCase())
              ).length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                <p className="text-sm text-zinc-500">No events logged matching filter.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Course</th>
                        <th className="pb-3 font-semibold">Mentor</th>
                        <th className="pb-3 font-semibold">Action</th>
                        <th className="pb-3 font-semibold">Timestamp</th>
                        <th className="pb-3 font-semibold">Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {assignmentLogs
                        .filter(log => 
                          log.course.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                          log.mentor.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                          log.admin.toLowerCase().includes(logSearchQuery.toLowerCase())
                        )
                        .map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-900/10 transition-colors">
                            <td className="py-3 font-semibold text-white">{log.course}</td>
                            <td className="py-3">@{log.mentor}</td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  log.action === "assigned"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                }`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 text-[11px] text-zinc-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 font-bold text-zinc-400">@{log.admin}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {logPages > 0 && (
                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <p className="text-zinc-500 text-[11px]">
                      Page {logPage} of {logPages} ({logTotal} total events)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchAssignmentLogs(adminUser.id, logPage - 1)}
                        disabled={logPage <= 1}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 text-zinc-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => fetchAssignmentLogs(adminUser.id, logPage + 1)}
                        disabled={logPage >= logPages}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 text-zinc-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "course_deletion" && adminUser?.role === "admin" && (
          <div className="space-y-8 animate-fade-in text-left">
            {/* Header Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center gap-4 bg-zinc-900/40">
                <div className="p-3.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Deleted Courses</p>
                  <p className="text-2xl font-black text-white">
                    {allCourses.filter(c => c.status === "deleted").length}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center gap-4 bg-zinc-900/40">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Active Courses</p>
                  <p className="text-2xl font-black text-white">
                    {allCourses.filter(c => c.status === "active" || !c.status).length}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center gap-4 bg-zinc-900/40">
                <div className="p-3.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Pending Purges</p>
                  <p className="text-2xl font-black text-white">
                    {allCourses.filter(c => c.status === "deleted" && !isEligibleForPurge(c.deleted_at)).length}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center gap-4 bg-zinc-900/40">
                <div className="p-3.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Audit Logs</p>
                  <p className="text-2xl font-black text-white">{deletionLogTotal}</p>
                </div>
              </div>
            </div>

            {/* Courses Deletion Management Card */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-6 bg-zinc-900/40">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-rose-400" /> Course Deletion & Recovery System
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">Soft-delete courses, recover active courses, or permanently purge courses after the 30-day retention countdown.</p>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 w-4 h-4 text-zinc-500 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={courseSearchQuery}
                    onChange={(e) => setCourseSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              {allCourses.filter(c => c.title.toLowerCase().includes(courseSearchQuery.toLowerCase())).length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                  <p className="text-sm text-zinc-500">No courses matching search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {allCourses
                    .filter(c => c.title.toLowerCase().includes(courseSearchQuery.toLowerCase()))
                    .map((course) => {
                      const isActive = course.status === "active" || !course.status;
                      const isDeleted = course.status === "deleted";
                      const purgeCountdownText = isDeleted ? getPurgeCountdownText(course.deleted_at) : "";
                      const eligibleForPurge = isDeleted ? isEligibleForPurge(course.deleted_at) : false;

                      return (
                        <div key={course.id} className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col justify-between gap-5 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all hover:border-rose-500/20">
                          <div>
                            <div className="flex justify-between items-start gap-4">
                              <h3 className="text-base font-bold text-white tracking-tight leading-snug break-words">
                                {course.title}
                              </h3>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  isActive
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                }`}
                              >
                                {isActive ? "🟢 Active" : "🔴 Deleted"}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">Course ID: {course.id}</p>
                            <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{course.description}</p>
                          </div>

                          <div className="space-y-4 border-t border-white/5 pt-4">
                            {isDeleted && (
                              <div className="flex items-center gap-2 text-xs">
                                <Clock className="w-4 h-4 text-rose-400" />
                                <span className={eligibleForPurge ? "text-emerald-400 font-bold" : "text-amber-400 font-semibold"}>
                                  {purgeCountdownText}
                                </span>
                              </div>
                            )}

                            <div className="flex gap-2">
                              {isActive ? (
                                <button
                                  onClick={() => openDeleteWorkflow(course)}
                                  className="w-full py-2 bg-rose-650/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-450 hover:text-rose-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-0"
                                >
                                  Delete Course
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleActionClick(course, "restore")}
                                    className="w-1/2 py-2 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-0"
                                  >
                                    Restore Course
                                  </button>
                                  <button
                                    onClick={() => handleActionClick(course, "purge")}
                                    disabled={!eligibleForPurge}
                                    className={`w-1/2 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-0 ${
                                      eligibleForPurge
                                        ? "bg-rose-600 hover:bg-rose-700 text-white border border-rose-500/20"
                                        : "bg-zinc-950 text-zinc-600 border border-white/5 cursor-not-allowed opacity-50"
                                    }`}
                                  >
                                    Permanently Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Deletion Audit History */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-6 bg-zinc-900/40">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-5 h-5 text-rose-400" /> Course Deletion History
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">Audit log tracking all course deletion, restoration, and permanent purge actions.</p>
                </div>
              </div>

              {loadingDeletionLogs ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                  <p className="text-xs text-zinc-500">Querying audit history...</p>
                </div>
              ) : deletionLogs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl bg-zinc-900/10">
                  <p className="text-sm text-zinc-500">No course deletion events logged.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-wider">
                          <th className="pb-3 font-semibold">Course</th>
                          <th className="pb-3 font-semibold">Admin</th>
                          <th className="pb-3 font-semibold">Action</th>
                          <th className="pb-3 font-semibold">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-300">
                        {deletionLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-900/10 transition-colors">
                            <td className="py-3 font-semibold text-white">{log.course_title}</td>
                            <td className="py-3 font-bold text-zinc-400">@{log.admin_name}</td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  log.action === "deleted"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : log.action === "restored"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                }`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 text-[11px] text-zinc-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {deletionLogPages > 0 && (
                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <p className="text-zinc-500 text-[11px]">
                        Page {deletionLogPage} of {deletionLogPages} ({deletionLogTotal} total logs)
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fetchDeletionLogs(deletionLogPage - 1)}
                          disabled={deletionLogPage <= 1}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 text-zinc-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => fetchDeletionLogs(deletionLogPage + 1)}
                          disabled={deletionLogPage >= deletionLogPages}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 text-zinc-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}


            </div>

            {/* Settings panel card (30% width) */}
            {!["exams", "mentor_management", "assignment_history", "course_deletion"].includes(activeTab) && (
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
                <div className="space-y-2 text-[11px] text-zinc-400">
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
                    <span className="text-zinc-300">{metrics.active_sessions || 0} current candidate channels</span>
                  </div>
                </div>
              </div>
            </div>
            )}

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
                    className="p-2.5 rounded-full hover:bg-purple-500/10 border border-transparent hover:border-purple-500/30 hover:text-purple-400 text-zinc-400 transition-all cursor-pointer shadow-inner"
                    title="Download PDF Report"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-2.5 rounded-full hover:bg-red-500/10 border border-transparent hover:border-red-500/30 hover:text-red-400 text-zinc-400 transition-all cursor-pointer shadow-inner"
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-6 w-full text-xs text-indigo-300/70 font-mono">
                        {dimensions.map((d) => (
                          <div key={d.key} className="flex justify-between items-center border-b border-white/5 py-2">
                            <span className="uppercase tracking-[0.15em]">{d.label}:</span>
                            <span className="font-bold text-white tracking-widest text-[13px] whitespace-nowrap">{(selectedRecord as any)[d.key]}/100</span>
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

        {/* Assign Mentor Modal */}
        <AnimatePresence>
          {showAssignModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAssignModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-[#0B0914]/95 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-2xl z-10"
              >
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" /> Assign Mentor
                  </h3>
                  <button onClick={() => setShowAssignModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={handleAssignMentor} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Select Mentor</label>
                    <div className="relative">
                      <div 
                        onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
                        className={`w-full flex items-center justify-between bg-zinc-900/80 border ${assignDropdownOpen ? 'border-amber-500/50 ring-1 ring-amber-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-sm text-white cursor-pointer transition-all hover:bg-zinc-800/80`}
                      >
                        <span className={!selectedAssignMentorId ? "text-zinc-500" : "text-white"}>
                          {selectedAssignMentorId 
                            ? (() => {
                                const m = availableMentors.find(x => x.id.toString() === selectedAssignMentorId);
                                return m ? `${m.name} (@${m.username})` : "-- Choose a mentor --";
                              })()
                            : "-- Choose a mentor --"}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${assignDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
                      </div>
                      
                      <AnimatePresence>
                        {assignDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setAssignDropdownOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20 max-h-60 overflow-y-auto"
                            >
                              {availableMentors.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-zinc-500 italic">No mentors available for this course</div>
                              ) : (
                                availableMentors.map(m => (
                                  <div
                                    key={m.id}
                                    onClick={() => {
                                      setSelectedAssignMentorId(m.id.toString());
                                      setAssignDropdownOpen(false);
                                    }}
                                    className={`px-4 py-3 text-sm cursor-pointer transition-colors flex justify-between items-center ${selectedAssignMentorId === m.id.toString() ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}
                                  >
                                    <span>{m.name} <span className="text-zinc-500 text-xs ml-1">(@{m.username})</span></span>
                                    {selectedAssignMentorId === m.id.toString() && <Check className="w-4 h-4 text-amber-500" />}
                                  </div>
                                ))
                              )}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assigning || !selectedAssignMentorId}
                      className="px-6 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      {assigning ? "Assigning..." : "Assign"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Generic Confirm Modal */}
        <AnimatePresence>
          {confirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmModal(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-[#0B0914]/95 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-2xl z-10 text-center"
              >
                <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                  <ShieldAlert className="w-6 h-6 text-rose-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-zinc-400 mb-6">{confirmModal.message}</p>
                
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      confirmModal.onConfirm();
                      setConfirmModal(null);
                    }}
                    className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Soft Delete Course Modal */}
        <AnimatePresence>
          {showDeleteWorkflow && selectedDeleteCourse && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDeleteWorkflow(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-[#0B0914]/95 backdrop-blur-3xl border border-rose-500/20 rounded-3xl p-6 shadow-[0_0_50px_rgba(244,63,94,0.1)] z-10"
              >
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-lg font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2">
                    <Trash2 className="w-5 h-5" /> Soft Delete Course
                  </h3>
                  <button onClick={() => setShowDeleteWorkflow(false)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={executeDeleteCourse} className="space-y-4">
                  <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 space-y-3">
                    <p className="text-sm text-zinc-300">
                      You are preparing to soft-delete <strong className="text-white">{selectedDeleteCourse.title}</strong>. 
                      This course and its data will be retained for 30 days before becoming eligible for a permanent purge.
                    </p>
                    
                    {deletionSummary && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                          <span className="text-zinc-500 uppercase tracking-widest block mb-1">Impacted Candidates</span>
                          <span className="text-xl font-bold text-white">{deletionSummary.enrollments}</span>
                        </div>
                        <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                          <span className="text-zinc-500 uppercase tracking-widest block mb-1">Assigned Mentors</span>
                          <span className="text-xl font-bold text-white">{deletionSummary.mentor_assignments}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {deleteErrorMessage && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <p className="text-xs text-rose-400 font-medium">{deleteErrorMessage}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                        Type "{selectedDeleteCourse.title}" to confirm
                      </label>
                      <input
                        type="text"
                        value={confirmDeleteText}
                        onChange={(e) => setConfirmDeleteText(e.target.value)}
                        required
                        placeholder="Type course name exactly..."
                        className="w-full bg-zinc-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Admin Password</label>
                      <input
                        type="password"
                        value={confirmDeletePassword}
                        onChange={(e) => setConfirmDeletePassword(e.target.value)}
                        required
                        placeholder="Enter password to authorize..."
                        className="w-full bg-zinc-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowDeleteWorkflow(false)}
                      className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingDelete || confirmDeleteText.toLowerCase() !== selectedDeleteCourse.title.toLowerCase() || !confirmDeletePassword}
                      className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submittingDelete ? "Deleting..." : "Soft Delete"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Password Confirmation Modal */}
        <AnimatePresence>
          {showPasswordConfirmModal && selectedActionCourse && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPasswordConfirmModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-[#0B0914]/95 backdrop-blur-3xl border border-rose-500/20 rounded-3xl p-6 shadow-[0_0_50px_rgba(244,63,94,0.1)] z-10"
              >
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-lg font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" /> Admin Authorization
                  </h3>
                  <button onClick={() => setShowPasswordConfirmModal(false)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={executeActionWithPassword} className="space-y-4">
                  <div>
                    <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
                      You are about to <strong className="text-white">{passwordConfirmAction === "restore" ? "RESTORE" : "PERMANENTLY PURGE"}</strong> the course <strong className="text-rose-400">"{selectedActionCourse.title}"</strong>.
                    </p>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Admin Password</label>
                    <input
                      type="password"
                      value={confirmActionPassword}
                      onChange={(e) => setConfirmActionPassword(e.target.value)}
                      required
                      placeholder="Enter password to authorize..."
                      className="w-full bg-zinc-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-colors"
                    />
                  </div>

                  {actionErrorMessage && (
                    <p className="text-xs text-rose-400 text-center font-medium mt-2">{actionErrorMessage}</p>
                  )}
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirmModal(false)}
                      className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingAction || !confirmActionPassword}
                      className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submittingAction ? "Authorizing..." : "Authorize Action"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Mentor Grading & Review Modal */}
        <AnimatePresence>
          {selectedExamSubmission && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-lg bg-[#0B0914]/95 backdrop-blur-3xl border border-violet-500/20 rounded-3xl p-5 md:p-6 shadow-[0_0_60px_rgba(139,92,246,0.15)] relative overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar"
              >
                <div className="absolute inset-0 pointer-events-none rounded-3xl border border-transparent [background:linear-gradient(45deg,rgba(139,92,246,0.15),rgba(59,130,246,0.15))_border-box] [mask:linear-gradient(#fff_0_0)_padding-box,linear-gradient(#fff_0_0)] mask-composite-exclude shadow-[inset_0_0_30px_rgba(139,92,246,0.05)]" />

                <div className="flex justify-between items-center mb-4 relative z-10">
                  <h3 className="text-xl font-bold text-white tracking-wide">
                    {selectedExamSubmission.review_status === "reviewed" ? "Inspect Submission" : "Grade & Review"}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedExamSubmission(null);
                      setGradingScore("");
                      setGradingFeedback("");
                    }}
                    className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 mb-4 relative z-10">
                  <div className="flex gap-3">
                    <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Candidate ID</p>
                      <p className="text-base font-bold text-white">{selectedExamSubmission.user_id}</p>
                    </div>
                    <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Candidate Name</p>
                      <p className="text-base font-bold text-white">{selectedExamSubmission.username || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">AI Score</p>
                      <p className="text-lg font-black text-violet-400">{selectedExamSubmission.ai_score}%</p>
                    </div>
                    {selectedExamSubmission.review_status === "reviewed" && (
                      <div className="flex-1 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-bold mb-1">Mentor Score</p>
                        <p className="text-lg font-black text-emerald-400">{selectedExamSubmission.mentor_score}%</p>
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleGradeSubmission} className="space-y-3 relative z-10">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Final Mentor Score (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={gradingScore}
                      onChange={(e) => setGradingScore(e.target.value)}
                      disabled={selectedExamSubmission.review_status === "reviewed"}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">AI Feedback</label>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-[11px] whitespace-pre-wrap mb-3 max-h-24 overflow-y-auto custom-scrollbar">
                      {selectedExamSubmission.feedback || "No AI feedback available."}
                    </div>

                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Mentor Notes</label>
                    <textarea
                      rows={3}
                      value={selectedExamSubmission.review_status === "reviewed" && !gradingFeedback ? "Same as AI feedback" : gradingFeedback}
                      onChange={(e) => setGradingFeedback(e.target.value)}
                      disabled={selectedExamSubmission.review_status === "reviewed"}
                      placeholder="Add mentor notes here..."
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  
                  {selectedExamSubmission.review_status !== "reviewed" && (
                    <button
                      type="submit"
                      disabled={submittingGrade}
                      className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] cursor-pointer"
                    >
                      {submittingGrade ? "Submitting..." : "Submit Final Grade"}
                    </button>
                  )}
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Neon Candidate Modal */}
        <AnimatePresence>
          {selectedNeonCandidate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedNeonCandidate(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-gradient-to-b from-[#1a0505]/60 to-[#0a0000]/80 backdrop-blur-3xl border border-[#ff4500]/20 rounded-[2.5rem] overflow-hidden z-10 shadow-[0_0_80px_rgba(255,69,0,0.05)]"
              >
                {/* Glowing borders */}
                <div className="absolute inset-0 pointer-events-none rounded-[2.5rem] border border-transparent [background:linear-gradient(45deg,rgba(255,69,0,0.15),rgba(220,38,38,0.05))_border-box] [mask:linear-gradient(#fff_0_0)_padding-box,linear-gradient(#fff_0_0)] mask-composite-exclude shadow-[inset_0_0_40px_rgba(255,69,0,0.05)]" />
                
                <div className="relative z-10 p-10 flex flex-col items-center">
                  <button
                    onClick={() => setSelectedNeonCandidate(null)}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-[#ff4500]/10 text-zinc-400 hover:text-[#ff4500] transition-colors z-20"
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
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{title}</span>
          </div>
          <p className="text-4xl font-black text-white mt-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-red-300 group-hover:to-red-600 transition-all duration-500">{value}</p>
          <span className="text-[10px] text-zinc-400 font-medium tracking-wide mt-1">{sub}</span>
        </div>
      </div>
      );
}
