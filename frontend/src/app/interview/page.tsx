"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  User, 
  BrainCircuit, 
  Video, 
  VideoOff, 
  Zap, 
  Eye, 
  Activity, 
  MessageSquare, 
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "../config";
import Link from "next/link";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

export default function InterviewPage() {
  const router = useRouter();
  
  const [context, setContext] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatHistoryRef = useRef<ChatMessage[]>([]);
  const [transcript, setTranscript] = useState("");

  // Phase 4 State
  const [isWebcamVisible, setIsWebcamVisible] = useState(true);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [scriptsError, setScriptsError] = useState(false);
  const [gazeStatus, setGazeStatus] = useState<"Focused" | "Looking Away">("Focused");
  const [stressStatus, setStressStatus] = useState<"Calm" | "Fidgety" | "Highly Fidgety">("Calm");
  
  // Phase 5 Pre-check States
  const [phase, setPhase] = useState<"instructions" | "precheck" | "interview">("instructions");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScreenShared, setIsScreenShared] = useState(false);
  const [isMicCameraGranted, setIsMicCameraGranted] = useState(false);
  const [violationWarning, setViolationWarning] = useState<{type: "fullscreen" | "screenshare", active: boolean}>({type: "fullscreen", active: false});
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [fillerCount, setFillerCount] = useState(0);
  const [lieAlerts, setLieAlerts] = useState<{ flagged: boolean; reason: string } | null>(null);
  
  // Analytics Telemetry Trackers
  const totalSecondsRef = useRef(0);
  const lookAwaySecondsRef = useRef(0);
  const fidgetySecondsRef = useRef(0);
  const gazeStatusRef = useRef<"Focused" | "Looking Away">("Focused");
  const stressStatusRef = useRef<"Calm" | "Fidgety" | "Highly Fidgety">("Calm");
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isConcludingRef = useRef(false);

  // Webcam & Tracking Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<any>(null);
  const faceMeshRef = useRef<any>(null);

  // Dynamic MediaPipe Scripts Loading
  useEffect(() => {
    let cameraScript: HTMLScriptElement | null = null;
    let faceMeshScript: HTMLScriptElement | null = null;

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

        setScriptsLoaded(true);
      } catch (err) {
        console.error("Failed to load tracking scripts:", err);
        setScriptsError(true);
      }
    };

    loadScripts();

    return () => {
      if (cameraScript && document.body.contains(cameraScript)) document.body.removeChild(cameraScript);
      if (faceMeshScript && document.body.contains(faceMeshScript)) document.body.removeChild(faceMeshScript);
    };
  }, []);

  // Initialize Speech Recognition & Synthesis
  useEffect(() => {
    // Check candidate session
    const session = localStorage.getItem("hiremind_user");
    if (!session) {
      router.push("/login?redirect=/interview");
      return;
    }
    const loggedUser = JSON.parse(session);

    // Clear previous roadmap progress since this is a new interview
    localStorage.removeItem("hiremind_completed_tasks");
    localStorage.removeItem("hiremind_roadmap_reward_claimed");
    localStorage.removeItem("hiremind_evaluation_result");

    // Load context from local storage
    const savedConfig = localStorage.getItem("hiremind_config");
    const savedContext = localStorage.getItem("hiremind_context");
    
    if (savedConfig && savedContext) {
      setContext({
        ...JSON.parse(savedConfig),
        extracted_context: JSON.parse(savedContext),
        current_difficulty: "Medium",
        user_id: loggedUser.id,
        username: loggedUser.username
      });
    } else {
      // Fallback for direct navigation
      setContext({
        interview_mode: "General",
        persona: "Friendly",
        extracted_context: { skills: ["React", "Python"], experience_level: "Mid" },
        current_difficulty: "Medium",
        user_id: loggedUser.id,
        username: loggedUser.username
      });
    }

    // Init Speech Recognition (Chrome/Edge)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        setTranscript(fullTranscript);
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }

    // Init Speech Synthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    
    // Auto-scroll chat
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (synthRef.current) synthRef.current.cancel();
    };
  }, [phase]); // Re-run effect when phase changes, but we'll gate inside

  // Real-Time Gaze & Stress Face Mesh Tracking
  useEffect(() => {
    if (!scriptsLoaded || typeof window === "undefined") return;

    const FaceMeshClass = (window as any).FaceMesh;
    const CameraClass = (window as any).Camera;
    
    if (!FaceMeshClass || !CameraClass) return;

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext("2d");
    if (!canvasCtx) return;

    let lastLandmarks: any[] = [];
    let movementHistory: number[] = [];

    const onResults = (results: any) => {
      canvasElement.width = videoElement.videoWidth || 320;
      canvasElement.height = videoElement.videoHeight || 240;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // Draw glowing face mesh matrix points (cooler cybersecurity tracker design)
        canvasCtx.fillStyle = "rgba(20, 184, 166, 0.4)"; 
        canvasCtx.strokeStyle = "rgba(20, 184, 166, 0.25)";
        canvasCtx.lineWidth = 0.5;

        // Draw structural connections (simplified mesh for faster rendering and high-tech look)
        for (let i = 0; i < landmarks.length; i += 6) {
          const pt = landmarks[i];
          const x = pt.x * canvasElement.width;
          const y = pt.y * canvasElement.height;
          canvasCtx.beginPath();
          canvasCtx.arc(x, y, 1.2, 0, 2 * Math.PI);
          canvasCtx.fill();

          // Connect nearby dots randomly to look like a neural net scan
          if (i > 0 && Math.random() > 0.85) {
            const prevPt = landmarks[i - 6];
            canvasCtx.beginPath();
            canvasCtx.moveTo(prevPt.x * canvasElement.width, prevPt.y * canvasElement.height);
            canvasCtx.lineTo(x, y);
            canvasCtx.stroke();
          }
        }

        // --- Gaze Tracking Calculation ---
        // Left eye corners: 33 (outer), 133 (inner)
        // Left iris center: 468
        if (landmarks[33] && landmarks[133] && landmarks[468]) {
          const outerCorner = landmarks[33];
          const innerCorner = landmarks[133];
          const iris = landmarks[468];

          const eyeWidth = Math.abs(outerCorner.x - innerCorner.x);
          const eyeCenterX = (outerCorner.x + innerCorner.x) / 2;
          const gazeOffset = Math.abs(iris.x - eyeCenterX) / (eyeWidth || 1);

          if (gazeOffset > 0.22) {
            setGazeStatus("Looking Away");
            gazeStatusRef.current = "Looking Away";
          } else {
            setGazeStatus("Focused");
            gazeStatusRef.current = "Focused";
          }
        }

        // --- Fidgeting/Nervousness Calculation ---
        // Nose tip: 4
        if (landmarks[4]) {
          const nose = landmarks[4];
          if (lastLandmarks.length > 0) {
            const prevNose = lastLandmarks[4];
            if (prevNose) {
              const dx = (nose.x - prevNose.x) * canvasElement.width;
              const dy = (nose.y - prevNose.y) * canvasElement.height;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              movementHistory.push(distance);
              if (movementHistory.length > 30) movementHistory.shift(); // ~1 sec buffer

              const avgMovement = movementHistory.reduce((a, b) => a + b, 0) / movementHistory.length;
              
              if (avgMovement > 2.5) {
                setStressStatus("Highly Fidgety");
                stressStatusRef.current = "Highly Fidgety";
              } else if (avgMovement > 0.9) {
                setStressStatus("Fidgety");
                stressStatusRef.current = "Fidgety";
              } else {
                setStressStatus("Calm");
                stressStatusRef.current = "Calm";
              }
            }
          }
          lastLandmarks = landmarks;
        }

      } else {
        setGazeStatus("Looking Away");
      }
      canvasCtx.restore();
    };

    const faceMesh = new FaceMeshClass({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onResults);
    faceMeshRef.current = faceMesh;

    const camera = new CameraClass(videoElement, {
      onFrame: async () => {
        if (videoElement) {
          await faceMesh.send({ image: videoElement });
        }
      },
      width: 320,
      height: 240
    });
    
    camera.start();
    cameraRef.current = camera;

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
      setGazeStatus("Focused");
      setStressStatus("Calm");
    };
  }, [scriptsLoaded, phase]);
  
  // Telemetry Timer for Deductions
  useEffect(() => {
    const timer = setInterval(() => {
      totalSecondsRef.current += 1;
      if (gazeStatusRef.current === "Looking Away") lookAwaySecondsRef.current += 1;
      if (stressStatusRef.current === "Highly Fidgety") fidgetySecondsRef.current += 1;
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);
  
  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Initial greeting
  useEffect(() => {
    if (phase === "interview" && context && chatHistory.length === 0) {
      const greeting = `Hello! I'm your ${context.persona} AI interviewer for today's ${context.interview_mode} interview. I've reviewed your resume. Are you ready to begin?`;
      const initialChat = [{ role: "ai", content: greeting } as ChatMessage];
      setChatHistory(initialChat);
      chatHistoryRef.current = initialChat;
      speakText(greeting);
    }
  }, [context, phase]);

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    let preferredVoice = voices.find(v => v.lang === "en-US" && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Microsoft")));
    if (!preferredVoice) {
      preferredVoice = voices.find(v => v.lang === "en-US");
    }
    if (preferredVoice) utterance.voice = preferredVoice;
    
    if (context?.persona === "Friendly") {
      utterance.pitch = 1.1;
      utterance.rate = 1.0;
    } else if (context?.persona === "Strict") {
      utterance.pitch = 0.9;
      utterance.rate = 0.95;
    } else if (context?.persona === "Fast-paced") {
      utterance.pitch = 1.0;
      utterance.rate = 1.2;
    }
    
    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = () => {
      setIsAiSpeaking(false);
      setTranscript("");
      if (isConcludingRef.current) {
        setTimeout(() => endInterview(), 3000);
      } else {
        try {
          recognitionRef.current?.start();
          setIsListening(true);
        } catch (e) {
          console.error(e);
        }
      }
    };
    
    synthRef.current.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      handleUserSubmit();
    } else {
      if (synthRef.current) synthRef.current.cancel();
      setIsAiSpeaking(false);
      
      setTranscript("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleUserSubmit = async () => {
    if (!transcript.trim()) return;
    
    const userText = transcript.trim();
    setTranscript("");
    
    const newChatHistory = [...chatHistoryRef.current, { role: "user", content: userText } as ChatMessage];
    setChatHistory(newChatHistory);
    chatHistoryRef.current = newChatHistory;
    
    const userMessageCount = newChatHistory.filter(msg => msg.role === "user").length;
    // Exclude the initial greeting ("Are you ready?") from the question limit
    const actualQuestionCount = Math.max(0, userMessageCount - 1);
    const limit = context?.question_limit || 10;
    const isFinal = actualQuestionCount >= limit;
    
    if (isFinal) {
      isConcludingRef.current = true;
    }
    
    setIsAiThinking(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/interview/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { ...context, is_final_turn: isFinal },
          chat_history: chatHistory.map(msg => ({ [msg.role]: msg.content })),
          latest_user_response: userText
        }),
      });
      
      const result = await response.json();
      
      if (result.status === "success") {
        const aiText = result.data.ai_response;
        
        const finalHistory = [...chatHistoryRef.current, { role: "ai", content: aiText } as ChatMessage];
        setChatHistory(finalHistory);
        chatHistoryRef.current = finalHistory;
        
        speakText(aiText);

        // Update Phase 4 Live metrics
        if (result.data.adaptive_metrics) {
          const newDiff = result.data.adaptive_metrics.difficulty;
          setDifficulty(newDiff);
          setContext((prev: any) => ({ ...prev, current_difficulty: newDiff }));
        }
        if (result.data.confidence_analysis) {
          setFillerCount(prev => prev + (result.data.confidence_analysis.filler_count || 0));
        }
        if (result.data.lie_detector && result.data.lie_detector.flagged) {
          setLieAlerts({
            flagged: true,
            reason: result.data.lie_detector.reason
          });
        } else {
          setLieAlerts(null);
        }
      }
    } catch (error) {
      console.error("Error communicating with AI:", error);
      const errorMsg = "Sorry, I lost connection to my server. Let's try that again.";
      const errorHistory = [...chatHistoryRef.current, { role: "ai", content: errorMsg } as ChatMessage];
      setChatHistory(errorHistory);
      chatHistoryRef.current = errorHistory;
      speakText(errorMsg);
    } finally {
      setIsAiThinking(false);
    }
  };

  const endInterview = () => {
    if (synthRef.current) synthRef.current.cancel();
    if (recognitionRef.current) recognitionRef.current.stop();
    localStorage.setItem("hiremind_chat_history", JSON.stringify(chatHistoryRef.current));
    
    // Save Telemetry for Gamification Deductions
    localStorage.setItem("hiremind_interview_metrics", JSON.stringify({
      totalSeconds: totalSecondsRef.current,
      lookAwaySeconds: lookAwaySecondsRef.current,
      fidgetySeconds: fidgetySecondsRef.current,
      fillerCount,
      lieFlagged: lieAlerts ? lieAlerts.flagged : false
    }));
    
    router.push("/results");
  };

  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.error("Fullscreen request failed", err);
    }
  };

  const requestScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      setIsScreenShared(true);
      
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenShared(false);
        if (phase === "interview") {
          setViolationWarning({ type: "screenshare", active: true });
        }
      };
    } catch (err) {
      console.error("Screen share request failed", err);
    }
  };

  const requestMicCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setIsMicCameraGranted(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Mic/Camera request failed", err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        if (phase === "interview") {
          setViolationWarning({ type: "fullscreen", active: true });
        }
      } else {
        setIsFullscreen(true);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [phase]);

  const resolveViolation = async () => {
    if (violationWarning.type === "fullscreen") {
      await requestFullscreen();
      if (document.fullscreenElement) {
        setViolationWarning({ ...violationWarning, active: false });
      }
    } else if (violationWarning.type === "screenshare") {
      await requestScreenShare();
      if (screenStreamRef.current && screenStreamRef.current.active) {
        setViolationWarning({ ...violationWarning, active: false });
      }
    }
  };

  if (phase === "instructions") {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-background p-6">
        <div className="max-w-2xl w-full glass-card p-10 rounded-[2rem] border border-white/10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-primary-500/10 blur-[100px] rounded-full pointer-events-none" />
          <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-[0.15em] flex items-center gap-3">
            <AlertTriangle className="text-amber-400 w-7 h-7" /> Interview Rules
          </h2>
          <div className="space-y-6 text-zinc-300 text-sm font-medium leading-relaxed">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 font-bold">1</div>
              <p className="mt-1">The interview is strictly conducted in <span className="text-white font-bold">Fullscreen mode</span>. Exiting fullscreen will flag a security violation and instantly pause the interview.</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 font-bold">2</div>
              <p className="mt-1">You must share your <span className="text-white font-bold">Entire Screen</span>. We actively monitor the feed to ensure no cheating tools are used. Stopping the stream will pause the interview.</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 font-bold">3</div>
              <p className="mt-1">AI <span className="text-white font-bold">Eye-tracking and Posture</span> algorithms are active. Looking away or fidgeting excessively will result in heavy XP deductions.</p>
            </div>
          </div>
          <button 
            onClick={() => setPhase("precheck")}
            className="mt-10 w-full py-4 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:opacity-90 hover:scale-[1.02] transition-all cursor-pointer"
          >
            I Understand the Rules
          </button>
        </div>
      </div>
    );
  }

  if (phase === "precheck") {
    const allPassed = isFullscreen && isScreenShared && isMicCameraGranted;
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-background p-6">
        <div className="max-w-md w-full glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col gap-5 shadow-2xl">
          <div className="absolute top-[-20%] left-[-10%] w-[300px] h-[300px] bg-secondary-500/10 blur-[100px] rounded-full pointer-events-none" />
          <h2 className="text-xl font-black text-white text-center mb-4 uppercase tracking-[0.1em]">System Pre-Checks</h2>
          
          <div className={`flex items-center justify-between p-4 rounded-xl transition-colors ${isScreenShared ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-zinc-950/50 border border-white/5"}`}>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">1. Screen Share</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Select "Entire Screen"</span>
            </div>
            {isScreenShared ? (
              <CheckCircle2 className="text-emerald-400 w-5 h-5" />
            ) : (
              <button onClick={requestScreenShare} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200 cursor-pointer transition-colors">Share</button>
            )}
          </div>

          <div className={`flex items-center justify-between p-4 rounded-xl transition-all ${isFullscreen ? "bg-emerald-500/10 border border-emerald-500/20" : isScreenShared ? "bg-zinc-950/50 border border-white/5" : "opacity-30 pointer-events-none bg-zinc-950/50 border border-white/5"}`}>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">2. Fullscreen Access</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Focus environment</span>
            </div>
            {isFullscreen ? (
              <CheckCircle2 className="text-emerald-400 w-5 h-5" />
            ) : (
              <button onClick={requestFullscreen} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200 cursor-pointer transition-colors">Grant</button>
            )}
          </div>
          
          <div className={`flex items-center justify-between p-4 rounded-xl transition-all ${isMicCameraGranted ? "bg-emerald-500/10 border border-emerald-500/20" : isFullscreen ? "bg-zinc-950/50 border border-white/5" : "opacity-30 pointer-events-none bg-zinc-950/50 border border-white/5"}`}>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">3. Mic & Camera</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">AI Interaction</span>
            </div>
            {isMicCameraGranted ? (
              <CheckCircle2 className="text-emerald-400 w-5 h-5" />
            ) : (
              <button onClick={requestMicCamera} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200 cursor-pointer transition-colors">Allow</button>
            )}
          </div>

          <button 
            onClick={() => setPhase("interview")}
            disabled={!allPassed}
            className={`mt-6 w-full py-4 rounded-xl font-black uppercase tracking-[0.2em] transition-all ${allPassed ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:opacity-90 cursor-pointer transform hover:scale-[1.02]" : "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"}`}
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden relative">
      
      {/* Violation Modal */}
      <AnimatePresence>
        {violationWarning.active && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full bg-zinc-950 border border-red-500/30 p-8 rounded-3xl text-center shadow-[0_0_80px_rgba(239,68,68,0.2)]"
            >
              <div className="w-20 h-20 mx-auto bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="text-red-500 w-10 h-10 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-white mb-3">Security Violation</h2>
              <p className="text-zinc-400 text-sm mb-8 leading-relaxed font-medium">
                {violationWarning.type === "fullscreen" 
                  ? "You exited fullscreen mode. This is a strict violation of the interview rules. The interview is paused until you return to fullscreen."
                  : "You stopped sharing your screen. This is a strict violation of the interview rules. The interview is paused until you re-share your entire screen."
                }
              </p>
              <button 
                onClick={resolveViolation}
                className="w-full py-3.5 rounded-xl bg-red-500 text-white font-black uppercase tracking-widest hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              >
                {violationWarning.type === "fullscreen" ? "Return to Fullscreen" : "Re-share Screen"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="w-full p-6 flex justify-between items-center z-10 glass-panel border-b border-white/5">
        <div>
          <Link href="/" className="text-xl font-bold text-white flex items-center gap-2 hover:opacity-80 transition-opacity">
            HireMind
          </Link>
          <p className="text-xs text-zinc-400 mt-1">
            {context?.interview_mode} • {context?.persona} Persona
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Webcam Control Button */}
          <button
            onClick={() => setIsWebcamVisible(prev => !prev)}
            disabled={scriptsError}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-semibold ${
              isWebcamVisible 
                ? "bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-[0_0_15px_rgba(20,184,166,0.1)] hover:bg-teal-500/20" 
                : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
            }`}
          >
            {isWebcamVisible ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
            {isWebcamVisible ? "Minimize Webcam" : "Expand Webcam"}
          </button>

          <button 
            onClick={endInterview}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium border border-red-500/20"
          >
            <PhoneOff className="w-4 h-4" /> End Interview
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row p-6 gap-6 z-10 h-full overflow-hidden max-w-7xl mx-auto w-full">
        
        {/* Left: AI Visualizer, WebCam HUD, and Analytics Telemetry */}
        <div className="flex-1 flex flex-col items-center justify-between glass-card rounded-2xl relative p-6 overflow-y-auto scrollbar-thin">
          
          <div className="w-full flex-1 flex flex-col items-center justify-center">
            
            {/* Dynamic Two-Column Layout for Orb vs Webcam */}
            <div className={`w-full flex flex-col lg:flex-row items-center justify-center gap-8 transition-all duration-500 ${isWebcamVisible ? "lg:items-stretch" : ""}`}>
              
              {/* Central AI Orb */}
              <div className={`flex flex-col items-center justify-center transition-all duration-500 ${isWebcamVisible ? "lg:w-1/2" : "w-full"}`}>
                <div className={`relative flex items-center justify-center mb-6 transition-all ${isWebcamVisible ? "w-48 h-48" : "w-60 h-60"}`}>
                  <div 
                    className={`absolute inset-0 rounded-full border-2 ${
                      isListening ? "border-green-500 opacity-20" : "border-primary-500 opacity-20"
                    } ${isAiSpeaking || isListening ? 'animate-ping' : ''}`}
                    style={{ animationDuration: '3s' }}
                  />
                  <div 
                    className={`absolute inset-[-15px] rounded-full border border-dashed ${
                      isListening ? "border-green-500 opacity-10" : "border-primary-500 opacity-10"
                    } ${isAiSpeaking || isListening ? 'animate-pulse' : ''}`}
                    style={{ animationDuration: '2s' }}
                  />
                  <div className={`rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-500 overflow-hidden ${
                    isWebcamVisible ? "w-28 h-28" : "w-32 h-32"
                  } ${
                    isListening ? "bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/50" : 
                    isAiThinking ? "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/50" :
                    "bg-gradient-to-br from-primary-400 to-primary-600 shadow-primary-500/50"
                  }`}>
                    <img src="/logo.png" alt="HireMind" className="w-14 h-14 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  onClick={toggleListening}
                  className={`group relative flex items-center justify-center w-16 h-16 rounded-full shadow-lg transition-all transform hover:scale-105 ${
                    isListening 
                      ? "bg-red-500 hover:bg-red-400 shadow-red-500/30" 
                      : "bg-white hover:bg-zinc-200 text-black shadow-white/10"
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-6 h-6 text-white" />
                  ) : (
                    <Mic className="w-6 h-6 text-black" />
                  )}
                  <div className="absolute -bottom-8 whitespace-nowrap text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isListening ? "Click to send" : "Click to speak"}
                  </div>
                </button>

                <div className="mt-8 text-center h-8">
                  <AnimatePresence mode="wait">
                    {isListening && (
                      <motion.p 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-green-400 text-sm font-medium"
                      >
                        Listening...
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Webcam Tracking HUD */}
              <div className={`${isWebcamVisible ? "lg:w-1/2 flex relative" : "absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"} flex-col justify-center items-center`}>
                <div className="relative w-full max-w-sm aspect-[4/3] rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-inner">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover scale-x-[-1]" 
                      playsInline
                      muted
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
                    />
                    
                    {/* Real-time Status Overlay */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
                      <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold backdrop-blur-md border flex items-center gap-1.5 ${
                        gazeStatus === "Focused"
                          ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${gazeStatus === "Focused" ? "bg-teal-400" : "bg-amber-400 animate-ping"}`} />
                        GAZE: {gazeStatus}
                      </div>
                      <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold backdrop-blur-md border flex items-center gap-1.5 ${
                        stressStatus === "Calm"
                          ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
                          : stressStatus === "Fidgety"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stressStatus === "Calm" ? "bg-teal-400" : stressStatus === "Fidgety" ? "bg-amber-400" : "bg-red-400 animate-ping"}`} />
                        STRESS: {stressStatus}
                      </div>
                    </div>
                  </div>
                </div>

            </div>

          </div>

          {/* Telemetry HUD Panel */}
          <div className="w-full mt-6 pt-6 border-t border-white/5">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary-400" /> Interviewer Analytics console
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
              {/* Difficulty widget */}
              <div className="glass-panel p-3 border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Difficulty Level</span>
                <span className={`text-sm font-bold mt-1.5 flex items-center gap-1.5 ${
                  difficulty === "Easy" ? "text-green-400" : difficulty === "Hard" ? "text-orange-400" : "text-blue-400"
                }`}>
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  {difficulty}
                </span>
              </div>

              {/* Eye Gaze Gages */}
              <div className="glass-panel p-3 border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Gaze Focus</span>
                <span className={`text-sm font-bold mt-1.5 flex items-center gap-1.5 ${
                  gazeStatus === "Focused" ? "text-teal-400" : "text-amber-400 animate-pulse"
                }`}>
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  {gazeStatus}
                </span>
              </div>

              {/* Stress telemetry */}
              <div className="glass-panel p-3 border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Stress Telemetry</span>
                <span className={`text-sm font-bold mt-1.5 flex items-center gap-1.5 ${
                  stressStatus === "Calm" ? "text-teal-400" : stressStatus === "Fidgety" ? "text-amber-400" : "text-red-400"
                }`}>
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  {stressStatus}
                </span>
              </div>

              {/* Filler words badge */}
              <div className="glass-panel p-3 border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Filler Words</span>
                <span className="text-sm font-bold mt-1.5 text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                  {fillerCount} counted
                </span>
              </div>
            </div>

            {/* AI Lie Detector Warning Alert */}
            <AnimatePresence>
              {lieAlerts && lieAlerts.flagged && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: 10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: 10 }}
                  className="w-full mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 flex items-start gap-2.5 shadow-[0_0_15px_rgba(239,68,68,0.1)] overflow-hidden"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-extrabold text-red-400 uppercase tracking-widest text-[9px] mb-0.5">AI Resume Inconsistency Flagged</div>
                    <p className="leading-relaxed text-zinc-300">{lieAlerts.reason}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Right: Live Transcript */}
        <div className="w-full md:w-[360px] lg:w-[420px] flex flex-col glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5 font-medium flex items-center gap-2">
            <FileTextIcon /> Live Feed
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {chatHistory.map((msg, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: msg.role === "user" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                  msg.role === "user" ? "bg-zinc-800 text-zinc-400" : "bg-primary-500/20 text-primary-400"
                }`}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <img src="/logo.png" alt="AI" className="w-5 h-5 object-contain" />}
                </div>
                <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user" 
                    ? "bg-zinc-800 text-zinc-200 rounded-tr-sm" 
                    : "bg-primary-500/10 border border-primary-500/20 text-zinc-300 rounded-tl-sm"
                }`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            
            {/* Live active transcript */}
            {transcript && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-zinc-800 text-green-400">
                  <User className="w-4 h-4" />
                </div>
                <div className="p-3 rounded-2xl text-sm leading-relaxed bg-zinc-800 text-zinc-400 rounded-tr-sm italic border border-green-500/20">
                  {transcript}
                  <span className="inline-block w-1 h-4 ml-1 bg-green-500/50 animate-pulse align-middle" />
                </div>
              </motion.div>
            )}
            
            <div ref={chatEndRef} />
          </div>
          
          <div className="p-4 border-t border-white/5 bg-white/5">
             <p className="text-xs text-center text-amber-500 font-bold tracking-wide">
               Speak clearly into your microphone. The AI will respond automatically.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileTextIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
  )
}
