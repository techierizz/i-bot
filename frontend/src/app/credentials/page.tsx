"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Award, Zap, BadgeCheck, GraduationCap
} from "lucide-react";
import { API_BASE_URL } from "../config";

export default function CredentialsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [certs, setCerts] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("hiremind_user");
    if (!session) { router.push("/login?redirect=/credentials"); return; }
    const loggedUser = JSON.parse(session);
    setUser(loggedUser);

    Promise.all([
      fetch(`${API_BASE_URL}/api/learning/certificates/${loggedUser.id}`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/learning/skills/${loggedUser.id}`).then(r => r.json()),
    ]).then(([certList, skillList]) => {
      setCerts(certList);
      setSkills(skillList);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);



  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Loading credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-x-hidden">
      {/* Background ambient glows */}
      <div className="fixed top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] bg-violet-600/10 pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[150px] bg-fuchsia-600/8 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/learning")}
            className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-fuchsia-400" />
            <h1 className="text-lg font-bold text-white">Verified Credentials</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Verified Skills */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-emerald-400" />
              Verified Skills
            </h3>
            {skills.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-white/5 bg-zinc-900/20 text-zinc-500 text-sm">
                No verified skills yet. Go to the Learning Hub and pass a quiz to verify your first skill!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {skills.map(s => (
                  <div key={s.id} className="p-5 rounded-2xl border border-violet-500/20 bg-zinc-900/40 flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-base">{s.skill_name}</h4>
                      <p className="text-zinc-500 text-xs">Level: <span className="text-violet-300 font-semibold">{s.level}</span></p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                        {s.score}% Verified
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-1">Verified on {new Date(s.verified_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verified Certificates */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-fuchsia-400" />
              Verifiable Certifications
            </h3>
            {certs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-white/5 bg-zinc-900/20 text-zinc-500 text-sm">
                No certificates earned yet. Complete all lessons and score &gt;= 80% on a course quiz to earn a certificate.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {certs.map(c => (
                  <div key={c.certificate_id} className="relative p-8 rounded-3xl border border-white/10 bg-zinc-900/40 overflow-hidden flex flex-col md:flex-row justify-between gap-6">
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] bg-fuchsia-500/10 pointer-events-none" />
                    
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest">Verified Certificate</span>
                        <h4 className="text-2xl font-black text-white">{c.course_title}</h4>
                        <p className="text-zinc-400 text-sm">Issued to: <span className="text-white font-bold">{c.candidate_name}</span></p>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                        <div>
                          <span>Verification ID:</span>
                          <span className="text-zinc-300 font-mono block mt-0.5">{c.certificate_id}</span>
                        </div>
                        <div>
                          <span>Issue Date:</span>
                          <span className="text-zinc-300 block mt-0.5">{new Date(c.issue_date).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span>Difficulty:</span>
                          <span className="text-zinc-300 block mt-0.5">{c.difficulty}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between items-start md:items-end gap-4">
                      <div className="text-left md:text-right">
                        <span className="text-xs text-zinc-500 block">Verified By</span>
                        <span className="text-sm font-bold text-violet-300 flex items-center gap-1.5 justify-start md:justify-end mt-0.5">
                          <GraduationCap className="w-3.5 h-3.5" /> {c.mentor_name}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <a
                          href={`${API_BASE_URL}/api/learning/certificates/${c.certificate_id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-bold tracking-wider uppercase transition-all cursor-pointer hover:opacity-90 flex items-center gap-1.5 shadow-md shadow-violet-500/20"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
