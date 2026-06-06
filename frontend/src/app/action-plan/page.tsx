"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, Circle, Loader2, Target, Trophy, ChevronRight, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "../config";

interface Task {
  id: number;
  task_text: string;
  is_completed: boolean;
  created_at: string;
}

export default function ActionPlan() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Animation state for XP popup
  const [xpPopup, setXpPopup] = useState<{ id: number, message: string } | null>(null);

  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) {
      router.push("/login?redirect=/action-plan");
      return;
    }
    const parsedUser = JSON.parse(session);
    setUser(parsedUser);

    fetchTasks(parsedUser.id);
  }, [router]);

  const fetchTasks = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/roadmap/${userId}`);
      const data = await res.json();
      if (data.status === "success") {
        setTasks(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    if (!user) return;
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: true } : t));
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/roadmap/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id })
      });
      const data = await res.json();
      
      if (data.status === "success") {
        // Show XP Gamification Popup
        setXpPopup({ id: taskId, message: `+50 XP` });
        setTimeout(() => setXpPopup(null), 2000);
      } else {
        // Revert on error
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: false } : t));
      }
    } catch (e) {
      console.error(e);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: false } : t));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12 relative overflow-hidden">
      <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 relative z-10 cursor-pointer">
        <ArrowLeft className="w-4 h-4" />
        Close Action Plan
      </button>

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 mb-2">
              Action Plan
            </h1>
            <p className="text-zinc-400 text-lg">
              Complete your personalized roadmap tasks to earn XP and level up.
            </p>
          </div>
          <div className="px-5 py-3 bg-primary-600/10 border border-primary-500/20 rounded-2xl flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary-400" />
            <div>
              <p className="text-xs text-primary-400 font-medium uppercase tracking-wider">Reward</p>
              <p className="text-sm font-semibold">+50 XP per task</p>
            </div>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="relative group overflow-hidden bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-16 text-center shadow-2xl flex flex-col items-center justify-center min-h-[400px]">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-150" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary-500/10 rounded-full blur-[100px] -ml-32 -mb-32 transition-transform duration-1000 group-hover:scale-150" />
            
            <div className="relative z-10 space-y-6">
              <h3 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 tracking-tight">
                No active tasks
              </h3>
              <p className="text-lg text-zinc-500 max-w-lg mx-auto leading-relaxed">
                You're all caught up! When you complete an interview, your personalized roadmap tasks will appear here to help you level up your skills.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* Pending Tasks */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary-400" />
                Up Next ({pendingTasks.length})
              </h2>
              
              <div className="grid gap-3">
                <AnimatePresence>
                  {pendingTasks.map((task) => (
                    <motion.div 
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group bg-zinc-900/40 hover:bg-zinc-800/60 backdrop-blur-xl border border-white/5 hover:border-primary-500/30 rounded-3xl p-6 flex items-center gap-6 transition-all duration-300 relative shadow-lg hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]"
                    >
                      <button 
                        onClick={() => handleCompleteTask(task.id)}
                        className="w-8 h-8 rounded-full border-2 border-zinc-600 hover:border-primary-400 hover:bg-primary-500/10 flex items-center justify-center transition-all shrink-0 shadow-inner"
                      >
                        {/* Hover check state */}
                        <Check className="w-4 h-4 text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      
                      <p className="text-zinc-200 text-lg font-medium leading-relaxed tracking-wide">{task.task_text}</p>
                      
                      {/* XP Popup Animation */}
                      <AnimatePresence>
                        {xpPopup?.id === task.id && (
                          <motion.div
                            initial={{ opacity: 0, y: 0, scale: 0.8 }}
                            animate={{ opacity: 1, y: -30, scale: 1.1 }}
                            exit={{ opacity: 0 }}
                            className="absolute left-8 -top-2 text-emerald-400 font-bold text-lg drop-shadow-md z-50 pointer-events-none flex items-center gap-1"
                          >
                            <Trophy className="w-4 h-4" /> {xpPopup.message}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {pendingTasks.length === 0 && (
                  <div className="p-6 border border-dashed border-white/10 rounded-2xl text-center text-zinc-500">
                    You're all caught up! Time for another interview.
                  </div>
                )}
              </div>
            </div>

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-4 opacity-60">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-zinc-400">
                  <CheckCircle className="w-5 h-5" />
                  Completed ({completedTasks.length})
                </h2>
                
                <div className="grid gap-2">
                  {completedTasks.map((task) => (
                    <div key={task.id} className="bg-zinc-900/20 rounded-xl p-3 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      <p className="text-zinc-500 text-sm line-through">{task.task_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}
