import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib
import uuid
import json
import os
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# Fallback to local SQLite connection string logic if no Postgres DB is provided (useful for switching back)
# But since we are full Postgres now:
DB_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    if not DB_URL:
        raise Exception("DATABASE_URL environment variable is not set. Please set it in your .env file.")
    conn = psycopg2.connect(DB_URL)
    return conn

def hash_password(password: str) -> str:
    salt = uuid.uuid4().hex
    return hashlib.sha256(salt.encode() + password.encode()).hexdigest() + ":" + salt

def verify_password(password: str, hashed_password: str) -> bool:
    try:
        password_hash, salt = hashed_password.split(":")
        return hashlib.sha256(salt.encode() + password.encode()).hexdigest() == password_hash
    except Exception:
        return False

def init_db():
    if not DB_URL:
        print("[!] Warning: DATABASE_URL not set. Skipping DB initialization.")
        return

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'candidate'
    )
    """)
    
    # Create evaluations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        mode TEXT NOT NULL,
        overall INTEGER NOT NULL,
        technical INTEGER NOT NULL,
        communication INTEGER NOT NULL,
        confidence INTEGER NOT NULL,
        problem_solving INTEGER NOT NULL,
        transcript TEXT NOT NULL,
        evaluation_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    
    # Create user_gamification table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_gamification (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        total_xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        rank_title TEXT NOT NULL DEFAULT 'Recruit',
        badges TEXT NOT NULL DEFAULT '[]',
        streak INTEGER NOT NULL DEFAULT 0,
        last_session DATE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    
    # Create system settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)
    
    # Add fraud columns to users if they don't exist
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN fraud_strikes INTEGER DEFAULT 0")
        conn.commit()
    except psycopg2.errors.DuplicateColumn:
        conn.rollback()

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN is_fraudulent BOOLEAN DEFAULT FALSE")
        conn.commit()
    except psycopg2.errors.DuplicateColumn:
        conn.rollback()

    # Create user_experiences table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_experiences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        verification_status TEXT DEFAULT 'Pending',
        certificate_url TEXT,
        fraud_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
    
    # Create user_resumes table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_resumes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        raw_text TEXT NOT NULL,
        ats_feedback_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    conn.commit()

    # Create roadmap_tasks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS roadmap_tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        eval_id INTEGER,
        task_text TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (eval_id) REFERENCES evaluations (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
    
    # Seed default settings if empty
    cursor.execute("SELECT COUNT(*) as count FROM system_settings")
    if cursor.fetchone()["count"] == 0:
        cursor.execute("INSERT INTO system_settings (key, value) VALUES ('prompt_temp', '0.7')")
        cursor.execute("INSERT INTO system_settings (key, value) VALUES ('system_prompt', '')")
    
    # Seed or synchronize administrator credentials from environment
    admins = []
    
    env_usernames = os.getenv("ADMIN_USERNAMES")
    env_passwords = os.getenv("ADMIN_PASSWORDS")
    
    if env_usernames and env_passwords:
        usernames = [u.strip() for u in env_usernames.split(",") if u.strip()]
        passwords = [p.strip() for p in env_passwords.split(",") if p.strip()]
        for u, p in zip(usernames, passwords):
            admins.append({"username": u, "password": p, "email": f"{u}@hiremind.ai"})
            
    single_user = os.getenv("ADMIN_USERNAME", "admin")
    single_pass = os.getenv("ADMIN_PASSWORD", "admin123")
    if not any(a["username"] == single_user for a in admins):
        admins.append({"username": single_user, "password": single_pass, "email": "admin@hiremind.ai"})
        
    for admin in admins:
        u = admin["username"]
        p = admin["password"]
        e = admin["email"]
        
        cursor.execute("SELECT id, role FROM users WHERE username = %s", (u,))
        row = cursor.fetchone()
        
        hashed = hash_password(p)
        if row is None:
            cursor.execute(
                "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)",
                (u, e, hashed, "admin")
            )
            print(f"[*] Admin user initialized. Username: {u}")
        else:
            cursor.execute(
                "UPDATE users SET password_hash = %s, email = %s, role = 'admin' WHERE id = %s",
                (hashed, e, row["id"])
            )
            print(f"[*] Admin user synchronized. Username: {u}")
        
    conn.commit()
    conn.close()

def create_user(username: str, email: str, password: str, role: str = "candidate") -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        hashed = hash_password(password)
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s) RETURNING id",
            (username, email, hashed, role)
        )
        user_id = cursor.fetchone()["id"]
        conn.commit()
        return {"status": "success", "user": {"id": user_id, "username": username, "email": email, "role": role}}
    except psycopg2.IntegrityError:
        conn.rollback()
        return {"status": "error", "message": "Username already exists."}
    finally:
        conn.close()

def authenticate_user(username: str, password: str, role: str = "candidate") -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT id, username, email, password_hash, role, signature_data FROM users WHERE username = %s AND role = %s", (username, role))
    user_row = cursor.fetchone()
    conn.close()
    
    if user_row and verify_password(password, user_row["password_hash"]):
        return {
            "id": user_row["id"],
            "username": user_row["username"],
            "email": user_row["email"],
            "role": user_row["role"],
            "signature_data": user_row.get("signature_data")
        }
    return None

def update_signature(user_id: int, signature_data: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE users SET signature_data = %s WHERE id = %s", (signature_data, user_id))
        updated = cursor.rowcount > 0
        conn.commit()
        return updated
    except Exception as e:
        conn.rollback()
        print(f"Error updating signature: {e}")
        return False
    finally:
        conn.close()

def _enforce_rolling_window(cursor, user_id: int):
    cursor.execute("SELECT id, overall, evaluation_data FROM evaluations WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
    evals = cursor.fetchall()
    
    if len(evals) <= 10:
        return
        
    best_idx = 0
    best_score = -1
    best_xp = -1
    best_badges = -1
    
    for i, e in enumerate(evals):
        score = e["overall"] or 0
        ed = json.loads(e["evaluation_data"]) if isinstance(e["evaluation_data"], str) else (e["evaluation_data"] or {})
        xp = ed.get("xp_earned", 0)
        badges = len(ed.get("achievements", []))
        
        is_better = False
        if score > best_score:
            is_better = True
        elif score == best_score:
            if xp > best_xp:
                is_better = True
            elif xp == best_xp:
                if badges > best_badges:
                    is_better = True
                    
        if is_better:
            best_score = score
            best_xp = xp
            best_badges = badges
            best_idx = i
            
    best_eval_id = evals[best_idx]["id"]
    ids_to_keep = set([e["id"] for e in evals[:10]])
    ids_to_keep.add(best_eval_id)
    
    ids_to_delete = [e["id"] for e in evals if e["id"] not in ids_to_keep]
    if ids_to_delete:
        cursor.execute("DELETE FROM evaluations WHERE id = ANY(%s)", (ids_to_delete,))

def get_performance_insights(user_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT * FROM evaluations WHERE user_id = %s ORDER BY created_at ASC", (user_id,))
    evals = cursor.fetchall()
    conn.close()
    
    if not evals:
        return None
        
    best_e = None
    worst_e = None
    best_score = -1
    worst_score = float('inf')
    
    total_tech = 0
    total_comm = 0
    total_conf = 0
    total_prob = 0
    
    for e in evals:
        score = e["overall"] or 0
        ed = json.loads(e["evaluation_data"]) if isinstance(e["evaluation_data"], str) else (e["evaluation_data"] or {})
        xp = ed.get("xp_earned", 0)
        badges = len(ed.get("achievements", []))
        
        # Best evaluation
        is_better = False
        if score > best_score:
            is_better = True
        elif score == best_score:
            if best_e:
                best_ed = json.loads(best_e["evaluation_data"]) if isinstance(best_e["evaluation_data"], str) else (best_e["evaluation_data"] or {})
                if xp > best_ed.get("xp_earned", 0):
                    is_better = True
        if is_better:
            best_score = score
            best_e = e

        # Worst evaluation
        if score < worst_score:
            worst_score = score
            worst_e = e
            
        total_tech += (e.get("technical") or 0)
        total_comm += (e.get("communication") or 0)
        total_conf += (e.get("confidence") or 0)
        total_prob += (e.get("problem_solving") or 0)

    n = len(evals)
    avgs = {
        "Technical Mastery": total_tech / n,
        "Communication": total_comm / n,
        "Confidence": total_conf / n,
        "Problem Solving": total_prob / n,
    }
    
    weakest_category = min(avgs, key=avgs.get)
    
    first_e = evals[0]
    last_e = evals[-1]
    
    growth_areas = {
        "Overall": (last_e["overall"] or 0) - (first_e["overall"] or 0),
        "Technical": (last_e.get("technical") or 0) - (first_e.get("technical") or 0),
        "Communication": (last_e.get("communication") or 0) - (first_e.get("communication") or 0),
        "Confidence": (last_e.get("confidence") or 0) - (first_e.get("confidence") or 0),
        "Problem Solving": (last_e.get("problem_solving") or 0) - (first_e.get("problem_solving") or 0),
    }
    
    best_growth_cat = max(growth_areas, key=growth_areas.get)
    
    return {
        "best_interview": best_e,
        "worst_interview": worst_e,
        "weakest_link": {
            "category": weakest_category,
            "average": round(avgs[weakest_category])
        },
        "growth": {
            "category": best_growth_cat,
            "value": growth_areas[best_growth_cat]
        },
        "total_interviews": n
    }

def save_evaluation(
    user_id: int,
    username: str,
    mode: str,
    overall: int,
    technical: int,
    communication: int,
    confidence: int,
    problem_solving: int,
    transcript: List[Dict[str, Any]],
    evaluation_data: Dict[str, Any]
) -> int:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    transcript_str = json.dumps(transcript)
    evaluation_str = json.dumps(evaluation_data)
    
    cursor.execute(
        """
        INSERT INTO evaluations (
            user_id, username, mode, overall, technical, communication, confidence, problem_solving, transcript, evaluation_data
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (
            user_id, username, mode, overall, technical, communication, confidence, problem_solving,
            transcript_str, evaluation_str
        )
    )
    eval_id = cursor.fetchone()["id"]
    
    # Enforce rolling window keeping best interview
    _enforce_rolling_window(cursor, user_id)
    
    conn.commit()
    conn.close()
    return eval_id

