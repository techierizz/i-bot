"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, ArrowLeft, GraduationCap, ChevronRight, Award, Clock, Star, Zap, User, LogOut, Plus, Loader2, Sparkles, Settings } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "../config";

const CustomSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder,
  disabled
}: { 
  value: string, 
  onChange: (v: string) => void, 
  options: { label: string, value: string }[], 
  placeholder: string,
  disabled?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find(o => String(o.value) === String(value))?.label || placeholder;

  return (
    <div className="relative">
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm transition-all flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-violet-500/50'} ${isOpen ? 'border-violet-500' : ''}`}
      >
        <span className={value ? "text-white" : "text-zinc-400"}>{selectedLabel}</span>
        <svg className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-50 w-full mt-2 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden py-1 max-h-60 overflow-y-auto">
            <div 
              onClick={() => { onChange(""); setIsOpen(false); }}
              className={`px-4 py-3 text-sm cursor-pointer transition-all ${value === "" ? "bg-violet-500/20 text-violet-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
            >
              {placeholder}
            </div>
            {options.map(opt => (
              <div 
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`px-4 py-3 text-sm cursor-pointer transition-all ${String(value) === String(opt.value) ? "bg-violet-500/20 text-violet-300" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface Course {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  tags: string[];
  mentor_name: string;
  created_at: string;
  modules_count?: number;
}

interface Enrollment {
  enrollment_id: number;
  course_id: number;
  status: string;
  xp_earned: number;
  certificate_id: string | null;
  enrolled_at: string;
  completed_at: string | null;
}

export default function LearningCatalogPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);

  // Creator panel states
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);

  // New exam form fields
  const [examCourseId, setExamCourseId] = useState("");
  const [examLessonId, setExamLessonId] = useState("");
  const [examScope, setExamScope] = useState("lesson");
  const [assignmentType, setAssignmentType] = useState("code_completion");
  const [examType, setExamType] = useState("ai_generated");

  // Force custom mode for manual assignments
  useEffect(() => {
    if (assignmentType === "github_pr" || assignmentType === "system_design") {
      setExamType("custom");
    }
  }, [assignmentType]);

  const [githubRepoUrl, setGithubRepoUrl] = useState("");

  // Auto-fill templates based on assignment type
  useEffect(() => {
    const templates: Record<string, string> = {
      code_completion: "Fill in the missing parts of the code to make it work. Do not modify the existing function signatures.",
      bug_hunt: "There are several hidden bugs in the provided code. Find and fix them so that the tests pass.",
      refactoring: "The provided code works but is poorly written. Refactor it to be clean, efficient, and follow Object-Oriented principles without breaking functionality.",
      tdd: "Write code from scratch to satisfy the failing test cases. Focus on passing the tests one by one.",
      github_pr: `1. Fork the provided GitHub repository.
2. Clone it to your local machine and fix the issue.
3. Open a Pull Request on the original repository.
4. Paste your Pull Request URL below.`,
      api_integration: "Write a script that connects to the provided API URL, fetches the JSON data, and parses it according to the requirements.",
      system_design: "Design the architecture and database schema for the given system. You may use Markdown to format your response."
    };

    // Only auto-fill if empty or if it exactly matches another known template
    const currentIsTemplate = Object.values(templates).includes(examDesc.trim()) || examDesc.trim() === "";
    if (currentIsTemplate && assignmentType) {
      setExamDesc(templates[assignmentType] || "");
    }
  }, [assignmentType]);

  const [examTitle, setExamTitle] = useState("");
  const [examDesc, setExamDesc] = useState("");
  const [examDifficulty, setExamDifficulty] = useState("Intermediate");
  const [examLanguage, setExamLanguage] = useState("python");
  const [examBoilerplate, setExamBoilerplate] = useState("");
  const [examOptimalExplanation, setExamOptimalExplanation] = useState("");
  const [examTopics, setExamTopics] = useState("");
  const [examNumQuestions, setExamNumQuestions] = useState(1);
  const [examTestCases, setExamTestCases] = useState<Array<{ input: string; expected: string }>>([
    { input: "", expected: "" }
  ]);
  const [lessonsForCourse, setLessonsForCourse] = useState<any[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [creatingExam, setCreatingExam] = useState(false);

  // New course form fields
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [newCourseDifficulty, setNewCourseDifficulty] = useState("Beginner");
  const [newCourseTags, setNewCourseTags] = useState("");
  const [newCourseChatbotEnabled, setNewCourseChatbotEnabled] = useState(true);
  const [creatingCourse, setCreatingCourse] = useState(false);

  // New lesson form fields
  const [newLessonCourseId, setNewLessonCourseId] = useState("");
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonVideo, setNewLessonVideo] = useState("");
  const [newLessonContent, setNewLessonContent] = useState("");
  const [newLessonCode, setNewLessonCode] = useState("");
  const [newLessonLang, setNewLessonLang] = useState("python");
  const [newLessonOrder, setNewLessonOrder] = useState(1);
  const [autoGenExplanation, setAutoGenExplanation] = useState(true);
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVideo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/learning/upload-video`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok || data.status === "success") {
        setNewLessonVideo(data.video_url);
        alert("Video uploaded successfully!");
      } else {
        alert(data.detail || data.message || "Failed to upload video.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading video.");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreatingCourse(true);
    try {
      const tagsArray = newCourseTags.split(",").map(t => t.trim()).filter(Boolean);
      const response = await fetch(`${API_BASE_URL}/api/learning/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newCourseTitle,
          description: newCourseDesc,
          created_by: user.id,
          difficulty: newCourseDifficulty,
          tags: tagsArray,
          chatbot_enabled: newCourseChatbotEnabled
        }),
      });
      const data = await response.json();
      if (response.ok || data.status === "success") {
        alert("Course created successfully!");
        setShowCourseModal(false);
        setNewCourseTitle("");
        setNewCourseDesc("");
        setNewCourseDifficulty("Beginner");
        setNewCourseTags("");
        setNewCourseChatbotEnabled(true);
        
        // Refresh courses
        const courseRes = await fetch(`${API_BASE_URL}/api/learning/courses`);
        const courseList = await courseRes.json();
        setCourses(courseList);
      } else {
        alert(data.detail || data.message || "Failed to create course.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating course.");
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonCourseId) {
      alert("Please select a course.");
      return;
    }
    setCreatingLesson(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/learning/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: Number(newLessonCourseId),
          title: newLessonTitle,
          content: newLessonContent,
          video_url: newLessonVideo,
          practice_code: newLessonCode,
          language: newLessonLang,
          order_index: Number(newLessonOrder),
          auto_generate: autoGenExplanation,
          mentor_id: user?.id
        }),
      });
      const data = await response.json();
      if (response.ok || data.status === "success") {
        alert("Lesson created successfully!");
        setShowLessonModal(false);
        setNewLessonTitle("");
        setNewLessonVideo("");
        setNewLessonContent("");
        setNewLessonCode("");
        setNewLessonLang("python");
        setNewLessonOrder(prev => prev + 1);
      } else {
        alert(data.detail || data.message || "Failed to create lesson.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating lesson.");
    } finally {
      setCreatingLesson(false);
    }
  };

  const addTestCase = () => {
    setExamTestCases([...examTestCases, { input: "", expected: "" }]);
  };

  const removeTestCase = (index: number) => {
    if (examTestCases.length <= 1) return;
    setExamTestCases(examTestCases.filter((_, i) => i !== index));
  };

  const updateTestCase = (index: number, field: "input" | "expected", value: string) => {
    const updated = [...examTestCases];
    updated[index][field] = value;
    setExamTestCases(updated);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCourseId || (examScope === "lesson" && !examLessonId)) {
      alert("Please select a course and lesson.");
      return;
    }
    setCreatingExam(true);
    try {
      const isFinal = examScope === "final";
      const url = isFinal ? `${API_BASE_URL}/api/mentor/final-exams` : `${API_BASE_URL}/api/mentor/exams`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: Number(examCourseId),
          ...(isFinal ? {} : { lesson_id: Number(examLessonId) }),
          exam_type: examType,
          assignment_type: examScope === "lesson" ? assignmentType : undefined,
          github_repo_url: examScope === "lesson" && assignmentType === "github_pr" ? githubRepoUrl : undefined,
          title: examTitle || undefined,
          description: examDesc || undefined,
          instructions: examDesc || undefined,
          difficulty: examDifficulty,
          num_questions: examNumQuestions,
          language: examLanguage,
          boilerplate_code: examBoilerplate,
          test_cases: examTestCases.map(tc => ({
            input: tc.input,
            expected: tc.expected
          })),
          optimal_solution_explanation: examOptimalExplanation,
          topics: examTopics,
          user_id: user.id
        }),
      });
      const data = await response.json();
      if (response.ok || data.status === "success") {
        alert("Exam configured successfully!");
        setShowExamModal(false);
        setExamCourseId("");
        setExamLessonId("");
        setExamType("ai_generated");
        setAssignmentType("code_completion");
        setGithubRepoUrl("");
        setExamTitle("");
        setExamDesc("");
        setExamDifficulty("Intermediate");
        setExamNumQuestions(1);
        setExamLanguage("python");
        setExamBoilerplate("");
        setExamOptimalExplanation("");
        setExamTopics("");
        setExamTestCases([{ input: "", expected: "" }]);
      } else {
        alert(data.detail || data.message || "Failed to create exam.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating exam.");
    } finally {
      setCreatingExam(false);
    }
  };

  useEffect(() => {
    if (!examCourseId) {
      setLessonsForCourse([]);
      return;
    }
    setLoadingLessons(true);
    fetch(`${API_BASE_URL}/api/learning/courses/${examCourseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.lessons) {
          setLessonsForCourse(data.lessons);
        }
      })
      .catch((err) => console.error("Error fetching lessons:", err))
      .finally(() => setLoadingLessons(false));
  }, [examCourseId]);

  useEffect(() => {
    let session = localStorage.getItem("hiremind_user");
    if (!session) {
      session = localStorage.getItem("hiremind_admin");
    }
    if (!session) {
      router.push("/login?redirect=/learning");
      return;
    }
    const loggedUser = JSON.parse(session);
    setUser(loggedUser);

    let courseUrl = `${API_BASE_URL}/api/learning/courses`;
    if (loggedUser.role === "admin") {
      courseUrl = `${API_BASE_URL}/api/admin/courses?admin_id=${loggedUser.id}`;
    } else if (loggedUser.role === "mentor") {
      courseUrl = `${API_BASE_URL}/api/mentor/courses?mentor_id=${loggedUser.id}`;
    }


    Promise.all([
      fetch(courseUrl).then((r) => r.json()),
      fetch(`${API_BASE_URL}/api/learning/enrollments/${loggedUser.id}`).then((r) => r.json()),
    ])
      .then(([courseList, enrollList]) => {
        setCourses(Array.isArray(courseList) ? courseList : []);
        setEnrollments(Array.isArray(enrollList) ? enrollList : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const handleEnroll = async (courseId: number) => {
    if (!user) return;
    setEnrollingId(courseId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/learning/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, course_id: courseId }),
      });
      const data = await response.json();
      if (response.ok || data.status === "success") {
        // Refresh enrollments
        const enrollRes = await fetch(`${API_BASE_URL}/api/learning/enrollments/${user.id}`);
        const enrollList = await enrollRes.json();
        setEnrollments(enrollList);
        router.push(`/learning/${courseId}`);
      } else {
        alert(data.detail || data.message || "Failed to enroll.");
      }
    } catch (err) {
      console.error(err);
      alert("Error enrolling in course.");
    } finally {
      setEnrollingId(null);
    }
  };

  const getEnrollmentForCourse = (courseId: number) => {
    return enrollments.find((e) => e.course_id === courseId);
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case "beginner":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "intermediate":
        return "text-violet-400 bg-violet-500/10 border-violet-500/20";
      case "expert":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default:
        return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("hiremind_user");
    localStorage.removeItem("hiremind_admin");
    setUser(null);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Entering Learning Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-x-hidden pb-20">
      {/* Background ambient glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] bg-violet-900/10 pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] bg-fuchsia-900/10 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-violet-400" />
            <h1 className="text-xl font-bold text-white">HireMind Learning Hub</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && user.role !== "mentor" && user.role !== "admin" && (
            <button
              onClick={() => router.push("/credentials")}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <Award className="w-4 h-4 text-fuchsia-400" /> <span className="hidden md:inline">Verified Credentials</span>
            </button>
          )}
          {user && (
            <>
              {(user.role === "mentor" || user.role === "admin") && (
                <button
                  onClick={() => router.push("/admin/dashboard")}
                  className={`px-4 py-2 bg-zinc-900 border border-white/5 hover:bg-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    user.role === "admin"
                      ? "text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
                      : "text-fuchsia-400 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/10"
                  }`}
                >
                  {user.role === "admin" ? "Admin Console" : "Mentor Console"}
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* Banner Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-zinc-900/80 via-zinc-950 to-violet-950/20 p-8 md:p-14 overflow-hidden flex flex-col md:flex-row justify-between items-center gap-12 shadow-[0_0_30px_rgba(139,92,246,0.05)] group"
        >
          {/* Animated Background Gradients & Glows */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[100px] mix-blend-screen animate-pulse pointer-events-none" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-0 left-[-10%] w-[400px] h-[400px] bg-fuchsia-600/5 rounded-full blur-[80px] mix-blend-screen pointer-events-none" />

          <div className="space-y-6 max-w-2xl text-center md:text-left relative z-10">
            <motion.span 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-black uppercase tracking-[0.2em] inline-flex items-center gap-2 shadow-[0_0_10px_rgba(139,92,246,0.1)] backdrop-blur-md"
            >
              <Zap className="w-4 h-4 text-fuchsia-400" /> 
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">AI-Certified Roadmap</span>
            </motion.span>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-4xl md:text-6xl font-black text-white leading-[1.15] tracking-tight"
            >
              Ditch static resumes.<br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-violet-400 bg-clip-text text-transparent">
                Prove your skills in real-time.
              </span>
            </motion.h2>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-zinc-400 text-lg md:text-xl font-medium leading-relaxed max-w-xl"
            >
              Complete standard curriculum curated by verified industry mentors, take the timed proctored AI coding test, and seal verifiable skills directly on your public profile.
            </motion.p>
          </div>

          {/* 3D-like Glowing Orb Badge */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.5, duration: 0.8, type: "spring" }}
            className="shrink-0 relative w-56 h-56 md:w-72 md:h-72 z-10 hidden sm:flex items-center justify-center"
          >
            {/* Spinning Outer Rings */}
            <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-violet-500/30 animate-[spin_8s_linear_infinite] shadow-[0_0_15px_rgba(139,92,246,0.05)]" />
            <div className="absolute inset-4 rounded-full border-b-2 border-l-2 border-fuchsia-500/30 animate-[spin_6s_linear_infinite_reverse]" />
            <div className="absolute inset-8 rounded-full border-t border-r border-violet-400/20 animate-[spin_10s_linear_infinite]" />
            
            {/* Core Orb */}
            <div className="w-40 h-40 md:w-48 md:h-48 bg-zinc-900/80 backdrop-blur-xl rounded-full flex flex-col items-center justify-center border border-white/10 shadow-[0_0_20px_rgba(139,92,246,0.1)] relative overflow-hidden group-hover:scale-105 transition-transform duration-500 cursor-pointer">
              {/* Inner Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/20 to-fuchsia-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <GraduationCap className="w-16 h-16 md:w-20 md:h-20 text-violet-300 drop-shadow-[0_0_5px_rgba(139,92,246,0.4)] mb-2 group-hover:scale-110 transition-transform duration-500" />
              <span className="text-xs font-black bg-gradient-to-r from-zinc-300 to-white bg-clip-text text-transparent uppercase tracking-[0.25em] z-10">Validate</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Mentor Creator Panel */}
        {(user?.role === "mentor" || user?.role === "admin") && (
          <div className="p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/40 via-violet-950/5 to-zinc-900/40 space-y-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] bg-violet-500/10 pointer-events-none" />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                  <Settings className="w-3 h-3" /> Curator Mode
                </span>
                <h3 className="text-2xl font-black text-white">Mentor Creator Hub</h3>
                <p className="text-zinc-500 text-xs">Design custom learning modules and proctored coding tests.</p>
              </div>

              <div className="flex items-center gap-3">
                {user?.role === "admin" && (
                  <button
                    onClick={() => setShowCourseModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-violet-500/10 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Create Course
                  </button>
                )}
                <button
                  onClick={() => setShowLessonModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/5 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Lesson
                </button>
                <button
                  onClick={() => setShowExamModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-violet-500/10 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Create Exam
                </button>
              </div>
            </div>

            {/* Create Course Modal/Form (Admin Only) */}
            {showCourseModal && user?.role === "admin" && (
              <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950/80 space-y-4 animate-fadeIn">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  Create New Course (Admin Only)
                </h4>
                <form onSubmit={handleCreateCourse} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Course Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Advanced Golang Microservices"
                      value={newCourseTitle}
                      onChange={(e) => setNewCourseTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Difficulty Level</label>
                    <CustomSelect
                      value={newCourseDifficulty}
                      onChange={setNewCourseDifficulty}
                      placeholder="Select Difficulty"
                      options={[
                        { label: "Beginner", value: "Beginner" },
                        { label: "Intermediate", value: "Intermediate" },
                        { label: "Expert", value: "Expert" }
                      ]}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Description</label>
                    <textarea
                      required
                      placeholder="Enter a brief course overview..."
                      value={newCourseDesc}
                      onChange={(e) => setNewCourseDesc(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Tags (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Go, Backend, Microservices"
                      value={newCourseTags}
                      onChange={(e) => setNewCourseTags(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="newCourseChatbotEnabled"
                      checked={newCourseChatbotEnabled}
                      onChange={(e) => setNewCourseChatbotEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-violet-500 focus:ring-violet-500 cursor-pointer"
                    />
                    <label htmlFor="newCourseChatbotEnabled" className="text-xs text-zinc-300 select-none cursor-pointer flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Enable AI Hint Chatbot during coding verification quizzes
                    </label>
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCourseModal(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingCourse}
                      className="px-6 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 disabled:opacity-50 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {creatingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Course"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Create Lesson Modal/Form */}
            {showLessonModal && (
              <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950/80 space-y-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Add Lesson Module
                </h4>
                <form onSubmit={handleCreateLesson} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Target Course</label>
                    <CustomSelect
                      value={newLessonCourseId}
                      onChange={setNewLessonCourseId}
                      placeholder="Select a Course"
                      options={courses.map(c => ({ label: c.title, value: String(c.id) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Lesson Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Goroutines & Mutexes"
                      value={newLessonTitle}
                      onChange={(e) => setNewLessonTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Lesson Order Index</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newLessonOrder}
                      onChange={(e) => setNewLessonOrder(Number(e.target.value))}
                      style={{ colorScheme: "dark" }}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="autoGenExplanation"
                      checked={autoGenExplanation}
                      onChange={(e) => setAutoGenExplanation(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-violet-500 focus:ring-violet-500 cursor-pointer"
                    />
                    <label htmlFor="autoGenExplanation" className="text-xs text-zinc-300 select-none cursor-pointer flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Auto-generate written explanation & practice snippet using Gemini AI
                    </label>
                  </div>

                  {!autoGenExplanation && (
                    <>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Video Link (YouTube / Vimeo / Embed URL)</label>
                        <input
                          type="text"
                          placeholder="e.g. https://www.youtube.com/watch?v=kqtD5dpn9C8 or https://vimeo.com/76979871"
                          value={newLessonVideo}
                          onChange={(e) => setNewLessonVideo(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                        />
                        <p className="text-[10px] text-zinc-500">Standard YouTube/Vimeo URLs will be converted to clean embeds automatically.</p>
                      </div>
                      <div className="space-y-2 md:col-span-2 border-t border-white/5 pt-4">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1.5">
                          Or: Upload Custom Video File (.mp4, .webm)
                          {uploadingVideo && <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />}
                        </label>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleVideoUpload}
                          disabled={uploadingVideo}
                          className="w-full px-4 py-2 bg-zinc-900 border border-white/5 text-xs text-zinc-400 focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-violet-500/10 file:text-violet-400 hover:file:bg-violet-500/25 file:cursor-pointer disabled:opacity-50"
                        />
                        {newLessonVideo && newLessonVideo.includes("/static/videos/") && (
                          <p className="text-[10px] text-emerald-400 font-bold mt-1">
                            ✓ Uploaded: {newLessonVideo.split("/").pop()}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Written Explanation (Markdown supported)</label>
                        <textarea
                          placeholder="Write GFG-style explanation content..."
                          value={newLessonContent}
                          onChange={(e) => setNewLessonContent(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all min-h-[120px] font-sans"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Code Snippet for Practice</label>
                        <textarea
                          placeholder="Provide sample code for practice..."
                          value={newLessonCode}
                          onChange={(e) => setNewLessonCode(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all min-h-[120px] font-mono text-violet-300"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Snippet Programming Language</label>
                        <input
                          type="text"
                          placeholder="e.g. go, python, typescript, rust"
                          value={newLessonLang}
                          onChange={(e) => setNewLessonLang(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                        />
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowLessonModal(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingLesson}
                      className="px-6 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 disabled:opacity-50 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {creatingLesson ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Lesson"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Create Exam Modal/Form */}
            {showExamModal && (
              <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950/80 space-y-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-400" /> Configure Course Exam
                </h4>
                <form onSubmit={handleCreateExam} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Exam Scope</label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                          type="radio"
                          name="examScope"
                          value="lesson"
                          checked={examScope === "lesson"}
                          onChange={() => setExamScope("lesson")}
                          className="w-4 h-4 accent-violet-500"
                        />
                        Lesson-Specific Exam
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                          type="radio"
                          name="examScope"
                          value="final"
                          checked={examScope === "final"}
                          onChange={() => setExamScope("final")}
                          className="w-4 h-4 accent-violet-500"
                        />
                        Final Comprehensive Exam
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase">Target Course</label>
                    <CustomSelect
                      value={examCourseId}
                      onChange={setExamCourseId}
                      placeholder="Select a Course"
                      options={courses.map(c => ({ label: c.title, value: String(c.id) }))}
                    />
                  </div>
                  {examScope === "lesson" ? (
                    <>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">Target Lesson</label>
                      <CustomSelect
                        value={examLessonId}
                        onChange={setExamLessonId}
                        placeholder={loadingLessons ? "Loading lessons..." : !examCourseId ? "Select a course first" : "Select a Lesson"}
                        disabled={loadingLessons || !examCourseId}
                        options={lessonsForCourse.map(l => ({ label: `Index ${l.order_index}: ${l.title}`, value: String(l.id) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase">Assignment Type</label>
                      <CustomSelect
                        value={assignmentType}
                        onChange={setAssignmentType}
                        placeholder="Select Assignment Type"
                        options={[
                          { label: "Code Completion", value: "code_completion" },
                          { label: "Bug Hunt", value: "bug_hunt" },
                          { label: "Refactoring", value: "refactoring" },
                          { label: "Test-Driven Development (TDD)", value: "tdd" },
                          { label: "GitHub Pull Request", value: "github_pr" },
                          { label: "API Integration", value: "api_integration" },
                          { label: "System Design", value: "system_design" }
                        ]}
                      />
                    </div>
                    {assignmentType === "github_pr" && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">GitHub Base Repository URL</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. https://github.com/HireMindOrg/assignment-repo"
                          value={githubRepoUrl}
                          onChange={(e) => setGithubRepoUrl(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                        />
                        <p className="text-[10px] text-zinc-500">Students will be asked to fork this repository, fix the broken code, and submit a PR link.</p>
                      </div>
                    )}
                    </>
                  ) : (
                    <div className="space-y-2 flex flex-col justify-end pb-1.5">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Target Syllabus</span>
                      <div className="px-4 py-2.5 rounded-xl border border-white/5 bg-zinc-900/50 text-xs text-zinc-400 font-semibold">
                        Comprehensive (Applies to whole course)
                      </div>
                    </div>
                  )}
                  {!(assignmentType === "github_pr" || assignmentType === "system_design") && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Exam Mode</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                          <input
                            type="radio"
                            name="examType"
                            value="ai_generated"
                            checked={examType === "ai_generated"}
                            onChange={() => setExamType("ai_generated")}
                            className="w-4 h-4 accent-violet-500"
                          />
                          AI Generated (via Gemini AI)
                        </label>
                        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                          <input
                            type="radio"
                            name="examType"
                            value="custom"
                            checked={examType === "custom"}
                            onChange={() => setExamType("custom")}
                            className="w-4 h-4 accent-violet-500"
                          />
                          Custom Coding Challenge
                        </label>
                      </div>
                    </div>
                  )}

                  {examType === "ai_generated" ? (
                    <>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Target Topics (comma-separated)</label>
                        <input
                          type="text"
                          placeholder="e.g. lists, list comprehension, slicing, O(n) space complexity"
                          value={examTopics}
                          onChange={(e) => setExamTopics(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                        />
                        <p className="text-[10px] text-zinc-500">Topics that the AI model will focus on while designing the exam challenge.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Difficulty (LeetCode Style)</label>
                        <CustomSelect
                          value={examDifficulty}
                          onChange={setExamDifficulty}
                          placeholder="Select Difficulty"
                          options={[
                            { label: "Beginner (Easy)", value: "Beginner" },
                            { label: "Intermediate (Medium)", value: "Intermediate" },
                            { label: "Expert (Hard)", value: "Expert" }
                          ]}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Number of Questions</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={examNumQuestions}
                          onChange={(e) => setExamNumQuestions(Number(e.target.value))}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Challenge Title</label>
                        <input
                          type="text"
                          required={examType === "custom"}
                          placeholder="e.g. Find First Missing Positive"
                          value={examTitle}
                          onChange={(e) => setExamTitle(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Difficulty</label>
                        <CustomSelect
                          value={examDifficulty}
                          onChange={setExamDifficulty}
                          placeholder="Select Difficulty"
                          options={[
                            { label: "Beginner", value: "Beginner" },
                            { label: "Intermediate", value: "Intermediate" },
                            { label: "Expert", value: "Expert" }
                          ]}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Programming Language</label>
                        <CustomSelect
                          value={examLanguage}
                          onChange={setExamLanguage}
                          placeholder="Select Language"
                          options={[
                            { label: "Python", value: "python" },
                            { label: "JavaScript / Node", value: "javascript" },
                            { label: "TypeScript", value: "typescript" },
                            { label: "Go (Golang)", value: "go" },
                            { label: "Java", value: "java" },
                            { label: "C++", value: "cpp" }
                          ]}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase">Instructions / Description</label>
                        <textarea
                          required={examType === "custom"}
                          placeholder="Provide the problem description, constraints, and examples..."
                          value={examDesc}
                          onChange={(e) => setExamDesc(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all min-h-[100px]"
                        />
                      </div>
                      {!(assignmentType === "github_pr" || assignmentType === "system_design") && (
                        <>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] text-zinc-400 font-bold uppercase">Boilerplate Code</label>
                            <textarea
                              required={examType === "custom"}
                              placeholder="e.g. def find_missing(nums):"
                              value={examBoilerplate}
                              onChange={(e) => setExamBoilerplate(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-violet-300 focus:outline-none focus:border-violet-500 transition-all min-h-[100px] font-mono"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] text-zinc-400 font-bold uppercase">Optimal Solution Explanation</label>
                            <textarea
                              placeholder="Explain how to solve the problem optimally..."
                              value={examOptimalExplanation}
                              onChange={(e) => setExamOptimalExplanation(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-white focus:outline-none focus:border-violet-500 transition-all min-h-[80px]"
                            />
                          </div>
                        </>
                      )}
                      {!(assignmentType === "github_pr" || assignmentType === "system_design") && (
<div className="space-y-4 md:col-span-2 border-t border-white/5 pt-4">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-zinc-400 font-bold uppercase">Test Cases</label>
                          <button
                            type="button"
                            onClick={addTestCase}
                            className="px-3 py-1 rounded-lg bg-zinc-900 border border-white/5 text-xs text-violet-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
                          >
                            + Add Case
                          </button>
                        </div>
                        {examTestCases.map((tc, index) => (
                          <div key={index} className="flex gap-4 items-center bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                            <div className="flex-1 space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Input</label>
                              <input
                                type="text"
                                required={examType === "custom"}
                                placeholder='e.g. [3, 4, -1, 1] or "hello"'
                                value={tc.input}
                                onChange={(e) => updateTestCase(index, "input", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500"
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <label className="text-[8px] text-zinc-500 font-bold uppercase">Expected Output</label>
                              <input
                                type="text"
                                required={examType === "custom"}
                                placeholder='e.g. 2 or "olleh"'
                                value={tc.expected}
                                onChange={(e) => updateTestCase(index, "expected", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/5 text-xs text-white focus:outline-none focus:border-violet-500"
                              />
                            </div>
                            {examTestCases.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTestCase(index)}
                                className="mt-4 p-2 text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
)}                    </>
                  )}

                  <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExamModal(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingExam}
                      className="px-6 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 disabled:opacity-50 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {creatingExam ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Configure Exam"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Enrolled Programs Grid */}
        {user && courses.filter(c => getEnrollmentForCourse(c.id)).length > 0 && (
          <div className="space-y-6 mb-12">
            <div>
              <h3 className="text-2xl font-black text-white">Enrolled Programs</h3>
              <p className="text-zinc-500 text-sm">Continue learning and achieve your certification.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.filter(c => getEnrollmentForCourse(c.id)).map((course) => {
                const enrollment = getEnrollmentForCourse(course.id);
                const isEnrolled = !!enrollment;
                const isCompleted = enrollment?.status === "completed";

                return (
                  <motion.div
                    key={course.id}
                    whileHover={{ y: -5 }}
                    className="flex flex-col rounded-3xl border border-white/5 hover:border-white/15 bg-zinc-900/40 p-6 justify-between gap-6 transition-colors group relative overflow-hidden"
                  >
                    {isCompleted && (
                      <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                        <div className="bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-400 text-[9px] font-extrabold uppercase py-1.5 text-center rotate-45 translate-x-7 translate-y-2 w-28">
                          Completed
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Header tags */}
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getDifficultyColor(course.difficulty)}`}>
                          {course.difficulty}
                        </span>
                        <span className="text-zinc-600 text-xs flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> {course.modules_count || 0} Modules
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xl font-bold text-white group-hover:text-violet-400 transition-colors leading-tight">
                          {course.title}
                        </h4>
                        <p className="text-zinc-400 text-xs leading-relaxed min-h-[48px]">
                          {course.description}
                        </p>
                      </div>

                      {/* Tag list */}
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {course.tags && Array.isArray(course.tags) ? (
                          course.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 rounded-md bg-zinc-950 text-zinc-500 text-[10px] font-semibold">
                              #{tag}
                            </span>
                          ))
                        ) : null}
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-4 flex items-center justify-end gap-4">
                      {/* Curator info removed */}

                      {isCompleted ? (
                        <Link href={`/learning/${course.id}`}>
                          <button className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer">
                            Syllabus <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      ) : isEnrolled ? (
                        <Link href={`/learning/${course.id}`}>
                          <button className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer">
                            Continue <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleEnroll(course.id)}
                          disabled={enrollingId !== null}
                          className="px-4 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          {enrollingId === course.id ? "Enrolling..." : "Enroll Now"}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Course Catalog Grid */}
        {courses.filter(c => !getEnrollmentForCourse(c.id)).length > 0 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-black text-white">Available Programs</h3>
              <p className="text-zinc-500 text-sm">Select a course to start learning and unlock your verified skill badge.</p>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.filter(c => !getEnrollmentForCourse(c.id)).map((course) => {
              const enrollment = getEnrollmentForCourse(course.id);
              const isEnrolled = !!enrollment;
              const isCompleted = enrollment?.status === "completed";

              return (
                <motion.div
                  key={course.id}
                  whileHover={{ y: -5 }}
                  className="flex flex-col rounded-3xl border border-white/5 hover:border-white/15 bg-zinc-900/40 p-6 justify-between gap-6 transition-colors group relative overflow-hidden"
                >
                  {isCompleted && (
                    <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                      <div className="bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-400 text-[9px] font-extrabold uppercase py-1.5 text-center rotate-45 translate-x-7 translate-y-2 w-28">
                        Completed
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Header tags */}
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getDifficultyColor(course.difficulty)}`}>
                        {course.difficulty}
                      </span>
                      <span className="text-zinc-600 text-xs flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {course.modules_count || 0} Modules
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xl font-bold text-white group-hover:text-violet-400 transition-colors leading-tight">
                        {course.title}
                      </h4>
                      <p className="text-zinc-400 text-xs leading-relaxed min-h-[48px]">
                        {course.description}
                      </p>
                    </div>

                    {/* Tag list */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {course.tags && Array.isArray(course.tags) ? (
                        course.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-zinc-950 text-zinc-500 text-[10px] font-semibold">
                            #{tag}
                          </span>
                        ))
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 flex items-center justify-end gap-4">
                    {/* Curator info removed */}

                    {isCompleted ? (
                      <Link href={`/learning/${course.id}`}>
                        <button className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer">
                          Syllabus <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                    ) : isEnrolled ? (
                      <Link href={`/learning/${course.id}`}>
                        <button className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer">
                          Continue <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        disabled={enrollingId !== null}
                        className="px-4 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        {enrollingId === course.id ? "Enrolling..." : "Enroll Now"}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
