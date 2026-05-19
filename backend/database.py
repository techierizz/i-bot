import sqlite3
import hashlib
import uuid
import json
import os
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hiremind.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
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
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'candidate'
    )
    """)
    
    # Create evaluations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    
    # Create user_gamification table (persistent per-user XP & leveling)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_gamification (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      INTEGER UNIQUE NOT NULL,
        total_xp     INTEGER NOT NULL DEFAULT 0,
        level        INTEGER NOT NULL DEFAULT 1,
        rank_title   TEXT NOT NULL DEFAULT 'Recruit',
        badges       TEXT NOT NULL DEFAULT '[]',
        streak       INTEGER NOT NULL DEFAULT 0,
        last_session DATE,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    
    # Seed or synchronize administrator credentials from environment
    admins = []
    
    # Check for multiple admins via comma-separated env variables
    env_usernames = os.getenv("ADMIN_USERNAMES")
    env_passwords = os.getenv("ADMIN_PASSWORDS")
    
    if env_usernames and env_passwords:
        usernames = [u.strip() for u in env_usernames.split(",") if u.strip()]
        passwords = [p.strip() for p in env_passwords.split(",") if p.strip()]
        # Match them by index
        for u, p in zip(usernames, passwords):
            admins.append({"username": u, "password": p, "email": f"{u}@hiremind.ai"})
            
    # Also support / fall back to single admin credentials
    single_user = os.getenv("ADMIN_USERNAME", "admin")
    single_pass = os.getenv("ADMIN_PASSWORD", "admin123")
    if not any(a["username"] == single_user for a in admins):
        admins.append({"username": single_user, "password": single_pass, "email": "admin@hiremind.ai"})
        
    for admin in admins:
        u = admin["username"]
        p = admin["password"]
        e = admin["email"]
        
        cursor.execute("SELECT id, role FROM users WHERE username = ?", (u,))
        row = cursor.fetchone()
        
        hashed = hash_password(p)
        if row is None:
            cursor.execute(
                "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
                (u, e, hashed, "admin")
            )
            print(f"[*] Admin user initialized. Username: {u}")
        else:
            cursor.execute(
                "UPDATE users SET password_hash = ?, email = ?, role = 'admin' WHERE id = ?",
                (hashed, e, row["id"])
            )
            print(f"[*] Admin user synchronized. Username: {u}")
        
    conn.commit()
    conn.close()

def create_user(username: str, email: str, password: str, role: str = "candidate") -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        hashed = hash_password(password)
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (username, email, hashed, role)
        )
        conn.commit()
        user_id = cursor.lastrowid
        return {"status": "success", "user": {"id": user_id, "username": username, "email": email, "role": role}}
    except sqlite3.IntegrityError:
        return {"status": "error", "message": "Username already exists."}
    finally:
        conn.close()

def authenticate_user(username: str, password: str, role: str = "candidate") -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username, email, password_hash, role FROM users WHERE username = ? AND role = ?", (username, role))
    user_row = cursor.fetchone()
    conn.close()
    
    if user_row and verify_password(password, user_row["password_hash"]):
        return {
            "id": user_row["id"],
            "username": user_row["username"],
            "email": user_row["email"],
            "role": user_row["role"]
        }
    return None

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
    cursor = conn.cursor()
    
    transcript_str = json.dumps(transcript)
    evaluation_str = json.dumps(evaluation_data)
    
    cursor.execute(
        """
        INSERT INTO evaluations (
            user_id, username, mode, overall, technical, communication, confidence, problem_solving, transcript, evaluation_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id, username, mode, overall, technical, communication, confidence, problem_solving,
            transcript_str, evaluation_str
        )
    )
    conn.commit()
    eval_id = cursor.lastrowid
    conn.close()
    return eval_id

def get_admin_metrics() -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Total conducted interviews
    cursor.execute("SELECT COUNT(*) FROM evaluations")
    total_interviews = cursor.fetchone()[0]
    
    # 2. Total unique candidates
    cursor.execute("SELECT COUNT(DISTINCT user_id) FROM evaluations")
    total_candidates = cursor.fetchone()[0]
    
    # 3. Average score metrics
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
            "overall": round(avg_row["avg_overall"] or 0, 1),
            "technical": round(avg_row["avg_technical"] or 0, 1),
            "communication": round(avg_row["avg_communication"] or 0, 1),
            "confidence": round(avg_row["avg_confidence"] or 0, 1),
            "problem_solving": round(avg_row["avg_problem_solving"] or 0, 1),
        }
    }

