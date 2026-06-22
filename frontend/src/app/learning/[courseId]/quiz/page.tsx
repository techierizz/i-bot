"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BrainCircuit, ChevronRight, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, Award, Code, Trophy, Lightbulb,
  Play, ShieldAlert, Video, Eye, Shield, Terminal,
  Sparkles, MessageSquare, Send, Loader2, Gauge, Bot
} from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "../../../config";
import Editor from "@monaco-editor/react";

interface TestTarget {
  input: string;
  expected: string;
}

interface SingleQuestion {
  title: string;
  description: string;
  boilerplate_code: string;
  test_cases: TestTarget[];
}

interface CodingChallenge {
  title: string;
  description: string;
  difficulty: string;
  language: string;
  boilerplate_code: string;
  test_cases: any[];
  optimal_solution_explanation: string;
  // Multi-question exams
  is_multi?: boolean;
  questions?: SingleQuestion[];
}

export default function CourseQuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Entering Quiz Workspace...</p>
        </div>
      </div>
    }>
      <CourseQuizPageContent />
    </Suspense>
  );
}

function CourseQuizPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId");
  const isFinal = searchParams.get("isFinal") === "true";
  const courseId = params.courseId;

  const [user, setUser] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [quiz, setQuiz] = useState<CodingChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Multi-question navigation
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [studentCodes, setStudentCodes] = useState<string[]>([]);

  // Challenge workspace states
  const [studentCode, setStudentCode] = useState("");
  const [quizFinished, setQuizFinished] = useState(false);
  const quizFinishedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [submitResult, setSubmitResult] = useState<any | null>(null);

  // Chatbot states
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [hintQuery, setHintQuery] = useState("");
  const [submittingHint, setSubmittingHint] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef<boolean>(false);

  // Scroll to bottom of chat when a message is added or chat is opened
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, chatbotOpen]);

  // Anti-cheat states
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [lookAwayTimer, setLookAwayTimer] = useState(0);
  const [activeWarningModal, setActiveWarningModal] = useState<{
    title: string;
    message: string;
    warningIndex: number;
    penaltyText: string;
  } | null>(null);

  // Webcam & Gaze scripts states
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [scriptsError, setScriptsError] = useState(false);
  const [gazeStatus, setGazeStatus] = useState<"Focused" | "Looking Away" | "Face Not Detected">("Focused");

  const [modelLoading, setModelLoading] = useState(false);
  const cocoModelRef = useRef<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<any>(null);
  const faceMeshRef = useRef<any>(null);

  const [testStarted, setTestStarted] = useState(false);
  // fullscreen permission gate: idle → requesting → granted | denied
  const [fsState, setFsState] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [camState, setCamState] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  const [examClosed, setExamClosed] = useState(false);

  const [examClosedMessage, setExamClosedMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (quiz && quiz.language) {
      setSelectedLanguage(quiz.language.toLowerCase());
    }
  }, [quiz]);


  // IDE Execution States
  const [executionOutput, setExecutionOutput] = useState<{stdout: string, stderr: string} | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const maxRuns = 2;
  const [selectedLanguage, setSelectedLanguage] = useState("python");


  // Load candidate details & course
  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) {
      router.push("/login?redirect=/learning");
      return;
    }
    const loggedUser = JSON.parse(session);
    setUser(loggedUser);

    if (loggedUser.role === "mentor" || loggedUser.role === "admin") {
      alert("Mentors and administrators are not permitted to participate in candidate coding tests. Redirecting to evaluation dashboard.");
      router.push("/admin/dashboard");
      return;
    }

    fetch(`${API_BASE_URL}/api/learning/courses/${courseId}`)
      .then((r) => r.json())
      .then(async (courseData) => {
        setCourse(courseData);

        // Fetch exam status on load to verify access
        try {
          let url = "";
          if (isFinal) {
            url = `${API_BASE_URL}/api/learning/courses/${courseId}/final-exam?user_id=${loggedUser.id}`;
          } else if (lessonId) {
            url = `${API_BASE_URL}/api/learning/courses/${courseId}/lessons/${lessonId}/exam?user_id=${loggedUser.id}`;
          }

          if (url) {
            const res = await fetch(url);
            if (res.ok) {
              const examDetails = await res.json();
              if ((examDetails.status === "ended" || examDetails.status === "archived") && !examDetails.has_active_session) {
                setExamClosed(true);
                setExamClosedMessage("This exam has been closed by your mentor. You cannot start a new attempt.");
              }
            }
          }
        } catch (err) {
          console.error("Error checking exam status:", err);
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setQuizError("Failed to load course details.");
        setLoading(false);
      });
  }, [courseId, router, isFinal, lessonId]);

  // Load MediaPipe, TensorFlow & COCO-SSD scripts dynamically
  useEffect(() => {
    let cameraScript: HTMLScriptElement | null = null;
    let faceMeshScript: HTMLScriptElement | null = null;
    let tfScript: HTMLScriptElement | null = null;
    let cocoScript: HTMLScriptElement | null = null;

    const loadScripts = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          cameraScript = document.createElement("script");
          cameraScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
          cameraScript.crossOrigin = "anonymous";
          cameraScript.async = true;
          cameraScript.onload = () => resolve();
          cameraScript.onerror = () => reject(new Error("Failed to load Camera Utils"));
          document.body.appendChild(cameraScript);
        });

        await new Promise<void>((resolve, reject) => {
          faceMeshScript = document.createElement("script");
          faceMeshScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
          faceMeshScript.crossOrigin = "anonymous";
          faceMeshScript.async = true;
          faceMeshScript.onload = () => resolve();
          faceMeshScript.onerror = () => reject(new Error("Failed to load Face Mesh"));
          document.body.appendChild(faceMeshScript);
        });

        await new Promise<void>((resolve, reject) => {
          tfScript = document.createElement("script");
          tfScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs";
          tfScript.crossOrigin = "anonymous";
          tfScript.async = true;
          tfScript.onload = () => resolve();
          tfScript.onerror = () => reject(new Error("Failed to load TensorFlow.js"));
          document.body.appendChild(tfScript);
        });

        await new Promise<void>((resolve, reject) => {
          cocoScript = document.createElement("script");
          cocoScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd";
          cocoScript.crossOrigin = "anonymous";
          cocoScript.async = true;
          cocoScript.onload = () => resolve();
          cocoScript.onerror = () => reject(new Error("Failed to load COCO-SSD"));
          document.body.appendChild(cocoScript);
        });

        setScriptsLoaded(true);
      } catch (err) {
        console.error("Failed to load proctoring scripts:", err);
        setScriptsError(true);
      }
    };

    loadScripts();

    return () => {
      if (cameraScript && document.body.contains(cameraScript)) document.body.removeChild(cameraScript);
      if (faceMeshScript && document.body.contains(faceMeshScript)) document.body.removeChild(faceMeshScript);
      if (tfScript && document.body.contains(tfScript)) document.body.removeChild(tfScript);
      if (cocoScript && document.body.contains(cocoScript)) document.body.removeChild(cocoScript);
    };
  }, []);

  // Load COCO-SSD model once scripts are loaded
  useEffect(() => {
    if (!scriptsLoaded || typeof window === "undefined") return;

    const loadCocoModel = async () => {
      try {
        const cocoSsd = (window as any).cocoSsd;
        if (cocoSsd) {
          setModelLoading(true);
          const model = await cocoSsd.load();
          cocoModelRef.current = model;
          console.log("[*] COCO-SSD model loaded successfully.");
        }
      } catch (err) {
        console.error("Failed to load COCO-SSD model:", err);
      } finally {
        setModelLoading(false);
      }
    };

    loadCocoModel();
  }, [scriptsLoaded]);

  // ─── Fullscreen helpers ────────────────────────────────────────────────────
  const enterFullscreen = async (): Promise<boolean> => {
    try {
      const docEl = document.documentElement as any;
      if (!document.fullscreenElement) {
        const requestFn = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
        if (!requestFn) return false;

        await Promise.race([
          Promise.resolve(requestFn.call(docEl)),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 800))
        ]);
      }
      return !!document.fullscreenElement;
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
      return !!document.fullscreenElement;
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (e) { }
  };

  // Phase 1 – ask the user for fullscreen permission
  const handleRequestFullscreen = async () => {
    setFsState("requesting");
    try {
      const docEl = document.documentElement as any;
      const requestFn = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
      
      if (!requestFn) throw new Error("Fullscreen API not supported");

      // Execute request and race it with a 1-second timeout to prevent indefinite hanging
      await Promise.race([
        Promise.resolve(requestFn.call(docEl)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
      ]);

      // Verify it actually entered fullscreen
      if (document.fullscreenElement) {
        setFsState("granted");
      } else {
        setFsState("denied");
      }
    } catch (err) {
      console.warn("Fullscreen request failed or timed out:", err);
      // Fallback check just in case the promise rejected but the browser STILL entered fullscreen
      if (document.fullscreenElement) {
        setFsState("granted");
      } else {
        setFsState("denied");
      }
    }
  };

  const handleRequestCamera = async () => {
    setCamState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCamState("granted");
    } catch (err) {
      console.warn("Camera request failed:", err);
      setCamState("denied");
    }
  };

  // Phase 2 – actually start the exam (only called after fullscreen & camera granted)
  const handleStartTest = async () => {
    if (!course || fsState !== "granted" || camState !== "granted") return;
    // Ensure we are still in fullscreen (user might have Esc'd between clicks)
    if (!document.fullscreenElement) {
      setFsState("denied");
      return;
    }
    setTestStarted(true);
    setCheatWarnings(0);
    setTimeLeft(600);
    setActiveWarningModal(null);
    loadQuiz(course);
  };

  const startRecording = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream || isRecordingRef.current) return;

    try {
      recordedChunksRef.current = [];
      const options = { mimeType: "video/webm;codecs=vp9" };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        try {
          recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        } catch (e2) {
          recorder = new MediaRecorder(stream); // Fallback to default
        }
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.start(250); // Slice stream into 250ms chunks
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;
      console.log("[*] Started MediaRecorder for proctoring alert.");
    } catch (err) {
      console.warn("Failed to start MediaRecorder:", err);
    }
  };

  const uploadViolationVideo = async (videoBlob: Blob) => {
    if (!user || !course) return;

    const formData = new FormData();
    formData.append("file", videoBlob, "violation.webm");
    formData.append("user_id", String(user.id));
    formData.append("username", user.username);
    formData.append("course_id", String(course.id));
    formData.append("course_title", course.title);

    try {
      const response = await fetch(`${API_BASE_URL}/api/proctoring/violation`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        console.log("[*] Proctoring violation video clip uploaded successfully:", data);
      }
    } catch (err) {
      console.warn("Failed to upload proctoring video:", err);
    }
  };

  const stopAndUploadRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecordingRef.current) return;

    recorder.onstop = async () => {
      isRecordingRef.current = false;
      const videoBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      if (videoBlob.size > 0) {
        uploadViolationVideo(videoBlob);
      }
      recordedChunksRef.current = [];
    };

    try {
      recorder.stop();
      console.log("[*] Stopped recording. Initiating upload...");
    } catch (e) {
      isRecordingRef.current = false;
    }
  };

  const discardRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecordingRef.current) return;

    recorder.onstop = () => {
      isRecordingRef.current = false;
      recordedChunksRef.current = [];
      console.log("[*] Discarded recorded chunks.");
    };

    try {
      recorder.stop();
    } catch (e) {
      isRecordingRef.current = false;
    }
  };

  const handleDismissWarning = async () => {
    const success = await enterFullscreen();
    if (success || document.fullscreenElement) {
      setActiveWarningModal(null);
    } else {
      setActiveWarningModal(prev => prev ? {
        ...prev,
        message: prev.message.includes("Could not re-enter") ? prev.message : prev.message + "\n\n⚠️ Could not re-enter fullscreen. Please try clicking again."
      } : null);
    }
  };

  const triggerCheatWarning = (title: string, message: string) => {
    if (!testStarted || quizFinished || quizFinishedRef.current || submitting || submittingRef.current) return;

    // Ignore duplicates if modal is already open
    if (activeWarningModal) return;

    const nextWarnings = cheatWarnings + 1;
    setCheatWarnings(nextWarnings);

    if (nextWarnings >= 3) {
      handleFailQuiz(`Disqualified automatically due to multiple anti-cheat violations: ${title}.`);
    } else {
      const penaltyText = nextWarnings === 1 ? "10% score deduction" : "20% score deduction";
      setActiveWarningModal({
        title,
        message,
        warningIndex: nextWarnings,
        penaltyText,
      });
    }
  };

  // Initialize MediaPipe FaceMesh & camera
  useEffect(() => {
    if (!testStarted || !scriptsLoaded || typeof window === "undefined" || quizFinished) return;

    const FaceMeshClass = (window as any).FaceMesh;
    const CameraClass = (window as any).Camera;

    if (!FaceMeshClass || !CameraClass) return;

    let active = true;

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext("2d");
    if (!canvasCtx) return;

    const onResults = (results: any) => {
      if (!active) return;
      canvasElement.width = videoElement.videoWidth || 320;
      canvasElement.height = videoElement.videoHeight || 240;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // Draw structural neural connections
        canvasCtx.fillStyle = "rgba(139, 92, 246, 0.4)";
        canvasCtx.strokeStyle = "rgba(139, 92, 246, 0.2)";
        canvasCtx.lineWidth = 0.5;

        for (let i = 0; i < landmarks.length; i += 8) {
          const pt = landmarks[i];
          const x = pt.x * canvasElement.width;
          const y = pt.y * canvasElement.height;
          canvasCtx.beginPath();
          canvasCtx.arc(x, y, 1.0, 0, 2 * Math.PI);
          canvasCtx.fill();
        }

        // Gaze checking
        if (landmarks[33] && landmarks[133] && landmarks[468]) {
          const outerCorner = landmarks[33];
          const innerCorner = landmarks[133];
          const iris = landmarks[468];

          const eyeWidth = Math.abs(outerCorner.x - innerCorner.x);
          const eyeCenterX = (outerCorner.x + innerCorner.x) / 2;
          const gazeOffset = Math.abs(iris.x - eyeCenterX) / (eyeWidth || 1);

          if (gazeOffset > 0.22) {
            setGazeStatus("Looking Away");
          } else {
            setGazeStatus("Focused");
          }
        }
      } else {
        setGazeStatus("Face Not Detected");
      }
      canvasCtx.restore();
    };

    const faceMesh = new FaceMeshClass({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
      maxNumFaces: 4, // Track up to 4 faces to detect multiple people proctoring violations
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onResults);
    faceMeshRef.current = faceMesh;

    const camera = new CameraClass(videoElement, {
      onFrame: async () => {
        if (!active || !videoElement) return;
        try {
          await faceMesh.send({ image: videoElement });
        } catch (e) {
          console.warn("FaceMesh send frame error (likely during unmount):", e);
        }
      },
      width: 320,
      height: 240
    });

    camera.start();
    cameraRef.current = camera;

    return () => {
      active = false;
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.error("Error stopping camera:", e);
        }
        cameraRef.current = null;
      }
      if (faceMeshRef.current) {
        try {
          faceMeshRef.current.close();
        } catch (e) {
          console.error("Error closing faceMesh:", e);
        }
        faceMeshRef.current = null;
      }
      setGazeStatus("Focused");
    };
  }, [scriptsLoaded, quizFinished, testStarted]);

  // Start/discard recording based on gaze status transitions
  useEffect(() => {
    if (!testStarted || quizFinished || !quiz || activeWarningModal) return;

    if (gazeStatus === "Looking Away" || gazeStatus === "Face Not Detected") {
      startRecording();
    } else if (gazeStatus === "Focused" && isRecordingRef.current) {
      discardRecording();
    }
  }, [gazeStatus, testStarted, quizFinished, quiz, activeWarningModal]);

  // Gaze & Face Presence Warning Timer
  useEffect(() => {
    if (!testStarted || quizFinished || !quiz || activeWarningModal) {
      setLookAwayTimer(0);
      return;
    }
    let interval: any = null;
    if (gazeStatus === "Looking Away" || gazeStatus === "Face Not Detected") {
      interval = setInterval(() => {
        setLookAwayTimer((prev) => {
          if (prev >= 4) {
            const title = gazeStatus === "Looking Away" ? "Suspicious Behavior: Looking Away" : "Proctoring Violation: Face Not Detected";
            const message = gazeStatus === "Looking Away"
              ? "Please focus on your workspace! Looking away from the editor screen is prohibited during verification."
              : "Your face is not visible in the proctoring frame. Please ensure you are centered in front of the camera.";

            // Stop and upload the WebM recording of this violation
            stopAndUploadRecording();

            triggerCheatWarning(title, message);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setLookAwayTimer(0);
    }
    return () => clearInterval(interval);
  }, [gazeStatus, quizFinished, quiz, testStarted, activeWarningModal, cheatWarnings]);

  // Object detection scanning loop for mobile phone detection (runs once every 1.5 seconds)
  useEffect(() => {
    if (!testStarted || quizFinished || !quiz || activeWarningModal) return;

    const interval = setInterval(async () => {
      const videoElement = videoRef.current;
      const cocoModel = cocoModelRef.current;

      if (videoElement && cocoModel && videoElement.readyState >= 2) {
        try {
          const predictions = await cocoModel.detect(videoElement);

          // Check for mobile phone
          const hasPhone = predictions.some((p: any) =>
            (p.class === "cell phone" || p.class === "phone" || p.class === "mobile phone") && p.score > 0.45
          );

          if (hasPhone) {
            triggerCheatWarning(
              "Mobile Phone Detected",
              "Using a mobile phone or electronic device is strictly prohibited during the test."
            );
            return;
          }

          // Check for multiple persons
          const personsCount = predictions.filter((p: any) => p.class === "person" && p.score > 0.5).length;
          if (personsCount > 1) {
            triggerCheatWarning(
              "Multiple Persons Detected",
              "Proctoring detected multiple people in the camera frame. The test must be taken alone."
            );
          }
        } catch (err) {
          console.warn("Object detection scan error:", err);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [testStarted, quizFinished, quiz, activeWarningModal, cheatWarnings]);

  // Tab Swapping / Blur / Fullscreen Exit Anti-Cheat Listeners
  useEffect(() => {
    if (!testStarted || quizFinished || !quiz) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !quizFinished && testStarted) {
        triggerCheatWarning(
          "Tab/Window Swapped",
          "Switching tabs or minimizing the browser window during the test is strictly prohibited."
        );
      }
    };

    const handleWindowBlur = () => {
      if (!quizFinished && testStarted) {
        triggerCheatWarning(
          "Window Lost Focus",
          "Leaving the test editor workspace window is prohibited. Please keep the test window focused."
        );
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !quizFinished && testStarted) {
        triggerCheatWarning(
          "Fullscreen Mode Exited",
          "You must remain in fullscreen mode during the verification. Exiting fullscreen is a proctoring violation."
        );
      }
    };

    // Trap the Escape key – prevent it from being used to exit fullscreen
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && testStarted && !quizFinished) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [cheatWarnings, quizFinished, quiz, testStarted, activeWarningModal]);

  // Countdown timer effect
  useEffect(() => {
    if (!testStarted || quizFinished || loading || loadingQuiz || !quiz || activeWarningModal) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          alert("Time's up! Your solution is automatically being submitted.");
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [quizFinished, loading, loadingQuiz, quiz, testStarted, activeWarningModal]);

  // Prevent reload / tab close during test
  // Also send a keepalive fetch/beacon to submit as failed if they leave the tab/browser
  useEffect(() => {
    if (!testStarted || quizFinished) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Leaving this page will terminate your test and result in automatic failure.";
      return e.returnValue;
    };

    const handleUnload = () => {
      if (testStarted && !quizFinished && user && course && quiz) {
        const skillName = course.tags?.[0] || course.title || "Skill";
        const body = JSON.stringify({
          user_id: user.id,
          course_id: course.id,
          skill_name: skillName,
          difficulty: course.difficulty,
          challenge_title: quiz.title,
          description: quiz.description,
          language: quiz.language,
          test_cases: quiz.test_cases,
          student_code: `# Abandoned in-between\n# Student closed the browser tab or reloaded the page.`,
          boilerplate_code: quiz.boilerplate_code || "",
          warnings: 3,
          lesson_id: lessonId ? Number(lessonId) : null,
          is_final: isFinal
        });

        try {
          if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: "application/json" });
            navigator.sendBeacon(`${API_BASE_URL}/api/learning/quiz/submit`, blob);
          } else {
            fetch(`${API_BASE_URL}/api/learning/quiz/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              keepalive: true
            });
          }
        } catch (err) {
          console.error("Error sending keepalive submit:", err);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [testStarted, quizFinished, user, course, quiz, lessonId]);

  // Intercept client-side routing using popstate
  useEffect(() => {
    if (!testStarted || quizFinished) return;

    window.history.pushState(null, "", window.location.href);

    const handlePopState = async (e: PopStateEvent) => {
      window.history.pushState(null, "", window.location.href);
      if (confirm("Are you sure you want to exit? Your progress will be lost and graded as failed with 0% score.")) {
        if (document.fullscreenElement) {
          try {
            await document.exitFullscreen();
          } catch (err) { }
        }
        await handleFailQuiz("Exited the proctored test environment voluntarily.");
        router.push(`/learning/${courseId}`);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [testStarted, quizFinished, courseId, user, course, quiz]);

  const loadQuiz = async (courseData: any) => {
    setLoadingQuiz(true);
    setQuizError(null);
    setActiveQuestionIndex(0);
    try {
      let examData: any = null;
      if (isFinal) {
        const response = await fetch(`${API_BASE_URL}/api/learning/courses/${courseId}/final-exam?user_id=${user.id}`);
        if (!response.ok) {
          throw new Error("No final exam configured for this course.");
        }
        examData = await response.json();
      } else if (lessonId) {
        const response = await fetch(`${API_BASE_URL}/api/learning/courses/${courseId}/lessons/${lessonId}/exam?user_id=${user.id}`);
        if (!response.ok) {
          throw new Error("No exam configured for this lesson module.");
        }
        examData = await response.json();
      }

      if (examData) {
        // Start the attempt session on the server
        const attemptResponse = await fetch(`${API_BASE_URL}/api/learning/exams/${examData.id}/start-attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            exam_type: isFinal ? "final" : "lesson"
          })
        });

        if (!attemptResponse.ok) {
          const attemptError = await attemptResponse.json();
          throw new Error(attemptError.detail || "This exam has been closed by your mentor.");
        }

        setQuiz(examData);
        if (examData.is_multi && examData.questions?.length > 0) {
          const codes = examData.questions.map((q: any) => q.boilerplate_code || "");
          setStudentCodes(codes);
          setStudentCode(codes[0] || "");
        } else {
          setStudentCodes([examData.boilerplate_code || ""]);
          setStudentCode(examData.boilerplate_code || "");
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/api/learning/quiz/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_title: courseData.title,
            difficulty: courseData.difficulty,
          }),
        });
        const data = await response.json();
        if (response.ok && data.status === "success" && data.quiz) {
          setQuiz(data.quiz);
          setStudentCodes([data.quiz.boilerplate_code || ""]);
          setStudentCode(data.quiz.boilerplate_code || "");
        } else {
          setQuizError(data.message || "Failed to generate AI coding challenge.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setQuizError(err.message || "Could not connect to AI challenge generator service.");
      setTestStarted(false);
      exitFullscreen();
    } finally {
      setLoadingQuiz(false);
      setLoading(false);
    }
  };

  const handleFailQuiz = async (reason: string) => {
    setSubmitting(true);
    submittingRef.current = true;
    try {
      const skillName = course?.tags[0] || course?.title || "Skill";
      const response = await fetch(`${API_BASE_URL}/api/learning/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          course_id: course.id,
          skill_name: skillName,
          difficulty: course.difficulty,
          challenge_title: quiz?.title || "AI Skill Verification",
          description: quiz?.description || "Suspended quiz.",
          language: quiz?.language || "python",
          test_cases: quiz?.test_cases || [],
          student_code: `# Terminated due to violations\n# Reason: ${reason}`,
          boilerplate_code: quiz?.boilerplate_code || "",
          warnings: 3,
          lesson_id: lessonId ? Number(lessonId) : null,
          is_final: isFinal
        }),
      });
      const result = await response.json();
      setSubmitResult({
        status: "failed",
        score: 0,
        message: reason,
        evaluation: {
          score: 0,
          passed: false,
          feedback: reason,
          test_cases_run: []
        }
      });
      setQuizFinished(true);
      quizFinishedRef.current = true;
      await exitFullscreen();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };


  const handleRunCode = async () => {
    if (runCount >= maxRuns) return;
    setIsExecuting(true);
    setExecutionOutput(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/learning/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: studentCode,
          language: selectedLanguage
        })
      });
      const data = await res.json();
      setExecutionOutput(data);
      setRunCount(prev => prev + 1);
    } catch (err) {
      setExecutionOutput({ stdout: "", stderr: "Network error or execution failed." });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!quiz || !user || !course) return;
    setSubmitting(true);
    submittingRef.current = true;

    const skillName = course.tags[0] || course.title;

    // Save current question code before submitting
    const latestCodes = [...studentCodes];
    latestCodes[activeQuestionIndex] = studentCode;

    const isMulti = quiz.is_multi && quiz.questions && quiz.questions.length > 1;

    try {
      const response = await fetch(`${API_BASE_URL}/api/learning/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          course_id: course.id,
          skill_name: skillName,
          difficulty: quiz.difficulty || course.difficulty,
          challenge_title: quiz.title,
          description: quiz.description || "",
          language: quiz.language,
          test_cases: isMulti ? [] : quiz.test_cases,
          student_code: isMulti ? latestCodes.join("\n\n") : studentCode,
          boilerplate_code: quiz.boilerplate_code || "",
          warnings: cheatWarnings,
          lesson_id: lessonId ? Number(lessonId) : null,
          is_final: isFinal,
          // Multi-question fields
          ...(isMulti && {
            student_codes: latestCodes,
            questions: quiz.questions,
          }),
        }),
      });
      const result = await response.json();
      setSubmitResult(result);
      setQuizFinished(true);
      quizFinishedRef.current = true;
      await exitFullscreen();
    } catch (err) {
      console.error(err);
      alert("Error grading code solution.");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleSendHint = async () => {
    if (!hintQuery.trim() || submittingHint || !quiz) return;

    const difficultyLower = quiz?.difficulty?.toLowerCase() || course?.difficulty?.toLowerCase() || "beginner";
    const maxHints = difficultyLower === "expert" ? 3 : difficultyLower === "intermediate" ? 2 : 1;

    if (hintsUsed >= maxHints) {
      alert(`You have reached the maximum of ${maxHints} hint(s) allowed for this challenge.`);
      return;
    }

    const currentQuery = hintQuery.trim();
    setHintQuery("");
    setSubmittingHint(true);

    const updatedHistory = [...chatHistory, { role: "user" as const, content: currentQuery }];
    setChatHistory(updatedHistory);

    try {
      const response = await fetch(`${API_BASE_URL}/api/learning/quiz/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_title: quiz.title,
          description: quiz.description,
          language: quiz.language,
          student_code: studentCode,
          chat_history: chatHistory.map(h => ({ role: h.role, content: h.content })),
          user_message: currentQuery,
        }),
      });

      const data = await response.json();
      if (response.ok && data.status === "success" && data.hint) {
        setChatHistory([
          ...updatedHistory,
          { role: "assistant" as const, content: data.hint }
        ]);
        setHintsUsed(prev => prev + 1);
      } else {
        setChatHistory([
          ...updatedHistory,
          { role: "assistant" as const, content: "Sorry, I couldn't generate a hint right now. Please try again." }
        ]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory([
        ...updatedHistory,
        { role: "assistant" as const, content: "Connection error. Failed to reach hint service." }
      ]);
    } finally {
      setSubmittingHint(false);
    }
  };

  const renderMessageContent = (text: string) => {
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={index} className="px-1.5 py-0.5 rounded bg-zinc-950 text-violet-300 font-mono text-[11px] border border-white/5">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={index} className="whitespace-pre-line">{part}</span>;
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const difficultyLower = quiz?.difficulty?.toLowerCase() || course?.difficulty?.toLowerCase() || "beginner";
  const maxHints = difficultyLower === "expert" ? 3 : difficultyLower === "intermediate" ? 2 : 1;

  const lineCount = studentCode.split("\n").length;
  const lineNumbers = Array.from({ length: Math.max(18, lineCount) }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Entering IDE Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-x-hidden pb-20">
      {/* ambient glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] bg-violet-900/10 pointer-events-none" />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!testStarted && (
            <button
              onClick={() => router.push(`/learning/${courseId}`)}
              className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-extrabold text-white">{course?.title || "Verification Test"}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {quiz && !quizFinished && (
            <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-sm font-bold tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              TIME LEFT: {formatTime(timeLeft)}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-violet-400" />
            <span className="text-xs text-zinc-400 font-bold">Difficulty: {quiz?.difficulty || course?.difficulty}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {/* 0. Introductory Start Screen State */}
          {!testStarted && !examClosed && (
            <motion.div
              key="intro-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-2xl mx-auto mt-10 p-8 md:p-12 glass-card rounded-[2rem] border border-white/10 bg-zinc-900/40 space-y-8 relative overflow-hidden shadow-[0_0_80px_rgba(139,92,246,0.06)]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] bg-violet-500/10 pointer-events-none" />

              <div className="space-y-4 text-center">
                <span className="px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Proctored Skill Verification
                </span>
                <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
                  Ready to prove your mastery?
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-md mx-auto">
                  Take the timed proctored coding test for <span className="text-white font-semibold">{course?.title}</span> to issue a verified skill badge directly to your public credentials.
                </p>
              </div>

              <div className="border-t border-b border-white/5 py-6 space-y-4">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest text-center md:text-left">Strict Proctoring Rules:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 space-y-1">
                    <span className="font-bold text-white block">⏱️ 10-Minute Timer</span>
                    <span className="text-zinc-500">You must solve the challenge and submit before time runs out.</span>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 space-y-1">
                    <span className="font-bold text-white block">🖥️ Fullscreen Required</span>
                    <span className="text-zinc-500">You must grant fullscreen permission before the exam can begin.</span>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 space-y-1">
                    <span className="font-bold text-white block">🚫 No Tab/Window Swapping</span>
                    <span className="text-zinc-500">Leaving the window or switching tabs instantly triggers a warning.</span>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950/60 border border-white/5 space-y-1">
                    <span className="font-bold text-white block">🎥 AI Webcam Gaze Tracking</span>
                    <span className="text-zinc-500">Looking away from the screen for more than 4 seconds triggers a warning.</span>
                  </div>
                </div>
              </div>

              {/* ── Camera Permission Gate ───────────────────────────── */}
              <div className={`p-5 rounded-2xl border space-y-4 transition-all ${
                camState === "granted"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : camState === "denied"
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-violet-500/20 bg-violet-500/5"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    camState === "granted" ? "bg-emerald-500/20" :
                    camState === "denied"  ? "bg-red-500/20" :
                    "bg-violet-500/20"
                  }`}>
                    {camState === "granted" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : camState === "denied" ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Video className="w-4 h-4 text-violet-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${
                      camState === "granted" ? "text-emerald-300" :
                      camState === "denied"  ? "text-red-300" :
                      "text-violet-300"
                    }`}>
                      {camState === "idle"       && "Camera Access Required"}
                      {camState === "requesting" && "Requesting camera…"}
                      {camState === "granted"    && "✓ Camera Access Granted"}
                      {camState === "denied"     && "✗ Camera Denied — Permission is required"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {camState === "idle"    && "Click \"Allow Camera\" below. Your browser will prompt for camera access — this is required for proctoring."}
                      {camState === "denied"  && "Your browser blocked the camera. Click \"Try Again\" to request permission once more."}
                      {camState === "granted" && "The camera will be activated when the exam begins."}
                    </p>
                  </div>
                </div>

                {camState !== "granted" && (
                  <button
                    onClick={handleRequestCamera}
                    disabled={camState === "requesting"}
                    className="w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-60 bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center gap-2"
                  >
                    {camState === "requesting" ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Requesting…</>
                    ) : camState === "denied" ? (
                      <><RefreshCw className="w-3.5 h-3.5" /> Try Again — Allow Camera</>
                    ) : (
                      <><Video className="w-3.5 h-3.5" /> Allow Camera Access</>
                    )}
                  </button>
                )}
              </div>

              {/* ── Fullscreen Permission Gate ───────────────────────────── */}
              <div className={`p-5 rounded-2xl border space-y-4 transition-all ${fsState === "granted"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : fsState === "denied"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-violet-500/20 bg-violet-500/5"
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${fsState === "granted" ? "bg-emerald-500/20" :
                      fsState === "denied" ? "bg-red-500/20" :
                        "bg-violet-500/20"
                    }`}>
                    {fsState === "granted" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : fsState === "denied" ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-violet-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${fsState === "granted" ? "text-emerald-300" :
                        fsState === "denied" ? "text-red-300" :
                          "text-violet-300"
                      }`}>
                      {fsState === "idle" && "Fullscreen Permission Required"}
                      {fsState === "requesting" && "Requesting fullscreen…"}
                      {fsState === "granted" && "✓ Fullscreen Granted — You may begin the exam"}
                      {fsState === "denied" && "✗ Fullscreen Denied — Permission is required to continue"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {fsState === "idle" && "Click \"Enable Fullscreen\" below. Your browser will show a permission prompt — you must allow it."}
                      {fsState === "denied" && "Your browser blocked or you dismissed the fullscreen prompt. Click \"Try Again\" to request permission once more."}
                      {fsState === "granted" && "The exam is locked in fullscreen mode. Pressing Escape during the exam will not exit fullscreen."}
                    </p>
                  </div>
                </div>

                {/* Permission action button */}
                {fsState !== "granted" && (
                  <button
                    onClick={handleRequestFullscreen}
                    disabled={fsState === "requesting" || camState !== "granted"}
                    title={camState !== "granted" ? "You must allow camera access first" : ""}
                    className="w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-60 bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center gap-2"
                  >
                    {fsState === "requesting" ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Requesting…</>
                    ) : fsState === "denied" ? (
                      <><RefreshCw className="w-3.5 h-3.5" /> Try Again — Enable Fullscreen</>
                    ) : (
                      <><Eye className="w-3.5 h-3.5" /> Enable Fullscreen to Continue</>
                    )}
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 space-y-2 text-[11px] text-zinc-400">
                <span className="font-bold text-violet-400 uppercase tracking-wider block">⚠️ WARNING PENALTY MODEL:</span>
                <ul className="list-disc list-inside space-y-1">
                  <li>0 Warnings: Full evaluation score is recorded.</li>
                  <li>1 Warning: <span className="text-amber-400 font-bold">10% points deducted</span> from final score.</li>
                  <li>2 Warnings: <span className="text-amber-400 font-bold">20% points deducted</span> from final score.</li>
                  <li>3 Warnings: <span className="text-red-400 font-bold">Immediate failure and disqualification</span>.</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => router.push(`/learning/${courseId}`)}
                  className="w-full sm:w-auto px-8 py-3 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel &amp; Go Back
                </button>
                <button
                  onClick={handleStartTest}
                  disabled={fsState !== "granted" || camState !== "granted"}
                  title={fsState !== "granted" ? "You must enable fullscreen first" : camState !== "granted" ? "You must allow camera first" : ""}
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-violet-500/25 hover:opacity-90 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100"
                >
                  Start Verification
                </button>
              </div>
            </motion.div>
          )}

          {/* Exam Closed State */}
          {examClosed && (
            <motion.div
              key="exam-closed"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto text-center p-12 glass-card rounded-[2rem] border border-white/10 space-y-6 shadow-2xl mt-20"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Exam Closed</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {examClosedMessage || "This exam has been closed by your mentor. New attempts are no longer accepted."}
                </p>
              </div>
              <button
                onClick={() => router.push(`/learning/${courseId}`)}
                className="w-full py-3 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Go Back to Course
              </button>
            </motion.div>
          )}

          {/* 1. Loading Quiz State */}
          {testStarted && loadingQuiz && (
            <motion.div
              key="loading-quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center p-12 glass-card rounded-3xl border border-white/10 space-y-6 shadow-2xl max-w-lg mx-auto mt-20"
            >
              <div className="w-16 h-16 bg-violet-500/10 rounded-full flex items-center justify-center mx-auto border border-violet-500/20">
                <BrainCircuit className="w-8 h-8 text-violet-400 animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">AI is Generating Coding Test</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Gemini is drafting an algorithmic code challenge with custom test cases tailored to the <span className="text-violet-300 font-semibold">{course?.difficulty}</span> level of {course?.title}.
                </p>
              </div>
            </motion.div>
          )}

          {/* 2. Error State */}
          {!loadingQuiz && quizError && (
            <motion.div
              key="error-quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center p-12 glass-card rounded-3xl border border-red-500/10 space-y-6 max-w-md mx-auto mt-20"
            >
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <h3 className="text-xl font-bold text-white">Generation Failed</h3>
              <p className="text-zinc-500 text-sm">{quizError}</p>
              <button
                onClick={() => loadQuiz(course)}
                className="px-6 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 mx-auto transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </button>
            </motion.div>
          )}

          {/* 3. Quiz Running State */}
          {!loadingQuiz && !quizError && quiz && !quizFinished && (
            <motion.div
              key="quiz-run"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Panel: Problem description & Webcam telemetry */}
              <div className="lg:col-span-5 space-y-6">

                {/* Challenge description card */}
                <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full border text-[10px] font-bold bg-violet-500/10 border-violet-500/20 text-violet-400">
                      {quiz.is_multi ? `Question ${activeQuestionIndex + 1} of ${quiz.questions!.length}` : "Problem Target"}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Language: {quiz.language.toUpperCase()}
                    </span>
                  </div>

                  <h2 className="text-2xl font-black text-white">
                    {quiz.is_multi ? quiz.questions![activeQuestionIndex].title : quiz.title}
                  </h2>
                  <div className="prose prose-invert max-w-none text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {quiz.is_multi ? quiz.questions![activeQuestionIndex].description : quiz.description}
                  </div>

                  {/* Previous / Next navigation for multi-question exams */}
                  {quiz.is_multi && quiz.questions && quiz.questions.length > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <button
                        disabled={activeQuestionIndex === 0}
                        onClick={() => {
                          // Save current code before switching
                          const updated = [...studentCodes];
                          updated[activeQuestionIndex] = studentCode;
                          setStudentCodes(updated);
                          const prev = activeQuestionIndex - 1;
                          setActiveQuestionIndex(prev);
                          setStudentCode(updated[prev] || "");
                        }}
                        className="px-4 py-2 rounded-lg text-xs font-bold border border-white/10 text-zinc-400 hover:text-white hover:border-violet-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        ← Previous
                      </button>
                      <div className="flex gap-1.5">
                        {quiz.questions.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const updated = [...studentCodes];
                              updated[activeQuestionIndex] = studentCode;
                              setStudentCodes(updated);
                              setActiveQuestionIndex(i);
                              setStudentCode(updated[i] || "");
                            }}
                            className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all cursor-pointer ${i === activeQuestionIndex
                                ? "bg-violet-500 text-white"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                              }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      <button
                        disabled={activeQuestionIndex === quiz.questions.length - 1}
                        onClick={() => {
                          const updated = [...studentCodes];
                          updated[activeQuestionIndex] = studentCode;
                          setStudentCodes(updated);
                          const next = activeQuestionIndex + 1;
                          setActiveQuestionIndex(next);
                          setStudentCode(updated[next] || "");
                        }}
                        className="px-4 py-2 rounded-lg text-xs font-bold border border-white/10 text-zinc-400 hover:text-white hover:border-violet-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>

                {/* Test cases indicator */}
                <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/20 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Target Test Cases</h4>
                  <div className="space-y-2">
                    {(quiz.is_multi
                      ? (quiz.questions![activeQuestionIndex].test_cases || [])
                      : quiz.test_cases
                    ).map((tc: any, idx: number) => (
                      <div key={idx} className="p-3 bg-zinc-950/80 rounded-xl border border-white/5 font-mono text-xs flex justify-between gap-4">
                        <span className="text-zinc-500">In: <span className="text-violet-300">{tc.input}</span></span>
                        <span className="text-zinc-500">Out: <span className="text-emerald-300">{tc.expected}</span></span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Proctoring Console Card */}
                <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-violet-400" /> Proctoring Status
                    </h4>
                    <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[9px] font-bold uppercase tracking-wider">
                      Console Active
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Camera Connection:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Feed Connected
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Eye Gaze Tracking:</span>
                      <span className={`font-bold ${gazeStatus === "Focused" ? "text-teal-400" : "text-amber-400 animate-pulse"}`}>
                        {gazeStatus}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Warnings Count:</span>
                      <span className={`font-bold font-mono ${cheatWarnings > 0 ? "text-red-400" : "text-zinc-400"}`}>
                        {cheatWarnings} / 3 Violations
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/10 text-[10px] text-zinc-400 leading-relaxed">
                    🚨 <strong>Anti-Cheat Active:</strong> Switching tabs, losing window focus, or looking away from the screen for more than 4 seconds will trigger proctoring penalties.
                  </div>
                </div>
              </div>

              {/* Right Panel: Code Editor */}
              <div className="lg:col-span-7 space-y-6">

                <div className="p-4 rounded-3xl border border-white/10 bg-zinc-900/30 space-y-4">
                  {/* Top Editor bar */}
                  <div className="flex justify-between items-center text-xs font-mono text-zinc-500">
                    <span className="flex items-center gap-1.5"><Code className="w-3.5 h-3.5 text-violet-400" /> solution.{quiz.language === "python" ? "py" : "js"}</span>
                    <button
                      onClick={() => {
                        const activeBoilerplate = quiz.is_multi
                          ? quiz.questions![activeQuestionIndex].boilerplate_code || ""
                          : quiz.boilerplate_code || "";
                        if (!confirmReset) {
                          setConfirmReset(true);
                          setTimeout(() => setConfirmReset(false), 3000);
                        } else {
                          setStudentCode(activeBoilerplate);
                          const updated = [...studentCodes];
                          updated[activeQuestionIndex] = activeBoilerplate;
                          setStudentCodes(updated);
                          setConfirmReset(false);
                        }
                      }}
                      className={`transition-colors cursor-pointer ${confirmReset ? "text-red-400 hover:text-red-300 font-bold" : "text-zinc-500 hover:text-white"}`}
                    >
                      {confirmReset ? "[Confirm Reset?]" : "[Reset Boilerplate]"}
                    </button>
                  </div>

                  {/* Language Selector & Code editor body */}
                  <div className="flex justify-between items-center bg-zinc-950/80 px-4 py-2 border border-white/10 rounded-t-2xl">
                    <div className="flex gap-2">
                      {["python", "javascript", "java", "c++"].map(lang => (
                        <button 
                          key={lang}
                          onClick={() => setSelectedLanguage(lang)}
                          className={`text-[10px] px-3 py-1 uppercase tracking-wider font-bold rounded-lg transition-all ${selectedLanguage === lang ? "bg-violet-500 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={handleRunCode}
                      disabled={isExecuting || runCount >= maxRuns || studentCode.trim().length === 0}
                      className={`text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${runCount >= maxRuns ? "bg-red-500/10 text-red-500 cursor-not-allowed border border-red-500/20" : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"}`}
                    >
                      {isExecuting ? <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                      {runCount >= maxRuns ? "Limit Reached" : `Run Code (${maxRuns - runCount} Left)`}
                    </button>
                  </div>
                  <div className="flex font-mono text-sm bg-zinc-950/90 border-x border-b border-white/10 overflow-hidden h-[420px]">
                    <Editor
                      height="100%"
                      language={selectedLanguage === "c++" ? "cpp" : selectedLanguage}
                      theme="vs-dark"
                      value={studentCode}
                      onChange={(val) => setStudentCode(val || "")}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        padding: { top: 16 },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        cursorBlinking: "smooth",
                        cursorSmoothCaretAnimation: "on",
                        formatOnPaste: true
                      }}
                    />
                  </div>
                  
                  {/* Execution Output Window */}
                  {executionOutput && (
                    <div className="mt-4 p-4 rounded-xl border border-white/10 bg-[#0d0d0d] font-mono text-xs overflow-hidden">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5 text-zinc-500 uppercase tracking-widest font-bold text-[10px]">
                        <Terminal className="w-3.5 h-3.5" /> Terminal Output
                      </div>
                      {executionOutput.stdout && (
                        <div className="text-zinc-300 whitespace-pre-wrap">{executionOutput.stdout}</div>
                      )}
                      {executionOutput.stderr && (
                        <div className="text-red-400 whitespace-pre-wrap mt-2">{executionOutput.stderr}</div>
                      )}
                      {!executionOutput.stdout && !executionOutput.stderr && (
                        <div className="text-zinc-600 italic">Program exited with no output.</div>
                      )}
                    </div>
                  )}

                  {/* Actions bar */}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] text-zinc-600 leading-normal max-w-sm">
                      {quiz.is_multi
                        ? `* All ${quiz.questions!.length} questions are graded together on submit. Navigate using Previous/Next.`
                        : "* By submitting, your code is validated by the AI evaluator. Score 80%+ correct to earn credentials."}
                    </span>
                    <button
                      onClick={handleSubmitQuiz}
                      disabled={submitting || studentCode.trim().length === 0}
                      className="px-6 py-3.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-white/5"
                    >
                      {submitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                          Evaluating Solution...
                        </>
                      ) : (
                        <>
                          Submit {quiz.is_multi ? `All ${quiz.questions!.length} Questions` : "Code"} <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* 4. Quiz Results View */}
          {quizFinished && submitResult && (
            <motion.div
              key="quiz-results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-10"
            >
              {submitResult.status === "pending_review" ? (
                /* Pending Review View */
                <div className="text-center p-8 md:p-12 glass-card rounded-[3rem] border border-amber-500/25 bg-zinc-900/30 space-y-8 relative overflow-hidden shadow-[0_0_80px_rgba(245,158,11,0.06)]">
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] bg-amber-500/10 pointer-events-none" />

                  <div className="space-y-4">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 text-amber-400">
                      <Loader2 className="w-10 h-10 animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Awaiting Verification</span>
                      <h2 className="text-3xl md:text-5xl font-black text-white leading-tight font-sans">Test Submitted!</h2>
                      <p className="text-zinc-400 text-sm max-w-md mx-auto">
                        Your program has been recorded. Your submission has been successfully submitted and is awaiting grading review by your mentor.
                      </p>
                    </div>
                  </div>

                  <div className="border border-white/10 p-6 md:p-8 rounded-2xl bg-zinc-950/60 max-w-xl mx-auto space-y-4 text-left relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-500" />
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Status: Pending Mentor Review</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light">
                        For security and privacy compliance, your mentor will review your submitted code, correctness score, and webcam gaze telemetry logs.
                      </p>
                      <p className="text-xs text-zinc-500 font-light">
                        Your final course certificate will be issued after the mentor finalizes the grading.
                      </p>
                    </div>
                  </div>

                  {/* AI Feedback terminal output - only show if score is provided (non-null) */}
                  {submitResult.evaluation && submitResult.evaluation.score !== null && submitResult.evaluation.score !== undefined && (
                    <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950 text-left font-mono text-xs text-zinc-400 max-w-3xl mx-auto space-y-3">
                      <div className="text-zinc-500 border-b border-white/5 pb-2 flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-amber-400" /> DRAFT EVALUATION ANALYSIS</div>
                      <p className="text-amber-400">Score: {submitResult.evaluation.score}% - Status: PENDING GRADING</p>
                      <p className="whitespace-pre-wrap text-zinc-300 leading-relaxed">{submitResult.evaluation.feedback}</p>
                    </div>
                  )}

                  <div className="pt-4 flex justify-center gap-4">
                    <button
                      onClick={() => router.push("/learning")}
                      className="px-8 py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-violet-500/25"
                    >
                      Back to Learning Hub
                    </button>
                  </div>
                </div>
              ) : submitResult.status === "success" ? (
                /* Success View */
                <div className="text-center p-8 md:p-12 glass-card rounded-[3rem] border border-emerald-500/25 bg-zinc-900/30 space-y-8 relative overflow-hidden shadow-[0_0_80px_rgba(16,185,129,0.06)]">
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] bg-emerald-500/10 pointer-events-none" />

                  <div className="space-y-4">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 text-emerald-400">
                      <Trophy className="w-10 h-10 animate-bounce" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Skill Authenticated</span>
                      <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">Verification Success!</h2>
                      <p className="text-zinc-400 text-sm max-w-md mx-auto">
                        Incredible execution! Your program scored <span className="text-emerald-400 font-bold">{submitResult.score}%</span> on correctness and code quality metrics.
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Certificate Representation */}
                  <div className="border border-white/10 p-6 md:p-8 rounded-2xl bg-zinc-950/60 max-w-xl mx-auto space-y-4 text-left relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Credential Token ID</span>
                      <span className="text-xs font-mono text-zinc-400 block">{submitResult.certificate_id}</span>
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xl font-bold text-white">{course?.title}</h4>
                      <p className="text-xs text-zinc-500">Issued to candidate: <span className="text-zinc-300 font-bold">{user?.username}</span></p>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-zinc-600 border-t border-white/5 pt-4">
                      <span>Evaluator: System AI (Gemini 2.5)</span>
                      <span>Verified & Sealed on database</span>
                    </div>
                  </div>

                  {/* AI Feedback terminal output */}
                  {submitResult.evaluation && (
                    <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950 text-left font-mono text-xs text-zinc-400 max-w-3xl mx-auto space-y-3">
                      <div className="text-zinc-500 border-b border-white/5 pb-2 flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-violet-400" /> COMPILER EVALUATION METRICS</div>
                      <p className="text-emerald-400">Score: {submitResult.evaluation.score}% - Status: PASSED</p>
                      <p className="whitespace-pre-wrap text-zinc-300 leading-relaxed">{submitResult.evaluation.feedback}</p>
                    </div>
                  )}

                  <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
                    <button
                      onClick={() => router.push("/profile?tab=credentials")}
                      className="px-8 py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-violet-500/25"
                    >
                      <Award className="w-4 h-4" /> View My Profile Credentials
                    </button>
                    <button
                      onClick={() => router.push("/learning")}
                      className="px-8 py-3.5 bg-zinc-900 border border-white/10 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      Back to Learning Hub
                    </button>
                  </div>
                </div>
              ) : (
                /* Failure View with code feedback review */
                <div className="space-y-8">
                  <div className="text-center p-8 md:p-12 glass-card rounded-[3rem] border border-red-500/20 bg-zinc-900/30 space-y-6 relative overflow-hidden">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 text-red-400">
                      <XCircle className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Verification Failed</span>
                      <h2 className="text-3xl font-bold text-white">Try Again</h2>
                      <p className="text-zinc-400 text-sm max-w-md mx-auto">
                        Your program scored <span className="text-red-400 font-bold">{submitResult.score}%</span> on evaluation checks. You need a score of <span className="text-emerald-400 font-bold">80%</span> or higher to verify the skill badge.
                      </p>
                    </div>
                    <div className="pt-4 flex justify-center gap-4">
                      <button
                        onClick={() => router.push(`/learning/${courseId}`)}
                        className="px-6 py-3 bg-zinc-900 border border-white/10 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        Review Lessons
                      </button>
                    </div>
                  </div>

                  {/* AI Feedback review */}
                  {submitResult.evaluation && (
                    <div className="space-y-4 max-w-4xl mx-auto">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-amber-400" />
                        AI Grader Analysis & Review
                      </h3>
                      <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/20 space-y-4">
                        <div className="p-4 rounded-xl bg-red-950/15 border border-red-500/10 text-xs text-red-300 leading-relaxed font-mono">
                          <span className="font-extrabold block mb-2 text-red-400">COMPILER LOGS:</span>
                          {submitResult.evaluation.feedback}
                        </div>

                        {/* Test cases run */}
                        {submitResult.evaluation.test_cases_run && submitResult.evaluation.test_cases_run.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Test Case Telemetry</span>
                            {submitResult.evaluation.test_cases_run.map((tc: any, index: number) => (
                              <div key={index} className="p-3 bg-zinc-950 rounded-xl border border-white/5 font-mono text-xs flex justify-between items-center">
                                <div>
                                  <span className="text-zinc-500">In:</span> <span className="text-zinc-300">{tc.input}</span>
                                  <span className="text-zinc-500 ml-4">Expected:</span> <span className="text-zinc-300">{tc.expected}</span>
                                  {tc.actual && (
                                    <>
                                      <span className="text-zinc-500 ml-4">Actual:</span> <span className="text-zinc-300">{tc.actual}</span>
                                    </>
                                  )}
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tc.passed ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                                  {tc.passed ? "PASS" : "FAIL"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Custom Warning Modal Overlay */}
      {activeWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-w-md w-full p-8 rounded-3xl border border-red-500/30 bg-zinc-900/90 shadow-[0_0_50px_rgba(239,68,68,0.2)] text-center space-y-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] bg-red-500/10 pointer-events-none" />

            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 text-red-400">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                Warning {activeWarningModal.warningIndex} of 3
              </span>
              <h3 className="text-2xl font-black text-white">{activeWarningModal.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {activeWarningModal.message}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-300 font-medium">
              Penalty: <span className="font-bold text-red-400">{activeWarningModal.penaltyText}</span> will be applied to your final score.
            </div>

            <button
              onClick={handleDismissWarning}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all hover:scale-[1.02] shadow-lg shadow-red-600/20 cursor-pointer"
            >
              Acknowledge & Resume Test
            </button>
          </motion.div>
        </div>
      )}

      {/* Floating Proctoring Webcam Widget */}
      {testStarted && !quizFinished && (
        <div className="hidden fixed bottom-6 right-6 z-40 w-48 aspect-[4/3] rounded-2xl overflow-hidden border border-red-500/20 bg-zinc-950/90 shadow-2xl shadow-red-950/20 flex flex-col p-1.5 space-y-1.5">
          <div className="relative flex-1 rounded-xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-cover scale-x-[-1]"
              playsInline
              muted
              autoPlay
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
            />
          </div>
          <div className="flex items-center justify-between px-2 py-1 text-[9px] font-bold tracking-wider uppercase border-t border-white/5 pt-1.5">
            <span className={`flex items-center gap-1 ${gazeStatus === "Focused" ? "text-teal-400" : "text-amber-400 animate-pulse"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${gazeStatus === "Focused" ? "bg-teal-400" : "bg-amber-400 animate-ping"}`} />
              {gazeStatus}
            </span>
            <span className="text-zinc-500 font-mono">
              Warns: {cheatWarnings}/3
            </span>
          </div>
        </div>
      )}

      {/* Floating AI Hint Chatbot */}
      {testStarted && !quizFinished && course?.chatbot_enabled && (
        <>
          {/* Chat Bubble Icon Button */}
          {!chatbotOpen && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setChatbotOpen(true)}
              className="fixed bottom-[180px] right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:from-violet-500 hover:to-fuchsia-500 transition-all flex items-center justify-center cursor-pointer border border-white/10"
              title="Get AI Hint"
            >
              <div className="relative">
                <Bot className="w-6 h-6 animate-pulse" />
                {maxHints - hintsUsed > 0 && (
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[9px] font-extrabold leading-none min-w-[16px] text-center border border-zinc-950">
                    {maxHints - hintsUsed}
                  </span>
                )}
              </div>
            </motion.button>
          )}

          {/* Expanded Chat Panel Overlay */}
          <AnimatePresence>
            {chatbotOpen && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="fixed bottom-6 right-[220px] z-40 w-80 sm:w-[350px] h-[450px] flex flex-col rounded-2xl border border-white/10 bg-zinc-950/95 backdrop-blur-md shadow-2xl text-white overflow-hidden shadow-[0_0_50px_rgba(139,92,246,0.15)] animate-fadeIn"
              >
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-violet-950/50 to-zinc-950 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-wide">AI Hint Mentor</h4>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Conceptual Helper</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setChatbotOpen(false)}
                    className="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer"
                    title="Minimize Chat"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                  {/* System Welcome Message */}
                  <div className="flex items-start gap-2.5 max-w-[85%] mr-auto">
                    <div className="w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                      <BrainCircuit className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div className="bg-zinc-900 border border-white/5 text-zinc-300 rounded-2xl rounded-tl-none px-3 py-2 text-xs leading-relaxed">
                      Hi! I am your AI Mentor. I can guide you conceptually on this challenge, analyze your code, or suggest edge cases.
                      <p className="mt-1 text-[10px] text-violet-400 font-bold">
                        ⚠️ Remember: I cannot output direct copy-pasteable solution code!
                      </p>
                    </div>
                  </div>

                  {/* Chat History Messages */}
                  {chatHistory.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2.5 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                        }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${msg.role === "user"
                            ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                            : "bg-zinc-900 border-white/10 text-zinc-400"
                          }`}
                      >
                        {msg.role === "user" ? (
                          <span className="text-[10px] font-bold">U</span>
                        ) : (
                          <BrainCircuit className="w-3.5 h-3.5 text-violet-400" />
                        )}
                      </div>
                      <div
                        className={`px-3 py-2 text-xs leading-relaxed rounded-2xl ${msg.role === "user"
                            ? "bg-violet-600/20 border border-violet-500/30 text-zinc-100 rounded-tr-none"
                            : "bg-zinc-900 border border-white/5 text-zinc-300 rounded-tl-none"
                          }`}
                      >
                        {renderMessageContent(msg.content)}
                      </div>
                    </div>
                  ))}

                  {/* Submitting/Loading State */}
                  {submittingHint && (
                    <div className="flex items-start gap-2.5 max-w-[85%] mr-auto animate-pulse">
                      <div className="w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                        <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                      </div>
                      <div className="bg-zinc-900 border border-white/5 text-zinc-400 rounded-2xl rounded-tl-none px-3 py-2 text-xs flex items-center gap-1.5">
                        Analyzing and formulating hint...
                      </div>
                    </div>
                  )}

                  {/* Anchor for Auto-scroll */}
                  <div ref={chatEndRef} />
                </div>

                {/* Footer Controls */}
                <div className="p-3 bg-zinc-950 border-t border-white/5 space-y-2">
                  <div className="flex justify-between items-center px-1 text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-zinc-500">Hint limit for challenge:</span>
                    <span className={hintsUsed >= maxHints ? "text-red-400" : "text-violet-400"}>
                      {hintsUsed} / {maxHints} USED
                    </span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendHint();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={hintQuery}
                      onChange={(e) => setHintQuery(e.target.value)}
                      disabled={hintsUsed >= maxHints || submittingHint}
                      placeholder={
                        hintsUsed >= maxHints
                          ? "No hints remaining"
                          : submittingHint
                            ? "Waiting for AI..."
                            : "e.g. How can I handle empty array input?"
                      }
                      className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 disabled:opacity-50 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={hintsUsed >= maxHints || submittingHint || !hintQuery.trim()}
                      className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <p className="text-[9px] text-center text-zinc-600 leading-none">
                    AI analyzes your current code workspace & logs to advise you conceptually.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
