"use client";

import { useState, useEffect } from "react";
import { User, LogOut, Bell, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { API_BASE_URL } from "../app/config";

export default function UserBox({ forceShow = false, className }: { forceShow?: boolean, className?: string }) {
  const [user, setUser] = useState<any>(null);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [showBellModal, setShowBellModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleStorage = () => {
      const session = localStorage.getItem("hiremind_user");
      if (session) {
        const parsed = JSON.parse(session);
        setUser(parsed);
        fetch(`${API_BASE_URL}/api/roadmap/${parsed.id}`)
          .then(r => r.json())
          .then(data => {
            if (data.status === "success" && data.data) {
              const pending = data.data.filter((t: any) => !t.is_completed);
              setPendingTasksCount(pending.length);
              setTotalTasksCount(data.data.length);
            }
          })
          .catch(e => console.error(e));
      } else {
        setUser(null);
      }
    };
    handleStorage();
  }, [pathname]);

  const handleLogout = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem("hiremind_user");
    localStorage.removeItem("hiremind_admin");
    setUser(null);
    router.push("/");
  };

  if (!user) return null;
  // Hide on certain pages if not forced. (Removed "/" so it shows on landing page)
  if (!forceShow && (pathname === "/interview" || pathname === "/results" || pathname === "/profile" || pathname === "/validation" || pathname === "/resume" || pathname === "/action-plan")) {
    return null;
  }

  const isStartingPage = pathname === "/";

  return (
    <>
      <div className={className || "fixed top-6 right-6 z-50 flex items-center gap-3"}>
        {isStartingPage && (
          <button 
            onClick={() => setShowBellModal(true)}
            className="relative p-2 bg-zinc-900/80 backdrop-blur-md border border-amber-500/30 hover:border-amber-400 rounded-lg text-amber-500 hover:text-amber-400 hover:animate-[temple-bell_1.5s_ease-in-out_infinite] transition-all cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {pendingTasksCount > 0 && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
          </button>
        )}

        <button 
          onClick={() => router.push("/profile")}
          className="text-sm font-bold text-zinc-300 flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 hover:border-primary-500/50 hover:text-white transition-all cursor-pointer shadow-lg hover:shadow-primary-500/20"
        >
          <User className="w-4 h-4 text-primary-400" /> {user.username}
        </button>
        
        <button 
          onClick={handleLogout} 
          className="p-1.5 bg-zinc-900/80 backdrop-blur-md border border-white/10 hover:border-red-500/50 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition-all flex items-center justify-center cursor-pointer shadow-lg"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {showBellModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowBellModal(false)}
              className="absolute top-3 right-3 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-500/20">
              <Bell className="w-8 h-8 text-amber-500 animate-[temple-bell_1.5s_ease-in-out_infinite]" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Action Plan</h3>
            <p className="text-zinc-300 font-medium">
              {totalTasksCount === 0 
                ? "You are all caught up!!" 
                : pendingTasksCount > 0 
                  ? "You have pending tasks in your action plan." 
                  : "You have completed your all tasks of your action plan"}
            </p>
            <button
              onClick={() => {
                setShowBellModal(false);
                if (pendingTasksCount > 0) router.push("/action-plan");
              }}
              className="mt-6 w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 font-semibold rounded-xl transition-colors border border-amber-500/30"
            >
              {pendingTasksCount > 0 ? "View Action Plan" : "Close"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
