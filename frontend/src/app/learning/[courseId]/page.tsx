"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

import { BookOpen, ArrowLeft, Award, CheckCircle, ChevronRight, PlayCircle, BookOpenCheck, ShieldAlert, Sparkles, User, LogOut, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "../../config";

interface Lesson {
  id: number;
  title: string;
  content: string;
  video_url?: string;
  practice_code?: string;
  language?: string;
  order_index: number;
}

interface CourseDetails {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  tags: string[];
  mentor_name: string;
  created_at: string;
  lessons: Lesson[];
}

const renderMarkdown = (text: string) => {
  if (!text) return null;
  const lines = text.split("\n");
  let inList = false;
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];

  const flushList = (key: string | number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="list-disc pl-6 space-y-2 my-3 text-zinc-300">
          {listItems}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  const parseInline = (lineText: string) => {
    const tokenRegex = /(\*\*.*?\*\*|`.*?`)/g;
    const tokens = lineText.split(tokenRegex);

    return tokens.map((token, idx) => {
      if (token.startsWith("**") && token.endsWith("**")) {
        return <strong key={idx} className="font-extrabold text-white">{token.slice(2, -2)}</strong>;
      } else if (token.startsWith("`") && token.endsWith("`")) {
        return <code key={idx} className="px-1.5 py-0.5 mx-0.5 rounded bg-zinc-950 border border-white/5 font-mono text-xs text-violet-300">{token.slice(1, -1)}</code>;
      }
      return token;
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("###")) {
      flushList(index);
      elements.push(
        <h4 key={index} className="text-lg font-bold text-white mt-6 mb-3 flex items-center gap-1.5 border-b border-white/5 pb-1">
          {parseInline(trimmed.replace(/^###\s*/, ""))}
        </h4>
      );
    } else if (trimmed.startsWith("##")) {
      flushList(index);
      elements.push(
        <h3 key={index} className="text-xl font-black text-white mt-8 mb-4 border-l-2 border-violet-500 pl-3">
          {parseInline(trimmed.replace(/^##\s*/, ""))}
        </h3>
      );
    } else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
      inList = true;
      const cleanItem = trimmed.replace(/^[-*]\s*/, "");
      listItems.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {parseInline(cleanItem)}
        </li>
      );
    } else if (trimmed === "") {
      flushList(index);
    } else {
      flushList(index);
      elements.push(
        <p key={index} className="text-zinc-300 leading-relaxed my-3">
          {parseInline(trimmed)}
        </p>
      );
    }
  });

  flushList("final");

  return <div className="space-y-2">{elements}</div>;
};

const getEmbedUrl = (url: string) => {
  if (!url) return "";
  
  // YouTube URLs
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    let videoId = "";
    if (url.includes("youtube.com/embed/")) {
      return url;
    }
    if (url.includes("youtube.com/watch")) {
      try {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get("v") || "";
      } catch (e) {
        const parts = url.split("v=");
        videoId = parts[1]?.split("&")[0] || "";
      }
    } else if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0] || "";
    }
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }

  // Vimeo URLs
  if (url.includes("vimeo.com")) {
    if (url.includes("player.vimeo.com/video/")) {
      return url;
    }
    const parts = url.split("vimeo.com/");
    const videoId = parts[1]?.split("?")[0] || "";
    if (videoId) {
      return `https://player.vimeo.com/video/${videoId}`;
    }
  }

  return url;
};

export default function CourseDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId;

  const [user, setUser] = useState<any>(null);
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [enrollment, setEnrollment] = useState<any | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseExams, setCourseExams] = useState<any[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [finalExam, setFinalExam] = useState<any | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

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

    // Reset states to prevent state/layout leakage when switching courses
    setCourse(null);
    setEnrollment(null);
    setSelectedLesson(null);
    setCourseExams([]);
    setUserSubmissions([]);
    setFinalExam(null);
    setLoading(true);

    Promise.all([
      fetch(`${API_BASE_URL}/api/learning/courses/${courseId}?user_id=${loggedUser.id}`).then((r) => {
        if (r.status === 403) {
          setUnauthorized(true);
          throw new Error("unassigned");
        }
        if (!r.ok) throw new Error("failed");
        return r.json();
      }),
      fetch(`${API_BASE_URL}/api/learning/enrollments/${loggedUser.id}`).then((r) => r.json()),
      fetch(`${API_BASE_URL}/api/learning/courses/${courseId}/exams?user_id=${loggedUser.id}`).then((r) => r.status === 404 ? [] : r.json()),
      fetch(`${API_BASE_URL}/api/learning/submissions/${loggedUser.id}`).then((r) => r.status === 404 ? [] : r.json()),
      fetch(`${API_BASE_URL}/api/learning/courses/${courseId}/final-exam?user_id=${loggedUser.id}`).then((r) => r.status === 404 ? null : r.json()),

    ])
      .then(([courseData, enrollList, examList, subList, finalExamData]) => {
        setCourse(courseData);
        if (courseData.lessons && courseData.lessons.length > 0) {
          setSelectedLesson(courseData.lessons[0]);
        }
        
        // Find enrollment for this course
        const activeEnroll = enrollList.find((e: any) => Number(e.course_id) === Number(courseId));
        if (!activeEnroll && loggedUser.role !== "admin" && loggedUser.role !== "mentor") {
          // Redirect if not enrolled
          router.push("/learning");
          return;
        }
        setEnrollment(activeEnroll || null);
        setCourseExams(Array.isArray(examList) ? examList : []);
        setUserSubmissions(Array.isArray(subList) ? subList : []);
        setFinalExam(finalExamData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId, router]);

  const handleLogout = () => {
    localStorage.removeItem("hiremind_user");
    localStorage.removeItem("hiremind_admin");
    setUser(null);
    router.push("/");
  };

  const getHeaderQuizButton = () => {
    if (!course) return null;
    if (user && user.role === "admin") return null;
    if (user && user.role === "mentor") {
      return (
        <button
          onClick={() => router.push(`/learning/${courseId}/review`)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:opacity-90 transition-all cursor-pointer shrink-0"
        >
          <Award className="w-4 h-4 text-white" /> Review Tests
        </button>
      );
    }

    if (isCompleted || (finalSubmission && finalSubmission.is_passed)) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0">
          <CheckCircle className="w-4 h-4" /> Passed
        </div>
      );
    }

    if (finalSubmission) {
      if (finalSubmission.mentor_score === null) {
        return (
          <button
            disabled
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-850 border border-white/5 text-zinc-500 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 cursor-not-allowed"
          >
            <Loader2 className="w-4 h-4 text-amber-500 animate-spin" /> Pending Mentor Review
          </button>
        );
      }
      if (!finalSubmission.is_passed) {
        return (
          <button
            onClick={() => router.push(`/learning/${course?.id}/quiz?isFinal=true`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:opacity-90 transition-all cursor-pointer shrink-0"
          >
            <Sparkles className="w-4 h-4" /> Retake Final Exam
          </button>
        );
      }
    }

    if (allSyllabusPassed && finalExam) {
      if (!finalSubmission) {
        return (
          <button
            onClick={() => router.push(`/learning/${course?.id}/quiz?isFinal=true`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:opacity-90 transition-all cursor-pointer shrink-0 animate-pulse"
          >
            <Sparkles className="w-4 h-4" /> Start Final Exam
          </button>
        );
      }
    }

    const hasLessonExams = courseExams.length > 0;
    if (hasLessonExams) {
      const firstIncompleteLesson = course?.lessons?.find((l) => {
        const exam = courseExams.find((e) => Number(e.lesson_id) === Number(l.id));
        const sub = userSubmissions.find((s) => Number(s.lesson_id) === Number(l.id));
        return exam && (!sub || !sub.is_passed);
      });

      if (firstIncompleteLesson) {
        return (
          <button
            onClick={() => router.push(`/learning/${course?.id}/quiz?lessonId=${firstIncompleteLesson.id}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:opacity-90 transition-all cursor-pointer shrink-0"
          >
            <Sparkles className="w-4 h-4" /> Start Lesson {firstIncompleteLesson.order_index} Quiz
          </button>
        );
      }
    }

    if (isSubmitted) {
      return (
        <button
          disabled
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-850 border border-white/5 text-zinc-500 text-xl font-bold uppercase tracking-wider shrink-0 cursor-not-allowed"
        >
          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" /> Pending Mentor Review
        </button>
      );
    }

    return (
      <button
        onClick={() => router.push(`/learning/${course?.id}/quiz`)}
        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:opacity-90 transition-all cursor-pointer shrink-0"
      >
        <Sparkles className="w-4 h-4" /> Start Coding Test
      </button>
    );
  };

  const getSidebarQuizButton = () => {
    if (!course) return null;
    if (user && user.role === "admin") return null;
    if (user && (user.role === "mentor" || user.role === "admin")) {
      return (
        <button
          onClick={() => router.push(`/learning/${courseId}/review`)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
        >
          Review Tests <ChevronRight className="w-4 h-4" />
        </button>
      );
    }

    if (isCompleted || (finalSubmission && finalSubmission.is_passed)) {
      return (
        <div className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5">
          <CheckCircle className="w-4 h-4" /> Passed & Certified
        </div>
      );
    }

    if (finalSubmission) {
      if (finalSubmission.mentor_score === null) {
        return (
          <button
            disabled
            className="w-full py-3 rounded-xl bg-zinc-800 border border-white/5 text-zinc-500 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 cursor-not-allowed"
          >
            Pending Grading <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
          </button>
        );
      }
      if (!finalSubmission.is_passed) {
        return (
          <button
            onClick={() => router.push(`/learning/${course?.id}/quiz?isFinal=true`)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            Retake Final Exam <ChevronRight className="w-4 h-4" />
          </button>
        );
      }
    }

    if (allSyllabusPassed && finalExam) {
      if (!finalSubmission) {
        return (
          <button
            onClick={() => router.push(`/learning/${course?.id}/quiz?isFinal=true`)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer shadow-lg shadow-violet-500/25 animate-pulse"
          >
            Start Final Exam <Sparkles className="w-4 h-4" />
          </button>
        );
      }
    }

    const hasLessonExams = courseExams.length > 0;
    if (hasLessonExams) {
      const firstIncompleteLesson = course?.lessons?.find((l) => {
        const exam = courseExams.find((e) => Number(e.lesson_id) === Number(l.id));
        const sub = userSubmissions.find((s) => Number(s.lesson_id) === Number(l.id));
        return exam && (!sub || !sub.is_passed);
      });

      if (firstIncompleteLesson) {
        return (
          <button
            onClick={() => router.push(`/learning/${course?.id}/quiz?lessonId=${firstIncompleteLesson.id}`)}
            className="w-full py-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            Start Lesson {firstIncompleteLesson.order_index} Quiz <ChevronRight className="w-4 h-4" />
          </button>
        );
      }
    }

    if (isSubmitted) {
      return (
        <button
          disabled
          className="w-full py-3 rounded-xl bg-zinc-800 border border-white/5 text-zinc-500 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 cursor-not-allowed"
        >
          Pending Grading <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
        </button>
      );
    }

    return (
      <button
        onClick={() => router.push(`/learning/${course?.id}/quiz`)}
        className="w-full py-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
      >
        Start Coding Test <ChevronRight className="w-4 h-4" />
      </button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Opening curriculum...</p>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500 animate-pulse" />
        <h2 className="text-2xl font-black uppercase tracking-wider text-white">Access Denied</h2>
        <p className="text-sm text-zinc-400 max-w-md">You are not assigned to this course.</p>
        <Link href="/learning" className="mt-4 px-6 py-2.5 bg-zinc-900 border border-white/5 text-zinc-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
          Back to Learning Hub
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold">Course Not Found</h2>
        <Link href="/learning" className="text-violet-400 hover:underline">Back to Learning Hub</Link>
      </div>
    );
  }

  const isCompleted = enrollment?.status === "completed";
  const isSubmitted = enrollment?.status === "submitted";

  const configuredLessonExamIds = courseExams.map((e) => Number(e.lesson_id));
  const passedLessonExamIds = userSubmissions
    .filter((s) => Number(s.course_id) === Number(courseId) && s.lesson_id !== null && s.lesson_id !== undefined && s.is_passed)
    .map((s) => Number(s.lesson_id));
  
  const allSyllabusPassed = configuredLessonExamIds.length === 0 || 
    configuredLessonExamIds.every(id => passedLessonExamIds.includes(id));
    
  const finalSubmission = userSubmissions.find(
    (s) => Number(s.course_id) === Number(courseId) && (s.lesson_id === null || s.lesson_id === undefined) && s.is_final
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-x-hidden pb-10">
      {/* Background Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] bg-violet-950/10 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/learning")}
            className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Course Syllabus</span>
            <span className="text-sm font-extrabold text-white truncate max-w-[200px] sm:max-w-xs">{course.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getHeaderQuizButton()}
          
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

      {/* Curriculum Layout */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar Modules List */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/20 space-y-4">
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Syllabus Index</span>
                <h3 className="text-lg font-black text-white mt-1">Course Curriculum</h3>
              </div>
              
              <div className="space-y-2">
                {course.lessons.map((lesson) => {
                  const isCurrent = selectedLesson?.id === lesson.id;
                  const lessonExam = courseExams.find((exam) => Number(exam.lesson_id) === Number(lesson.id));
                  const lessonSubmission = userSubmissions.find((sub) => Number(sub.lesson_id) === Number(lesson.id));
                  const hasPassed = lessonSubmission?.is_passed;
                  const isPending = lessonSubmission && lessonSubmission.mentor_score === null;

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLesson(lesson)}
                      className={`w-full p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-violet-600/15 border-violet-500/30 text-white"
                          : "bg-zinc-900/40 border-transparent hover:border-white/5 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isCurrent ? "bg-violet-500 text-white" : "bg-zinc-950 text-zinc-600"
                      }`}>
                        {lesson.order_index}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold block truncate">{lesson.title}</span>
                          {lessonExam && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-violet-400" title="Exam configured" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-zinc-500">Lesson Module</span>
                          {lessonExam && (
                            <>
                              <span className="text-[10px] text-zinc-600">•</span>
                              {isPending ? (
                                <span className="text-[9px] text-amber-400 font-bold uppercase animate-pulse">⏳ Awaiting Review</span>
                              ) : hasPassed ? (
                                <span className="text-[9px] text-emerald-400 font-bold uppercase">Passed</span>
                              ) : lessonSubmission ? (
                                <span className="text-[9px] text-red-400 font-bold uppercase">Failed</span>
                              ) : (
                                <span className="text-[9px] text-violet-400 font-bold uppercase">Exam Req</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Final Comprehensive Exam / Certification card */}
            {finalExam && user?.role !== "admin" && (
              <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/60 to-zinc-950/80 space-y-4 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[60px] bg-fuchsia-500/10 pointer-events-none" />
                
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <Award className="w-4.5 h-4.5 text-fuchsia-400" /> Final Certification
                  </h4>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    {user && (user.role === "mentor" || user.role === "admin")
                      ? "Mentor Portal: Review candidate final exam submissions, proctoring metrics, and override grades to issue credentials."
                      : "Complete all syllabus lesson exams to unlock the Final Comprehensive Exam. Score 80% or higher to receive your verified unique certificate PDF."}
                  </p>
                </div>

                {/* Mentors / Admins Mode */}
                {user && (user.role === "mentor" || user.role === "admin") ? (
                  <div className="space-y-3 pt-2">
                    <div className="py-2 px-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-bold text-center">
                      Mentor Access Active
                    </div>
                    <button
                      onClick={() => router.push(`/learning/${courseId}/review`)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-95 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer shadow-lg shadow-violet-500/10"
                    >
                      Review Submissions <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Candidates Mode */
                  <div className="space-y-3 pt-2">
                    {isCompleted || (finalSubmission && finalSubmission.is_passed) ? (
                      /* 1. Passed & Completed */
                      <div className="space-y-3">
                        <div className="py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold text-center">
                          ✓ Passed with {finalSubmission?.mentor_score || 100}%
                        </div>
                        {finalSubmission?.feedback && (
                          <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/5 text-[10px] text-zinc-400 leading-normal">
                            <span className="font-bold text-zinc-300 block mb-1 uppercase tracking-wider text-[8px]">Mentor Feedback</span>
                            <span className="whitespace-pre-line font-mono">{finalSubmission.feedback}</span>
                          </div>
                        )}
                        {enrollment?.certificate_id ? (
                          <a
                            href={`${API_BASE_URL}/api/learning/certificates/${enrollment.certificate_id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center shadow-lg shadow-white/5"
                          >
                            <Award className="w-4 h-4 text-zinc-950" /> Download PDF
                          </a>
                        ) : (
                          <div className="text-[10px] text-zinc-500 text-center">
                            Generating Certificate ID...
                          </div>
                        )}
                      </div>
                    ) : finalSubmission && finalSubmission.mentor_score === null ? (
                      /* 2. Submitted, Pending Review */
                      <div className="space-y-2">
                        <div className="py-2.5 px-3 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pending Mentor Review
                        </div>
                        <p className="text-[10px] text-zinc-500 text-center">
                          Your final exam is currently being graded by your mentor.
                        </p>
                      </div>
                    ) : finalSubmission && !finalSubmission.is_passed ? (
                      /* 3. Failed & Retry */
                      <div className="space-y-2">
                        <div className="py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold text-center">
                          Failed (Score: {finalSubmission.mentor_score}%)
                        </div>
                        {finalSubmission?.feedback && (
                          <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/5 text-[10px] text-zinc-400 leading-normal">
                            <span className="font-bold text-zinc-300 block mb-1 uppercase tracking-wider text-[8px]">Mentor Feedback</span>
                            <span className="whitespace-pre-line font-mono">{finalSubmission.feedback}</span>
                          </div>
                        )}
                        <button
                          onClick={() => router.push(`/learning/${course.id}/quiz?isFinal=true`)}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-95 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer shadow-lg"
                        >
                          Retake Final Exam
                        </button>
                      </div>
                    ) : !allSyllabusPassed ? (
                      /* 4. Locked State */
                      <div className="space-y-2">
                        <div className="py-2.5 px-3 rounded-xl bg-zinc-950/80 border border-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" /> Final Exam Locked
                        </div>
                        <p className="text-[10px] text-zinc-500 text-center">
                          Pass all syllabus lesson exams to unlock certification.
                        </p>
                      </div>
                    ) : !finalExam ? (
                      /* 5. Unconfigured State */
                      <div className="py-2.5 px-3 rounded-xl bg-zinc-950/80 border border-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 text-center">
                        Final Exam Pending Configuration
                      </div>
                    ) : (
                      /* 6. Unlocked & Ready to Take */
                      <div className="space-y-2">
                        <div className="py-1 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider text-center">
                          ✓ All Syllabus Exams Passed
                        </div>
                        <button
                          onClick={() => router.push(`/learning/${course.id}/quiz?isFinal=true`)}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-95 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer shadow-lg shadow-violet-500/25"
                        >
                          Start Final Exam <Sparkles className="w-4 h-4 animate-pulse" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

          {/* Active Lesson Reader Content */}
          <div className="lg:col-span-8">
            <div className="p-6 md:p-10 rounded-3xl border border-white/10 bg-zinc-900/20 min-h-[500px] flex flex-col justify-between gap-8">
              {selectedLesson ? (
                <div className="space-y-6">
                  {/* Lesson header */}
                  <div className="border-b border-white/5 pb-6 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      <PlayCircle className="w-4 h-4 text-violet-400" /> Module {selectedLesson.order_index} of {course.lessons.length}
                    </div>
                    <h2 className="text-3xl font-black text-white leading-tight">
                      {selectedLesson.title}
                    </h2>
                  </div>

                  {/* Video Explanation */}
                  {selectedLesson.video_url && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        <PlayCircle className="w-4 h-4 text-violet-400" /> Video Explanation
                      </div>
                      <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl shadow-violet-950/20 relative">
                        {(() => {
                          const embedUrl = getEmbedUrl(selectedLesson.video_url);
                          const isEmbed = embedUrl.includes("youtube.com/embed/") || 
                                          embedUrl.includes("player.vimeo.com/video/") || 
                                          embedUrl.includes("embed");
                          return isEmbed ? (
                            <iframe
                              src={embedUrl}
                              title={selectedLesson.title}
                              className="w-full h-full border-0 absolute inset-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          ) : (
                            <video
                              src={selectedLesson.video_url}
                              controls
                              className="w-full h-full object-cover absolute inset-0"
                            />
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Written Explanation */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      <BookOpen className="w-4 h-4 text-violet-400" /> Written Explanation
                    </div>
                    <div className="prose prose-invert max-w-none text-zinc-300 text-base leading-relaxed space-y-4">
                      <div>{renderMarkdown(selectedLesson.content)}</div>
                      
                      {selectedLesson.practice_code && (
                        <div className="mt-8 space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-2">
                            <span>Code Snippet: {selectedLesson.title}</span>
                            <span className="px-2 py-0.5 bg-zinc-900 border border-white/5 rounded text-violet-400 font-mono">
                              {selectedLesson.language || "python"}
                            </span>
                          </div>
                          <pre className="p-5 rounded-2xl bg-zinc-950/90 border border-white/5 font-mono text-xs text-violet-300 overflow-x-auto leading-relaxed shadow-inner">
                            <code>{selectedLesson.practice_code}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lesson Exam Section */}
                  {(() => {
                    const lessonExam = courseExams.find((exam) => exam.lesson_id === selectedLesson.id);
                    if (!lessonExam) return null;

                    const lessonSubmission = userSubmissions.find((sub) => sub.lesson_id === selectedLesson.id);
                    const hasPassed = lessonSubmission?.is_passed;
                    const isPending = lessonSubmission && lessonSubmission.mentor_score === null;

                    return (
                      <div className="mt-8 p-6 rounded-2xl border border-white/10 bg-zinc-900/40 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="space-y-1">
                            <h4 className="text-base font-bold text-white flex items-center gap-2">
                              Exam
                            </h4>
                            <p className="text-xs text-zinc-400">
                              This lesson module requires a proctored coding exam verification to proceed.
                            </p>
                          </div>

                          <div className="shrink-0">
                            {user && (user.role === "mentor" || user.role === "admin") ? (
                              <div className="px-4 py-2 rounded-xl bg-zinc-800 border border-white/5 text-zinc-400 text-xs font-bold uppercase">
                                Mentor Mode
                              </div>
                            ) : hasPassed ? (
                              <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase flex items-center gap-1.5">
                                <CheckCircle className="w-4 h-4" /> Passed & Verified
                              </div>
                            ) : isPending ? (
                              <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase flex items-center gap-1.5 animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" /> Pending Mentor Review
                              </div>
                            ) : (
                              <button
                                onClick={() => router.push(`/learning/${course.id}/quiz?lessonId=${selectedLesson.id}`)}
                                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-violet-500/25 cursor-pointer"
                              >
                                Start Lesson Quiz
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 text-zinc-500 m-auto">
                  <BookOpenCheck className="w-12 h-12" />
                  <p className="text-sm">Select a lesson from the curriculum to start reading.</p>
                </div>
              )}

              {/* Lesson bottom pagination helper */}
              <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-8">
                <span className="text-xs text-zinc-500">Curated by verified expert curator @{course.mentor_name}</span>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