def get_admin_metrics() -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT COUNT(*) as count FROM evaluations")
    total_interviews = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(DISTINCT user_id) as count FROM evaluations")
    total_candidates = cursor.fetchone()["count"]
    
    cursor.execute("""
        SELECT 
            AVG(overall) as avg_overall,
            AVG(technical) as avg_technical,
            AVG(communication) as avg_communication,
            AVG(confidence) as avg_confidence,
            AVG(problem_solving) as avg_problem_solving
        FROM evaluations
    """)
    avg_row = cursor.fetchone()
    
    conn.close()
    
    return {
        "total_interviews": total_interviews,
        "total_candidates": total_candidates,
        "averages": {
            "overall": round(float(avg_row["avg_overall"] or 0), 1),
            "technical": round(float(avg_row["avg_technical"] or 0), 1),
            "communication": round(float(avg_row["avg_communication"] or 0), 1),
            "confidence": round(float(avg_row["avg_confidence"] or 0), 1),
            "problem_solving": round(float(avg_row["avg_problem_solving"] or 0), 1),
        }
    }

def get_all_evaluations() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        SELECT id, user_id, username, mode, overall, technical, communication, confidence, problem_solving, transcript, evaluation_data, created_at
        FROM evaluations
        ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    evals = []
    for r in rows:
        try:
            trans = json.loads(r["transcript"])
        except Exception:
            trans = []
            
        try:
            eval_data = json.loads(r["evaluation_data"])
        except Exception:
            eval_data = {}
            
        evals.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "username": r["username"],
            "mode": r["mode"],
            "overall": r["overall"],
            "technical": r["technical"],
            "communication": r["communication"],
            "confidence": r["confidence"],
            "problem_solving": r["problem_solving"],
            "transcript": trans,
            "evaluation_data": eval_data,
            "created_at": r["created_at"].isoformat() if r["created_at"] else None
        })
    return evals