def get_all_evaluations() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
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
            "created_at": r["created_at"]
        })
    return evals

def delete_evaluation(eval_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM evaluations WHERE id = ?", (eval_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted

# ─────────────────────────────────────────────────────────────────────────────
# GAMIFICATION SYSTEM
# ─────────────────────────────────────────────────────────────────────────────

# XP thresholds and rank titles for each level (index = level number)
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
    """Return level, rank_title, xp_into_level, and xp_needed_for_next based on total XP."""
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
        # Max level reached
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
    """Fetch the gamification record for a user. Creates a default row if missing."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM user_gamification WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()

    if row is None:
        # First-time user — initialise record
        cursor.execute(
            """INSERT INTO user_gamification (user_id, total_xp, level, rank_title, badges, streak, last_session)
               VALUES (?, 0, 1, 'Recruit', '[]', 0, NULL)""",
            (user_id,)
        )
        conn.commit()
        cursor.execute("SELECT * FROM user_gamification WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()

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
        "last_session":  row["last_session"],
        "xp_into_level": level_info["xp_into_level"],
        "xp_for_next_lvl": level_info["xp_for_next_lvl"],
        "next_level_xp": level_info["next_level_xp"],
        "progress_pct":  level_info["progress_pct"],
    }


def add_xp_to_user(user_id: int, xp_earned: int, new_badge_ids: List[str]) -> Dict[str, Any]:
    """
    Add XP earned in a session to the user's cumulative total.
    Handles streak calculation, badge deduplication, and level-up detection.
    Returns the updated gamification state plus metadata about level-up and new badges.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Ensure row exists
    cursor.execute("SELECT * FROM user_gamification WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    if row is None:
        cursor.execute(
            """INSERT INTO user_gamification (user_id, total_xp, level, rank_title, badges, streak, last_session)
               VALUES (?, 0, 1, 'Recruit', '[]', 0, NULL)""",
            (user_id,)
        )
        conn.commit()
        cursor.execute("SELECT * FROM user_gamification WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()

    old_total_xp  = row["total_xp"]
    old_level     = row["level"]
    existing_badges = json.loads(row["badges"])

    # ── Streak calculation ─────────────────────────────────────────────────
    today     = date.today()
    last_sess = row["last_session"]
    streak    = row["streak"]

    if last_sess is None:
        streak = 1
    else:
        last_date = date.fromisoformat(str(last_sess)) if isinstance(last_sess, str) else last_sess
        delta = (today - last_date).days
        if delta == 0:
            pass           # Same day — keep streak
        elif delta == 1:
            streak += 1    # Consecutive day
        else:
            streak = 1     # Streak broken

    # Streak bonus badges
    if streak >= 7 and "streak_7" not in existing_badges:
        new_badge_ids.append("streak_7")
    elif streak >= 3 and "streak_3" not in existing_badges:
        new_badge_ids.append("streak_3")

    # ── Accumulate XP ─────────────────────────────────────────────────────
    # Apply streak multiplier
    streak_multiplier = 1.0
    if streak >= 7:
        streak_multiplier = 1.5
    elif streak >= 3:
        streak_multiplier = 1.2

    bonus_xp   = int(xp_earned * (streak_multiplier - 1.0))
    final_xp   = xp_earned + bonus_xp
    new_total  = old_total_xp + final_xp

    # ── Level calculation ─────────────────────────────────────────────────
    new_level_info = _calculate_level(new_total)
    leveled_up     = new_level_info["level"] > old_level

    # ── Badge merge (deduplicate) ─────────────────────────────────────────
    all_badges = list(set(existing_badges + new_badge_ids))

    # First interview badge
    if old_total_xp == 0 and "first_blood" not in all_badges:
        all_badges.append("first_blood")

    # Persist to DB
    cursor.execute(
        """UPDATE user_gamification
           SET total_xp = ?, level = ?, rank_title = ?, badges = ?,
               streak = ?, last_session = ?, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?""",
        (
            new_total,
            new_level_info["level"],
            new_level_info["rank_title"],
            json.dumps(all_badges),
            streak,
            today.isoformat(),
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
    """Return top users sorted by total XP, joined with username from users table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT u.username, g.user_id, g.total_xp, g.level, g.rank_title, g.badges, g.streak
           FROM user_gamification g
           JOIN users u ON u.id = g.user_id
           WHERE u.role = 'candidate'
           ORDER BY g.total_xp DESC
           LIMIT ?""",
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
