"use client";

import { useState, useEffect } from "react";
import { User, LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function UserBox({ forceShow = false, className }: { forceShow?: boolean, className?: string }) {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleStorage = () => {
      const session = localStorage.getItem("hiremind_user");
      if (session) {
        setUser(JSON.parse(session));
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
  if (!forceShow && (pathname === "/" || pathname === "/interview" || pathname === "/results" || pathname === "/profile")) return null;

  return (
    <div className={className || "fixed top-6 right-6 z-50 flex items-center gap-3"}>
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
  );
}