def delete_evaluation(eval_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("DELETE FROM evaluations WHERE id = %s", (eval_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def get_user_stats(user_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT COUNT(*) as count, MAX(overall) as max_score FROM evaluations WHERE user_id = %s", (user_id,))
    eval_stats = cursor.fetchone()
    
    cursor.execute("SELECT total_xp, badges FROM user_gamification WHERE user_id = %s", (user_id,))
    gam_stats = cursor.fetchone()
    
    conn.close()
    
    total_xp = gam_stats["total_xp"] if gam_stats else 0
    badges = json.loads(gam_stats["badges"]) if gam_stats and gam_stats["badges"] else []
    
    return {
        "total_interviews": eval_stats["count"] or 0,
        "highest_score": eval_stats["max_score"] or 0,
        "total_xp": total_xp,
        "badges_count": len(badges)
    }

# ─────────────────────────────────────────────────────────────────────────────
# GAMIFICATION SYSTEM
# ─────────────────────────────────────────────────────────────────────────────

XP_LEVELS = [
    {"level": 1,  "xp_required": 0,      "rank": "Recruit"},
    {"level": 2,  "xp_required": 500,    "rank": "Applicant"},
    {"level": 3,  "xp_required": 1_500,  "rank": "Contender"},
    {"level": 4,  "xp_required": 3_500,  "rank": "Specialist"},
    {"level": 5,  "xp_required": 7_000,  "rank": "Expert"},
    {"level": 6,  "xp_required": 12_000, "rank": "Senior"},
    {"level": 7,  "xp_required": 20_000, "rank": "Principal"},
    {"level": 8,  "xp_required": 32_000, "rank": "Director"},
    {"level": 9,  "xp_required": 50_000, "rank": "VP"},
    {"level": 10, "xp_required": 75_000, "rank": "Legend"},
]

def _calculate_level(total_xp: int) -> Dict[str, Any]:
    current = XP_LEVELS[0]
    for tier in XP_LEVELS:
        if total_xp >= tier["xp_required"]:
            current = tier
        else:
            break
    
    current_idx = current["level"] - 1
    if current_idx + 1 < len(XP_LEVELS):
        next_tier = XP_LEVELS[current_idx + 1]
        xp_into_level    = total_xp - current["xp_required"]
        xp_for_next_lvl  = next_tier["xp_required"] - current["xp_required"]
        next_level_xp    = next_tier["xp_required"]
    else:
        xp_into_level   = total_xp - current["xp_required"]
        xp_for_next_lvl = 1
        next_level_xp   = current["xp_required"]
    
    return {
        "level":          current["level"],
        "rank_title":     current["rank"],
        "xp_into_level":  xp_into_level,
        "xp_for_next_lvl": xp_for_next_lvl,
        "next_level_xp":  next_level_xp,
        "progress_pct":   round((xp_into_level / max(xp_for_next_lvl, 1)) * 100, 1),
    }

def get_user_gamification(user_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("SELECT * FROM user_gamification WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()

    if row is None:
        cursor.execute(
            """INSERT INTO user_gamification (user_id, total_xp, level, rank_title, badges, streak, last_session)
               VALUES (%s, 0, 1, 'Recruit', '[]', 0, NULL) RETURNING *""",
            (user_id,)
        )
        row = cursor.fetchone()
        conn.commit()

    badges = json.loads(row["badges"])
    level_info = _calculate_level(row["total_xp"])

    conn.close()
    return {
        "user_id":       user_id,
        "total_xp":      row["total_xp"],
        "level":         level_info["level"],
        "rank_title":    level_info["rank_title"],
        "badges":        badges,
        "streak":        row["streak"],
        "last_session":  row["last_session"].isoformat() if row["last_session"] else None,
        "xp_into_level": level_info["xp_into_level"],
        "xp_for_next_lvl": level_info["xp_for_next_lvl"],
        "next_level_xp": level_info["next_level_xp"],
        "progress_pct":  level_info["progress_pct"],
    }

def add_xp_to_user(user_id: int, xp_earned: int, new_badge_ids: List[str]) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("SELECT * FROM user_gamification WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    if row is None:
        cursor.execute(
            """INSERT INTO user_gamification (user_id, total_xp, level, rank_title, badges, streak, last_session)
               VALUES (%s, 0, 1, 'Recruit', '[]', 0, NULL) RETURNING *""",
            (user_id,)
        )
        row = cursor.fetchone()
        conn.commit()

    old_total_xp  = row["total_xp"]
    old_level     = row["level"]
    existing_badges = json.loads(row["badges"])

    today     = date.today()
    last_sess = row["last_session"]
    streak    = row["streak"]

    if last_sess is None:
        streak = 1
    else:
        # last_sess might be string or date depending on driver, psycopg2 usually returns date obj
        last_date = date.fromisoformat(str(last_sess)) if isinstance(last_sess, str) else last_sess
        delta = (today - last_date).days
        if delta == 0:
            pass
        elif delta == 1:
            streak += 1
        else:
            streak = 1

    if streak >= 7 and "streak_7" not in existing_badges:
        new_badge_ids.append("streak_7")
    elif streak >= 3 and "streak_3" not in existing_badges:
        new_badge_ids.append("streak_3")

    streak_multiplier = 1.0
    if streak >= 7:
        streak_multiplier = 1.5
    elif streak >= 3:
        streak_multiplier = 1.2

    bonus_xp   = int(xp_earned * (streak_multiplier - 1.0))
    final_xp   = xp_earned + bonus_xp
    new_total  = old_total_xp + final_xp

    new_level_info = _calculate_level(new_total)
    leveled_up     = new_level_info["level"] > old_level

    all_badges = list(set(existing_badges + new_badge_ids))

    if old_total_xp == 0 and "first_blood" not in all_badges and xp_earned >= 1000:
        all_badges.append("first_blood")

    cursor.execute(
        """UPDATE user_gamification
           SET total_xp = %s, level = %s, rank_title = %s, badges = %s,
               streak = %s, last_session = %s, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = %s""",
        (
            new_total,
            new_level_info["level"],
            new_level_info["rank_title"],
            json.dumps(all_badges),
            streak,
            today,
            user_id,
        )
    )
    conn.commit()
    conn.close()

    return {
        "xp_earned":      final_xp,
        "xp_base":        xp_earned,
        "xp_bonus":       bonus_xp,
        "streak_multiplier": streak_multiplier,
        "total_xp":       new_total,
        "level":          new_level_info["level"],
        "rank_title":     new_level_info["rank_title"],
        "level_up":       leveled_up,
        "new_badges":     new_badge_ids,
        "all_badges":     all_badges,
        "streak":         streak,
        "progress_pct":   new_level_info["progress_pct"],
        "xp_into_level":  new_level_info["xp_into_level"],
        "xp_for_next_lvl": new_level_info["xp_for_next_lvl"],
        "next_level_xp":  new_level_info["next_level_xp"],
    }

def get_leaderboard(limit: int = 10) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """SELECT u.username, g.user_id, g.total_xp, g.level, g.rank_title, g.badges, g.streak
           FROM user_gamification g
           JOIN users u ON u.id = g.user_id
           WHERE u.role = 'candidate'
           ORDER BY g.total_xp DESC
           LIMIT %s""",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()

    board = []
    for i, r in enumerate(rows):
        board.append({
            "rank":       i + 1,
            "username":   r["username"],
            "user_id":    r["user_id"],
            "total_xp":   r["total_xp"],
            "level":      r["level"],
            "rank_title": r["rank_title"],
            "badges":     json.loads(r["badges"]),
            "streak":     r["streak"],
        })
    return board

def get_system_settings() -> Dict[str, str]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT key, value FROM system_settings")
    rows = cursor.fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}

def update_system_settings(settings: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    for k, v in settings.items():
        cursor.execute(
            "INSERT INTO system_settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (k, str(v))
        )
    conn.commit()
    conn.close()

def get_user_gamification(user_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("SELECT * FROM user_gamification WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()

    if row is None:
        cursor.execute(
            """INSERT INTO user_gamification (user_id, total_xp, level, rank_title, badges, streak, last_session)
               VALUES (%s, 0, 1, 'Recruit', '[]', 0, NULL) RETURNING *""",
            (user_id,)
        )
        row = cursor.fetchone()
        conn.commit()

    badges = json.loads(row["badges"])
    level_info = _calculate_level(row["total_xp"])

    conn.close()
    return {
        "user_id":       user_id,
        "total_xp":      row["total_xp"],
        "level":         level_info["level"],
        "rank_title":    level_info["rank_title"],
        "badges":        badges,
        "streak":        row["streak"],
        "last_session":  row["last_session"].isoformat() if row["last_session"] else None,
        "xp_into_level": level_info["xp_into_level"],
        "xp_for_next_lvl": level_info["xp_for_next_lvl"],
        "next_level_xp": level_info["next_level_xp"],
        "progress_pct":  level_info["progress_pct"],
    }

def add_xp_to_user(user_id: int, xp_earned: int, new_badge_ids: List[str]) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("SELECT * FROM user_gamification WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    if row is None:
        cursor.execute(
            """INSERT INTO user_gamification (user_id, total_xp, level, rank_title, badges, streak, last_session)
               VALUES (%s, 0, 1, 'Recruit', '[]', 0, NULL) RETURNING *""",
            (user_id,)
        )
        row = cursor.fetchone()
        conn.commit()

    old_total_xp  = row["total_xp"]
    old_level     = row["level"]
    existing_badges = json.loads(row["badges"])

    today     = date.today()
    last_sess = row["last_session"]
    streak    = row["streak"]

    if last_sess is None:
        streak = 1
    else:
        # last_sess might be string or date depending on driver, psycopg2 usually returns date obj
        last_date = date.fromisoformat(str(last_sess)) if isinstance(last_sess, str) else last_sess
        delta = (today - last_date).days
        if delta == 0:
            pass
        elif delta == 1:
            streak += 1
        else:
            streak = 1

    if streak >= 7 and "streak_7" not in existing_badges:
        new_badge_ids.append("streak_7")
    elif streak >= 3 and "streak_3" not in existing_badges:
        new_badge_ids.append("streak_3")

    streak_multiplier = 1.0
    if streak >= 7:
        streak_multiplier = 1.5
    elif streak >= 3:
        streak_multiplier = 1.2

    bonus_xp   = int(xp_earned * (streak_multiplier - 1.0))
    final_xp   = xp_earned + bonus_xp
    new_total  = old_total_xp + final_xp

    new_level_info = _calculate_level(new_total)
    leveled_up     = new_level_info["level"] > old_level

    all_badges = list(set(existing_badges + new_badge_ids))

    if old_total_xp == 0 and "first_blood" not in all_badges and xp_earned >= 1000:
        all_badges.append("first_blood")

    cursor.execute(
        """UPDATE user_gamification
           SET total_xp = %s, level = %s, rank_title = %s, badges = %s,
               streak = %s, last_session = %s, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = %s""",
        (
            new_total,
            new_level_info["level"],
            new_level_info["rank_title"],
            json.dumps(all_badges),
            streak,
            today,
            user_id,
        )
    )
    conn.commit()
    conn.close()

    return {
        "xp_earned":      final_xp,
        "xp_base":        xp_earned,
        "xp_bonus":       bonus_xp,
        "streak_multiplier": streak_multiplier,
        "total_xp":       new_total,
        "level":          new_level_info["level"],
        "rank_title":     new_level_info["rank_title"],
        "level_up":       leveled_up,
        "new_badges":     new_badge_ids,
        "all_badges":     all_badges,
        "streak":         streak,
        "progress_pct":   new_level_info["progress_pct"],
        "xp_into_level":  new_level_info["xp_into_level"],
        "xp_for_next_lvl": new_level_info["xp_for_next_lvl"],
        "next_level_xp":  new_level_info["next_level_xp"],
    }

def get_leaderboard(limit: int = 10) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """SELECT u.username, g.user_id, g.total_xp, g.level, g.rank_title, g.badges, g.streak,
                  (SELECT COUNT(*) FROM evaluations e WHERE e.user_id = g.user_id) as interview_count
           FROM user_gamification g
           JOIN users u ON u.id = g.user_id
           WHERE u.role = 'candidate'
           ORDER BY 
               g.total_xp DESC,
               g.streak DESC,
               json_array_length(g.badges::json) DESC,
               interview_count DESC
           LIMIT %s""",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()

    board = []
    for i, r in enumerate(rows):
        board.append({
            "rank":       i + 1,
            "username":   r["username"],
            "user_id":    r["user_id"],
            "total_xp":   r["total_xp"],
            "level":      r["level"],
            "rank_title": r["rank_title"],
"badges":     json.loads(r["badges"]),
            "streak":     r["streak"],
        })
    return board

def get_system_settings() -> Dict[str, str]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT key, value FROM system_settings")
    rows = cursor.fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}

def update_system_settings(settings: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    for k, v in settings.items():
        cursor.execute(
            "INSERT INTO system_settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (k, str(v))
        )
    conn.commit()
    conn.close()

# ─────────────────────────────────────────────────────────────────────────────
# RESUMES & ROADMAPS
# ─────────────────────────────────────────────────────────────────────────────

def save_user_resume(user_id: int, raw_text: str, ats_feedback_json: str = None) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT INTO user_resumes (user_id, raw_text, ats_feedback_json) 
               VALUES (%s, %s, %s) 
               ON CONFLICT (user_id) DO UPDATE 
               SET raw_text = EXCLUDED.raw_text, 
                   ats_feedback_json = EXCLUDED.ats_feedback_json,
                   created_at = CURRENT_TIMESTAMP""",
            (user_id, raw_text, ats_feedback_json)
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"Error saving resume: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def get_latest_user_resume(user_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM user_resumes WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        try:
            row["ats_feedback_json"] = json.loads(row["ats_feedback_json"]) if row["ats_feedback_json"] else None
        except:
            row["ats_feedback_json"] = None
            
        if row["created_at"]:
            row["created_at"] = row["created_at"].isoformat()
            
    return row

def create_roadmap_tasks(user_id: int, eval_id: int, tasks: List[str]) -> bool:
    if not tasks:
        return True
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for task in tasks:
            cursor.execute(
                "INSERT INTO roadmap_tasks (user_id, eval_id, task_text) VALUES (%s, %s, %s)",
                (user_id, eval_id, task)
            )
        conn.commit()
        return True
    except Exception as e:
        print(f"Error saving roadmap tasks: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def get_user_roadmap_tasks(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM roadmap_tasks WHERE user_id = %s ORDER BY is_completed ASC, created_at DESC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    
    for r in rows:
        if r["created_at"]:
            r["created_at"] = r["created_at"].isoformat()
    return rows

def complete_roadmap_task(task_id: int, user_id: int) -> bool:
    """Marks task complete"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT is_completed FROM roadmap_tasks WHERE id = %s AND user_id = %s", (task_id, user_id))
        task = cursor.fetchone()
        
        if not task:
            return False
            
        if task["is_completed"]:
            return False
            
        cursor.execute("UPDATE roadmap_tasks SET is_completed = TRUE WHERE id = %s AND user_id = %s", (task_id, user_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error completing task: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def get_users_with_pending_tasks() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute('''
            SELECT DISTINCT u.id as user_id, u.username, u.email
            FROM users u
            JOIN roadmap_tasks r ON u.id = r.user_id
            WHERE r.is_completed = FALSE 
            AND r.created_at <= NOW() - INTERVAL '2 days'
        ''')
        rows = cursor.fetchall()
        return rows
    except Exception as e:
        print(f"Error getting users with pending tasks: {e}")
        return []
    finally:
        conn.close()
