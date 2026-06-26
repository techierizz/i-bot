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
    conn.commit()
# Create password_reset_tokens table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    conn.commit()
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
    conn.commit()
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
    conn.commit()
# Create system settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)
    conn.commit()
# Commit all previous table creations before attempting ALTER TABLEs
    # so they don't get rolled back if ALTER TABLE throws an exception.
    conn.commit()
    
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
    
    # Create courses table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        difficulty TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        chatbot_enabled INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
# Create course_lessons table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS course_lessons (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        video_url TEXT,
        practice_code TEXT,
        language TEXT,
        order_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
# Run column migration for SQLite/Postgres to add new fields if they don't exist
    try:
        cursor.execute("ALTER TABLE courses ADD COLUMN chatbot_enabled INTEGER DEFAULT 1")
        conn.commit()
    except Exception:
        conn.rollback()
    try:
        cursor.execute("ALTER TABLE courses ADD COLUMN status TEXT DEFAULT 'active'")
        conn.commit()
    except Exception:
        conn.rollback()
    try:
        cursor.execute("ALTER TABLE course_lessons ADD COLUMN video_url TEXT")
        conn.commit()
    except Exception:
        conn.rollback()
    try:
        cursor.execute("ALTER TABLE course_lessons ADD COLUMN practice_code TEXT")
        conn.commit()
    except Exception:
        conn.rollback()
    try:
        cursor.execute("ALTER TABLE course_lessons ADD COLUMN language TEXT")
        conn.commit()
    except Exception:
        conn.rollback()

    # If database was seeded without practice_code, clear to reseed with code
    try:
        cursor.execute("SELECT COUNT(*) as count FROM course_lessons WHERE practice_code IS NOT NULL")
        has_code = cursor.fetchone()["count"] > 0
        if not has_code:
            cursor.execute("DELETE FROM course_lessons")
            cursor.execute("DELETE FROM courses")
            conn.commit()
    except Exception:
        conn.rollback()

    # If database was seeded without videos, clear to reseed with videos
    try:
        cursor.execute("SELECT COUNT(*) as count FROM course_lessons WHERE video_url IS NOT NULL")
        has_videos = cursor.fetchone()["count"] > 0
        if not has_videos:
            cursor.execute("DELETE FROM course_lessons")
            cursor.execute("DELETE FROM courses")
            conn.commit()
    except Exception:
        conn.rollback()

    # Create enrollments table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'enrolled',
        xp_earned INTEGER NOT NULL DEFAULT 0,
        certificate_id TEXT,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
        UNIQUE (user_id, course_id)
    )
    """)
    conn.commit()
# Create skills_verified table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS skills_verified (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        skill_name TEXT NOT NULL,
        level TEXT NOT NULL,
        score INTEGER NOT NULL,
        verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE (user_id, skill_name)
    )
    """)
    conn.commit()
# Create certificates table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        skill_name TEXT NOT NULL,
        issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_by_mentor_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
        FOREIGN KEY (verified_by_mentor_id) REFERENCES users (id) ON DELETE SET NULL
    )
    """)
    conn.commit()
# Create quiz_submissions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_submissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        course_id INTEGER NOT NULL,
        course_title TEXT NOT NULL,
        challenge_title TEXT NOT NULL,
        student_code TEXT NOT NULL,
        language TEXT NOT NULL,
        ai_score INTEGER NOT NULL,
        mentor_score INTEGER,
        warnings INTEGER DEFAULT 0,
        is_passed INTEGER DEFAULT 0,
        feedback TEXT,
        mentor_feedback TEXT,
        lesson_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
# Try altering quiz_submissions to add lesson_id for existing databases
    try:
        cursor.execute("ALTER TABLE quiz_submissions ADD COLUMN lesson_id INTEGER")
        conn.commit()
    except Exception:
        conn.rollback()

    try:
        cursor.execute("ALTER TABLE quiz_submissions ADD COLUMN is_final INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        conn.rollback()

    try:
        cursor.execute("ALTER TABLE quiz_submissions ADD COLUMN submission_type TEXT DEFAULT 'code_completion'")
        conn.commit()
    except Exception:
        conn.rollback()

    try:
        cursor.execute("ALTER TABLE quiz_submissions ADD COLUMN pr_link TEXT")
        conn.commit()
    except Exception:
        conn.rollback()

    try:
        cursor.execute("ALTER TABLE quiz_submissions ADD COLUMN external_validation_score INTEGER")
        conn.commit()
    except Exception:
        conn.rollback()

    try:
        cursor.execute("ALTER TABLE quiz_submissions ADD COLUMN question_description TEXT")
        conn.commit()
    except Exception:
        conn.rollback()

    # Create proctoring_violations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS proctoring_violations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        course_id INTEGER NOT NULL,
        course_title TEXT NOT NULL,
        image_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
# Create course_assignments table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS course_assignments (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL,
        lesson_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        assignment_type TEXT NOT NULL DEFAULT 'code_completion',
        instructions TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        language TEXT NOT NULL,
        boilerplate_code TEXT NOT NULL,
        test_cases TEXT NOT NULL,
        optimal_solution_explanation TEXT,
        github_repo_url TEXT,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
        FOREIGN KEY (lesson_id) REFERENCES course_lessons (id) ON DELETE CASCADE,
        UNIQUE (course_id, lesson_id)
    )
    """)
    conn.commit()
# Create course_final_exams table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS course_final_exams (
        id SERIAL PRIMARY KEY,
        course_id INTEGER UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        language TEXT NOT NULL,
        boilerplate_code TEXT NOT NULL,
        test_cases TEXT NOT NULL,
        optimal_solution_explanation TEXT,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
# Create exam_attempts table for server-side sessions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_attempts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        exam_id INTEGER NOT NULL,
        exam_type TEXT NOT NULL DEFAULT 'lesson',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        submitted_at TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'in_progress',
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE (user_id, exam_id, exam_type)
    )
    """)
    conn.commit()
# Create mentor_courses table for course-based access control
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mentor_courses (
        id SERIAL PRIMARY KEY,
        mentor_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by INTEGER REFERENCES users (id),
        FOREIGN KEY (mentor_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
        UNIQUE (mentor_id, course_id)
    )
    """)
    conn.commit()
# Create exam_events table for audit trail
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_events (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL,
        exam_type TEXT NOT NULL,
        mentor_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mentor_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
# Check if mentor_assignment_events needs recreation for CHECK constraint in SQLite
    if IS_SQLITE:
        try:
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='mentor_assignment_events'")
            schema_row = cursor.fetchone()
            if schema_row:
                sql_schema = schema_row["sql"]
                if "CHECK" not in sql_schema or "assigned" not in sql_schema:
                    print("[*] Recreating mentor_assignment_events to add CHECK constraint...")
                    cursor.execute("DROP TABLE mentor_assignment_events")
                    conn.commit()
        except Exception as e:
            conn.rollback()
            print("[!] Error verifying sqlite constraint:", e)

    # Create mentor_assignment_events table for audit trail
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mentor_assignment_events (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        mentor_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('assigned', 'removed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (mentor_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
# Check/add constraint in PostgreSQL
    if not IS_SQLITE:
        try:
            cursor.execute("""
                ALTER TABLE mentor_assignment_events 
                ADD CONSTRAINT check_action_type 
                CHECK (action IN ('assigned', 'removed'))
            """)
            conn.commit()
        except Exception:
            conn.rollback()

    # Create course_deletion_events table for audit trail
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS course_deletion_events (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('deleted', 'restored', 'purged')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    conn.commit()
# Check/add constraint for course_deletion_events in PostgreSQL
    if not IS_SQLITE:
        try:
            cursor.execute("""
                ALTER TABLE course_deletion_events 
                ADD CONSTRAINT check_deletion_action_type 
                CHECK (action IN ('deleted', 'restored', 'purged'))
            """)
            conn.commit()
        except Exception:
            conn.rollback()


    # Create required indexes
    for idx_name, tbl, col in [
        ("idx_mentor_courses_mentor_id", "mentor_courses", "mentor_id"),
        ("idx_mentor_courses_course_id", "mentor_courses", "course_id"),
        ("idx_exam_attempts_exam_id", "exam_attempts", "exam_id"),
        ("idx_exam_attempts_student_id", "exam_attempts", "user_id"),
        ("idx_exam_events_exam_id", "exam_events", "exam_id"),
        ("idx_quiz_submissions_exam_id", "quiz_submissions", "exam_id"),
        ("idx_quiz_submissions_review_status", "quiz_submissions", "review_status")
    ]:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {tbl}({col})")
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"[!] Error creating index {idx_name}: {e}")

    # Execute column migrations to alter tables if needed
    for col_def in [
        ("course_assignments", "status", "TEXT DEFAULT 'active'"),
        ("course_assignments", "ended_at", "TIMESTAMP"),
        ("course_assignments", "ended_by", "INTEGER"),
        ("course_final_exams", "status", "TEXT DEFAULT 'active'"),
        ("course_final_exams", "ended_at", "TIMESTAMP"),
        ("course_final_exams", "ended_by", "INTEGER"),
        ("quiz_submissions", "review_status", "TEXT DEFAULT 'pending'"),
        ("quiz_submissions", "exam_id", "INTEGER"),
        ("quiz_submissions", "exam_type", "TEXT DEFAULT 'lesson'"),
        ("mentor_courses", "assigned_at", "TIMESTAMP"),
        ("mentor_courses", "assigned_by", "INTEGER REFERENCES users(id)"),
    ]:
        tbl, col, dtype = col_def
        try:
            cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {dtype}")
            conn.commit()
        except Exception:
            conn.rollback()

    # Populate assigned_at for existing records if null
    try:
        cursor.execute("UPDATE mentor_courses SET assigned_at = CURRENT_TIMESTAMP WHERE assigned_at IS NULL")
        conn.commit()
    except Exception:
        conn.rollback()

    # Synchronize mentor_courses table is no longer needed
    # Admins have global access and shouldn't be listed as mentors
    

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
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
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

def get_user_email(username: str) -> str:
    """Helper to fetch a user's email by their username."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT email FROM users WHERE username = %s", (username,))
        row = cursor.fetchone()
        return row["email"] if row else None
    except Exception as e:
        print(f"Error getting user email: {e}")
        return None
    finally:
        conn.close()

import secrets
from datetime import datetime, timedelta

def create_password_reset_token(email: str) -> str:
    """Generates a secure password reset token for the given email, valid for 1 hour."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check if user exists with this email
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        if not user:
            return None # User not found
            
        user_id = user["id"]
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)
        
        # Delete any existing tokens for this user
        cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user_id,))
        
        # Insert new token
        cursor.execute(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (user_id, token, expires_at)
        )
        conn.commit()
        return token
    except Exception as e:
        print(f"Error creating reset token: {e}")
        conn.rollback()
        return None
    finally:
        conn.close()

def verify_and_use_password_reset_token(token: str, new_password_hash: str) -> bool:
    """Verifies a reset token and updates the user's password if valid."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check if token exists and is valid
        cursor.execute("SELECT user_id, expires_at FROM password_reset_tokens WHERE token = %s", (token,))
        row = cursor.fetchone()
        
        if not row:
            return False # Invalid token
            
        if row["expires_at"] < datetime.utcnow():
            # Delete expired token
            cursor.execute("DELETE FROM password_reset_tokens WHERE token = %s", (token,))
            conn.commit()
            return False # Token expired
            
        user_id = row["user_id"]
        
        # Update user's password
        cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_password_hash, user_id))
        
        # Delete the used token
        cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user_id,))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"Error verifying reset token: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

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


# --- LEARNING HUB FUNCTIONS ---
IS_SQLITE = False

def get_courses() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT c.id, c.title, c.description, c.difficulty, c.tags, c.created_at, c.chatbot_enabled, u.username as mentor_name,
               (SELECT COUNT(*) FROM course_lessons cl WHERE cl.course_id = c.id) as modules_count
        FROM courses c
        JOIN users u ON u.id = c.created_by
        WHERE c.status = 'active'
        ORDER BY c.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    courses_list = []
    for r in rows:
        try:
            tags = json.loads(r["tags"])
        except Exception:
            tags = []
        courses_list.append({
            "id": r["id"],
            "title": r["title"],
            "description": r["description"],
            "difficulty": r["difficulty"],
            "tags": tags,
            "mentor_name": r["mentor_name"],
            "chatbot_enabled": bool(r.get("chatbot_enabled", 1)),
            "created_at": r["created_at"].isoformat() if isinstance(r["created_at"], datetime) else str(r["created_at"]),
            "modules_count": r.get("modules_count", 0)
        })
    return courses_list

def get_course_details(course_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        SELECT c.id, c.title, c.description, c.difficulty, c.tags, c.created_at, c.chatbot_enabled, c.status, u.username as mentor_name
        FROM courses c
        JOIN users u ON u.id = c.created_by
        WHERE c.id = %s
    """, (course_id,))
    course = cursor.fetchone()
    
    if not course:
        conn.close()
        return None
        
    cursor.execute("""
        SELECT id, title, content, video_url, practice_code, language, order_index
        FROM course_lessons
        WHERE course_id = %s
        ORDER BY order_index ASC
    """, (course_id,))
    lessons = cursor.fetchall()
    conn.close()
    
    try:
        tags = json.loads(course["tags"])
    except Exception:
        tags = []
        
    return {
        "id": course["id"],
        "title": course["title"],
        "description": course["description"],
        "difficulty": course["difficulty"],
        "tags": tags,
        "mentor_name": course["mentor_name"],
        "chatbot_enabled": bool(course.get("chatbot_enabled", 1)),
        "status": course.get("status", "active"),
        "created_at": course["created_at"].isoformat() if isinstance(course["created_at"], datetime) else str(course["created_at"]),
        "lessons": [dict(l) for l in lessons]
    }

def enroll_user_in_course(user_id: int, course_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            "INSERT INTO enrollments (user_id, course_id, status) VALUES (%s, %s, 'enrolled') RETURNING id",
            (user_id, course_id)
        )
        enroll_id = cursor.fetchone()["id"]
        conn.commit()
        return {"status": "success", "enrollment_id": enroll_id}
    except (psycopg2.IntegrityError, sqlite3.IntegrityError) as e:
        conn.rollback()
        err_msg = str(e).lower()
        if "foreign key" in err_msg:
            return {"status": "error", "message": "Invalid user or course. You may need to log out and log back in."}
        return {"status": "already_enrolled", "message": "User is already enrolled in this course."}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_user_enrollments(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT e.id as enrollment_id, e.status, e.xp_earned, e.certificate_id, e.enrolled_at, e.completed_at,
               c.id as course_id, c.title, c.description, c.difficulty
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        WHERE e.user_id = %s AND c.status = 'active'
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def complete_enrollment(user_id: int, course_id: int, xp_earned: int, certificate_id: str, skill_name: str, difficulty: str, verified_by_mentor_id: int = None) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # 1. Update enrollment status to completed
        cursor.execute("""
            UPDATE enrollments
            SET status = 'completed', xp_earned = %s, certificate_id = %s, completed_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND course_id = %s
        """, (xp_earned, certificate_id, user_id, course_id))
        
        # 2. Insert or update verified skill
        cursor.execute("""
            INSERT INTO skills_verified (user_id, skill_name, level, score)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, skill_name) DO UPDATE
            SET level = EXCLUDED.level, 
                score = CASE WHEN skills_verified.score > EXCLUDED.score THEN skills_verified.score ELSE EXCLUDED.score END
        """, (user_id, skill_name, difficulty, 100))
        
        # 3. Create certificate
        cursor.execute("""
            INSERT INTO certificates (id, user_id, course_id, skill_name, verified_by_mentor_id)
            VALUES (%s, %s, %s, %s, %s)
        """, (certificate_id, user_id, course_id, skill_name, verified_by_mentor_id))
        
        conn.commit()
        conn.close()
        
        # 4. Award XP
        gamification_update = add_xp_to_user(user_id, xp_earned, [f"cert_{skill_name.lower().replace(' ', '_')}"])
        return {"status": "success", "gamification": gamification_update}
    except Exception as e:
        conn.rollback()
        conn.close()
        return {"status": "error", "message": str(e)}

def fail_enrollment(user_id: int, course_id: int, skill_name: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # 1. Revert enrollment status to enrolled, clear certificate and completion timestamp
        cursor.execute("""
            UPDATE enrollments
            SET status = 'enrolled', certificate_id = NULL, completed_at = NULL
            WHERE user_id = %s AND course_id = %s
        """, (user_id, course_id))
        
        # 2. Delete the certificate if it exists
        cursor.execute("""
            DELETE FROM certificates
            WHERE user_id = %s AND course_id = %s
        """, (user_id, course_id))
        
        # 3. Delete the verified skill
        cursor.execute("""
            DELETE FROM skills_verified
            WHERE user_id = %s AND skill_name = %s
        """, (user_id, skill_name))
        
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        conn.close()
        return {"status": "error", "message": str(e)}

def submit_enrollment(user_id: int, course_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            UPDATE enrollments
            SET status = 'submitted'
            WHERE user_id = %s AND course_id = %s
        """, (user_id, course_id))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_user_certificates(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT cert.id as certificate_id, cert.skill_name, cert.issue_date, c.title as course_title,
               c.difficulty, u.username as candidate_name, m.username as mentor_name
        FROM certificates cert
        JOIN courses c ON c.id = cert.course_id
        JOIN users u ON u.id = cert.user_id
        LEFT JOIN users m ON m.id = cert.verified_by_mentor_id
        WHERE cert.user_id = %s
        ORDER BY cert.issue_date DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    
    certs = []
    for r in rows:
        issue_date_str = r["issue_date"].isoformat() if isinstance(r["issue_date"], datetime) else str(r["issue_date"])
        certs.append({
            "certificate_id": r["certificate_id"],
            "skill_name": r["skill_name"],
            "course_title": r["course_title"],
            "difficulty": r["difficulty"],
            "candidate_name": r["candidate_name"],
            "mentor_name": r["mentor_name"] or "System AI Evaluator",
            "issue_date": issue_date_str
        })
    return certs

def get_user_skills(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT id, skill_name, level, score, verified_at
        FROM skills_verified
        WHERE user_id = %s
        ORDER BY verified_at DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def create_course(title: str, description: str, created_by: int, difficulty: str, tags: List[str], chatbot_enabled: bool = True) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        tags_json = json.dumps(tags)
        chatbot_val = 1 if chatbot_enabled else 0
        cursor.execute(
            "INSERT INTO courses (title, description, created_by, tags, difficulty, chatbot_enabled) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (title, description, created_by, tags_json, difficulty, chatbot_val)
        )
        course_id = cursor.fetchone()["id"]
        
        # Automatically assign course creator inside transaction
        cursor.execute(
            "INSERT INTO mentor_courses (mentor_id, course_id, assigned_by) VALUES (%s, %s, %s)",
            (created_by, course_id, created_by)
        )
        conn.commit()
        return {"status": "success", "course_id": course_id}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def create_lesson(course_id: int, title: str, content: str, video_url: str, practice_code: str, language: str, order_index: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            "INSERT INTO course_lessons (course_id, title, content, video_url, practice_code, language, order_index) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (course_id, title, content, video_url, practice_code, language, order_index)
        )
        lesson_id = cursor.fetchone()["id"]
        conn.commit()
        return {"status": "success", "lesson_id": lesson_id}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def create_quiz_submission(user_id: int, username: str, course_id: int, course_title: str, challenge_title: str, student_code: str, language: str, ai_score: int, warnings: int, is_passed: bool, feedback: str, lesson_id: Optional[int] = None, is_final: bool = False, exam_id: Optional[int] = None, exam_type: Optional[str] = None, question_description: str = "") -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        passed_val = 1 if is_passed else 0
        
        # Resolve exam_id and exam_type if not passed
        if exam_id is None:
            if is_final:
                cursor.execute("SELECT id FROM course_final_exams WHERE course_id = %s", (course_id,))
                row = cursor.fetchone()
                if row:
                    exam_id = row["id"]
                    exam_type = "final"
            elif lesson_id is not None:
                cursor.execute("SELECT id FROM course_assignments WHERE course_id = %s AND lesson_id = %s", (course_id, lesson_id))
                row = cursor.fetchone()
                if row:
                    exam_id = row["id"]
                    exam_type = "lesson"
                    
        if exam_type is None:
            exam_type = "final" if is_final else "lesson"

        cursor.execute(
            """
            INSERT INTO quiz_submissions (
                user_id, username, course_id, course_title, challenge_title, student_code, language, ai_score, warnings, is_passed, feedback, lesson_id, is_final, exam_id, exam_type, review_status, question_description
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s) RETURNING id
            """,
            (user_id, username, course_id, course_title, challenge_title, student_code, language, ai_score, warnings, passed_val, feedback, lesson_id, 1 if is_final else 0, exam_id, exam_type, question_description)
        )
        sub_id = cursor.fetchone()["id"]
        conn.commit()
        return {"status": "success", "submission_id": sub_id}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_quiz_submissions() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT id, user_id, username, course_id, course_title, challenge_title, student_code, language, ai_score, mentor_score, warnings, is_passed, feedback, mentor_feedback, created_at, lesson_id, is_final, exam_id, exam_type, review_status
            FROM quiz_submissions
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        
        subs = []
        for r in rows:
            created_at_str = r["created_at"].isoformat() if isinstance(r["created_at"], datetime) else str(r["created_at"])
            subs.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "username": r["username"],
                "course_id": r["course_id"],
                "course_title": r["course_title"],
                "challenge_title": r["challenge_title"],
                "student_code": r["student_code"],
                "language": r["language"],
                "ai_score": r["ai_score"],
                "mentor_score": r["mentor_score"],
                "warnings": r["warnings"],
                "is_passed": bool(r["is_passed"]),
                "feedback": r["feedback"],
                "mentor_feedback": r.get("mentor_feedback"),
                "created_at": created_at_str,
                "lesson_id": r["lesson_id"],
                "is_final": bool(r.get("is_final", 0)),
                "exam_id": r.get("exam_id"),
                "exam_type": r.get("exam_type", "lesson"),
                "review_status": r.get("review_status", "pending")
            })
        return subs
    except Exception as e:
        print("[!] Error fetching quiz submissions:", e)
        return []
    finally:
        conn.close()

def create_course_exam(course_id: int, lesson_id: int, title: str, instructions: str, difficulty: str, language: str, boilerplate_code: str, test_cases: List[Dict[str, Any]], optimal_solution_explanation: str, created_by: int, assignment_type: str = "code_completion", github_repo_url: str = "") -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        test_cases_json = json.dumps(test_cases)
        cursor.execute(
            "SELECT id FROM course_assignments WHERE course_id = %s AND lesson_id = %s",
            (course_id, lesson_id)
        )
        existing = cursor.fetchone()
        if existing:
            cursor.execute(
                """
                UPDATE course_assignments
                SET title = %s, instructions = %s, assignment_type = %s, github_repo_url = %s, difficulty = %s, language = %s, boilerplate_code = %s, test_cases = %s, optimal_solution_explanation = %s, created_by = %s
                WHERE id = %s
                """,
                (title, instructions, assignment_type, github_repo_url, difficulty, language, boilerplate_code, test_cases_json, optimal_solution_explanation, created_by, existing["id"])
            )
            exam_id = existing["id"]
        else:
            cursor.execute(
                """
                INSERT INTO course_assignments (course_id, lesson_id, title, instructions, assignment_type, github_repo_url, difficulty, language, boilerplate_code, test_cases, optimal_solution_explanation, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                """,
                (course_id, lesson_id, title, instructions, assignment_type, github_repo_url, difficulty, language, boilerplate_code, test_cases_json, optimal_solution_explanation, created_by)
            )
            exam_id = cursor.fetchone()["id"]
        conn.commit()
        return {"status": "success", "exam_id": exam_id}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_course_exam(course_id: int, lesson_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            """
            SELECT id, course_id, lesson_id, title, instructions as description, assignment_type, github_repo_url, difficulty, language, boilerplate_code, test_cases, optimal_solution_explanation, created_by, created_at, status, ended_at, ended_by
            FROM course_assignments
            WHERE course_id = %s AND lesson_id = %s
            """,
            (course_id, lesson_id)
        )
        row = cursor.fetchone()
        if not row:
            return None
        
        try:
            test_cases = json.loads(row["test_cases"])
        except Exception:
            test_cases = []
            
        return {
            "id": row["id"],
            "course_id": row["course_id"],
            "lesson_id": row["lesson_id"],
            "title": row["title"],
            "description": row["description"],
            "difficulty": row["difficulty"],
            "language": row["language"],
            "assignment_type": row.get("assignment_type", "code_completion"),
            "github_repo_url": row.get("github_repo_url", ""),
            "boilerplate_code": row["boilerplate_code"],
            "test_cases": test_cases,
            "optimal_solution_explanation": row["optimal_solution_explanation"],
            "created_by": row["created_by"],
            "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
            "status": row.get("status", "active"),
            "ended_at": row["ended_at"].isoformat() if row.get("ended_at") and hasattr(row["ended_at"], "isoformat") else str(row.get("ended_at")) if row.get("ended_at") else None,
            "ended_by": row.get("ended_by")
        }
    except Exception as e:
        print("[!] Error fetching course exam:", e)
        return None
    finally:
        conn.close()

def create_course_final_exam(course_id: int, title: str, description: str, difficulty: str, language: str, boilerplate_code: str, test_cases: List[Dict[str, Any]], optimal_solution_explanation: str, created_by: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        test_cases_json = json.dumps(test_cases)
        cursor.execute(
            "SELECT id FROM course_final_exams WHERE course_id = %s",
            (course_id,)
        )
        existing = cursor.fetchone()
        if existing:
            cursor.execute(
                """
                UPDATE course_final_exams
                SET title = %s, description = %s, difficulty = %s, language = %s, boilerplate_code = %s, test_cases = %s, optimal_solution_explanation = %s, created_by = %s
                WHERE id = %s
                """,
                (title, description, difficulty, language, boilerplate_code, test_cases_json, optimal_solution_explanation, created_by, existing["id"])
            )
            exam_id = existing["id"]
        else:
            cursor.execute(
                """
                INSERT INTO course_final_exams (course_id, title, description, difficulty, language, boilerplate_code, test_cases, optimal_solution_explanation, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                """,
                (course_id, title, description, difficulty, language, boilerplate_code, test_cases_json, optimal_solution_explanation, created_by)
            )
            exam_id = cursor.fetchone()["id"]
        conn.commit()
        return {"status": "success", "exam_id": exam_id}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_course_final_exam(course_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            """
            SELECT id, course_id, title, description, difficulty, language, boilerplate_code, test_cases, optimal_solution_explanation, created_by, created_at, status, ended_at, ended_by
            FROM course_final_exams
            WHERE course_id = %s
            """,
            (course_id,)
        )
        row = cursor.fetchone()
        if not row:
            return None
        
        try:
            test_cases = json.loads(row["test_cases"])
        except Exception:
            test_cases = []
            
        return {
            "id": row["id"],
            "course_id": row["course_id"],
            "title": row["title"],
            "description": row["description"],
            "difficulty": row["difficulty"],
            "language": row["language"],
            "assignment_type": row.get("assignment_type", "code_completion"),
            "github_repo_url": row.get("github_repo_url", ""),
            "boilerplate_code": row["boilerplate_code"],
            "test_cases": test_cases,
            "optimal_solution_explanation": row["optimal_solution_explanation"],
            "created_by": row["created_by"],
            "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
            "status": row.get("status", "active"),
            "ended_at": row["ended_at"].isoformat() if row.get("ended_at") and hasattr(row["ended_at"], "isoformat") else str(row.get("ended_at")) if row.get("ended_at") else None,
            "ended_by": row.get("ended_by")
        }
    except Exception as e:
        print("[!] Error fetching course final exam:", e)
        return None
    finally:
        conn.close()

def get_certificate_by_id(cert_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT cert.id as certificate_id, cert.skill_name, cert.issue_date, c.title as course_title,
                   c.difficulty, u.username as candidate_name, m.username as mentor_name,
                   m.signature_data as mentor_signature
            FROM certificates cert
            JOIN courses c ON c.id = cert.course_id
            JOIN users u ON u.id = cert.user_id
            LEFT JOIN users m ON m.id = cert.verified_by_mentor_id
            WHERE cert.id = %s
        """, (cert_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        issue_date_str = row["issue_date"].isoformat() if isinstance(row["issue_date"], datetime) else str(row["issue_date"])
        return {
            "certificate_id": row["certificate_id"],
            "skill_name": row["skill_name"],
            "course_title": row["course_title"],
            "difficulty": row["difficulty"],
            "candidate_name": row["candidate_name"],
            "mentor_name": row["mentor_name"] or "System AI Evaluator",
            "mentor_signature": row["mentor_signature"],
            "issue_date": issue_date_str
        }
    except Exception as e:
        print("[!] Error fetching certificate by id:", e)
        return None
    finally:
        conn.close()

def check_syllabus_completion(user_id: int, course_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Get all configured exams for this course
        cursor.execute("SELECT lesson_id FROM course_assignments WHERE course_id = %s", (course_id,))
        exam_rows = cursor.fetchall()
        configured_exam_lesson_ids = {e["lesson_id"] for e in exam_rows}
        
        if not configured_exam_lesson_ids:
            return True
            
        # Get passing submissions by this user
        cursor.execute(
            "SELECT DISTINCT lesson_id FROM quiz_submissions WHERE user_id = %s AND course_id = %s AND is_passed = 1 AND lesson_id IS NOT NULL",
            (user_id, course_id)
        )
        passed_rows = cursor.fetchall()
        passed_lesson_ids = {p["lesson_id"] for p in passed_rows}
        
        return configured_exam_lesson_ids.issubset(passed_lesson_ids)
    except Exception as e:
        print("[!] Error checking syllabus completion:", e)
        return False
    finally:
        conn.close()

def check_and_finalize_course_completion(user_id: int, course_id: int) -> bool:
    # Deprecated/Unused in new flow where only final exam triggers complete_enrollment,
    # but kept for schema compatibility or fallback logic.
    return False

def mentor_score_submission(submission_id: int, mentor_score: int, feedback: str, mentor_id: Optional[int] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        passed_val = 1 if mentor_score >= 80 else 0
        cursor.execute(
            """
            UPDATE quiz_submissions
            SET mentor_score = %s, mentor_feedback = %s, is_passed = %s
            WHERE id = %s
            """,
            (mentor_score, feedback, passed_val, submission_id)
        )
        conn.commit()
        
        cursor.execute(
            "SELECT user_id, course_id, course_title, lesson_id, is_final FROM quiz_submissions WHERE id = %s",
            (submission_id,)
        )
        sub = cursor.fetchone()
        if not sub:
            conn.close()
            return {"status": "error", "message": "Submission not found"}
            
        user_id = sub["user_id"]
        course_id = sub["course_id"]
        is_final_sub = (sub.get("is_final", 0) == 1 or sub["lesson_id"] is None)
        
        cursor.execute(
            "SELECT difficulty, tags, title FROM courses WHERE id = %s",
            (course_id,)
        )
        course = cursor.fetchone()
        conn.close()
        
        if course:
            # If the submission has a specific challenge/lesson title, we could use it, 
            # but generally the verified skill for finishing a course is the course title itself, 
            # or the title of the exam they just took.
            # We will use the sub["challenge_title"] if it's meaningful, else course["title"].
            # To fix the "java functions" issue, we'll avoid using tags[0] blindly.
            
            # Actually, let's get the lesson title if there's only one lesson, or use the challenge title.
            # But the simplest and most robust is to use the challenge_title or course_title.
            skill_name = sub.get("challenge_title") if sub.get("challenge_title") else course["title"]
            
            # Wait, if they say "lesson name is java OOPS", maybe we should fetch the lesson name
            conn_temp = get_db_connection()
            cur_temp = conn_temp.cursor()
            cur_temp.execute("SELECT title FROM course_lessons WHERE course_id = %s ORDER BY order_index ASC LIMIT 1", (course_id,))
            lesson_row = cur_temp.fetchone()
            conn_temp.close()
            
            if sub.get("lesson_id") is None and lesson_row:
                # If it's a final exam but there's a specific lesson, maybe they meant the lesson title?
                # Actually, course["title"] is the safest for a course certification.
                pass
                
            skill_name = lesson_row[0] if lesson_row else course["title"]
            difficulty = course["difficulty"]
        else:
            skill_name = sub["course_title"]
            difficulty = "Beginner"
            
        if is_final_sub:
            if mentor_score >= 80:
                import uuid
                cert_id = f"CERT-{uuid.uuid4().hex[:8].upper()}"
                xp_map = {"Beginner": 500, "Intermediate": 1000, "Expert": 2000}
                xp_earned = xp_map.get(difficulty, 500)
                complete_enrollment(
                    user_id=user_id,
                    course_id=course_id,
                    xp_earned=xp_earned,
                    certificate_id=cert_id,
                    skill_name=skill_name,
                    difficulty=difficulty,
                    verified_by_mentor_id=mentor_id
                )
            else:
                cert_id = None
                fail_enrollment(
                    user_id=user_id,
                    course_id=course_id,
                    skill_name=skill_name
                )
                
            # --- EMAIL AUTOMATION BLOCK ---
            # Fetch user email and username
            conn_email = get_db_connection()
            cur_email = conn_email.cursor()
            cur_email.execute("SELECT username, email FROM users WHERE id = %s", (user_id,))
            user_row = cur_email.fetchone()
            conn_email.close()
            
            if user_row and user_row[1]:
                cand_username = user_row[0]
                cand_email = user_row[1]
                cand_course_title = course["title"] if course else sub["course_title"]
                
                import threading
                from services.email_service import send_grade_email
                
                # Run the email sending in a background thread so it doesn't block the API response
                threading.Thread(
                    target=send_grade_email,
                    args=(cand_email, cand_username, cand_course_title, (mentor_score >= 80), feedback, cert_id)
                ).start()
            # ------------------------------
        else:
            # Lesson Exam: Once graded (pass or fail), revert status back to 'enrolled'
            # so student is not blocked.
            conn_sub = get_db_connection()
            cursor_sub = conn_sub.cursor()
            cursor_sub.execute(
                "UPDATE enrollments SET status = 'enrolled' WHERE user_id = %s AND course_id = %s",
                (user_id, course_id)
            )
            conn_sub.commit()
            conn_sub.close()
            
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def add_proctoring_violation(user_id: int, username: str, course_id: int, course_title: str, image_path: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            """
            INSERT INTO proctoring_violations (user_id, username, course_id, course_title, image_path)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
            """,
            (user_id, username, course_id, course_title, image_path)
        )
        violation_id = cursor.fetchone()["id"]
        conn.commit()
        return {"status": "success", "violation_id": violation_id}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_pending_violations() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT id, user_id, username, course_id, course_title, image_path, created_at
            FROM proctoring_violations
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        
        violations = []
        for r in rows:
            created_at_str = r["created_at"].isoformat() if isinstance(r["created_at"], datetime) else str(r["created_at"])
            violations.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "username": r["username"],
                "course_id": r["course_id"],
                "course_title": r["course_title"],
                "image_path": r["image_path"],
                "created_at": created_at_str
            })
        return violations
    except Exception as e:
        print("[!] Error fetching proctoring violations:", e)
        return []
    finally:
        conn.close()

def acknowledge_violation(violation_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            "SELECT image_path FROM proctoring_violations WHERE id = %s",
            (violation_id,)
        )
        row = cursor.fetchone()
        if not row:
            conn.close()
            return {"status": "error", "message": "Violation not found"}
            
        image_path = row["image_path"]
        
        cursor.execute(
            "DELETE FROM proctoring_violations WHERE id = %s",
            (violation_id,)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "image_path": image_path}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- Exam Attempt / Session helper functions ---

def start_exam_attempt(user_id: int, exam_id: int, exam_type: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check if attempt already exists
        cursor.execute(
            "SELECT id, status, started_at FROM exam_attempts WHERE user_id = %s AND exam_id = %s AND exam_type = %s",
            (user_id, exam_id, exam_type)
        )
        existing = cursor.fetchone()
        if existing:
            return {
                "status": "success",
                "attempt_id": existing["id"],
                "attempt_status": existing["status"],
                "started_at": existing["started_at"].isoformat() if hasattr(existing["started_at"], "isoformat") else str(existing["started_at"])
            }
        
        # Check if the exam itself is active before starting a NEW attempt
        is_active = False
        if exam_type == "final":
            cursor.execute("SELECT status FROM course_final_exams WHERE id = %s", (exam_id,))
        else:
            cursor.execute("SELECT status FROM course_assignments WHERE id = %s", (exam_id,))
        exam_row = cursor.fetchone()
        # If exam doesn't exist, we consider it not active
        if not exam_row:
            return {"status": "error", "message": "Exam not found."}
        if exam_row.get("status") == "ended" or exam_row.get("status") == "archived":
            return {"status": "error", "message": "Exam has already been ended by the mentor."}

        cursor.execute(
            """
            INSERT INTO exam_attempts (user_id, exam_id, exam_type, status, started_at)
            VALUES (%s, %s, %s, 'in_progress', CURRENT_TIMESTAMP) RETURNING id, started_at
            """,
            (user_id, exam_id, exam_type)
        )
        new_row = cursor.fetchone()
        conn.commit()
        return {
            "status": "success",
            "attempt_id": new_row["id"],
            "attempt_status": "in_progress",
            "started_at": new_row["started_at"].isoformat() if hasattr(new_row["started_at"], "isoformat") else str(new_row["started_at"])
        }
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def has_valid_attempt(user_id: int, exam_id: int, exam_type: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            "SELECT id FROM exam_attempts WHERE user_id = %s AND exam_id = %s AND exam_type = %s AND status = 'in_progress'",
            (user_id, exam_id, exam_type)
        )
        row = cursor.fetchone()
        return row is not None
    except Exception as e:
        print("[!] Error checking valid attempt:", e)
        return False
    finally:
        conn.close()

def complete_attempt(user_id: int, exam_id: int, exam_type: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            """
            UPDATE exam_attempts
            SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND exam_id = %s AND exam_type = %s AND status = 'in_progress'
            """,
            (user_id, exam_id, exam_type)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        conn.rollback()
        print("[!] Error completing attempt:", e)
        return False
    finally:
        conn.close()

# --- Exam Actions & Auditing ---

def log_exam_event(exam_id: int, exam_type: str, mentor_id: int, action: str, note: str = None) -> None:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            """
            INSERT INTO exam_events (exam_id, exam_type, mentor_id, action, note)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (exam_id, exam_type, mentor_id, action, note)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        print("[!] Error logging exam event:", e)
    finally:
        conn.close()

def end_exam(exam_id: int, exam_type: str, ended_by: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if exam_type == "final":
            cursor.execute(
                """
                UPDATE course_final_exams
                SET status = 'ended', ended_at = CURRENT_TIMESTAMP, ended_by = %s
                WHERE id = %s
                """,
                (ended_by, exam_id)
            )
        else:
            cursor.execute(
                """
                UPDATE course_assignments
                SET status = 'ended', ended_at = CURRENT_TIMESTAMP, ended_by = %s
                WHERE id = %s
                """,
                (ended_by, exam_id)
            )
        conn.commit()
        success = cursor.rowcount > 0
        if success:
            log_exam_event(exam_id, exam_type, ended_by, "ended", f"Exam ended by mentor ID {ended_by}")
        return success
    except Exception as e:
        conn.rollback()
        print("[!] Error ending exam:", e)
        return False
    finally:
        conn.close()

def reopen_exam(exam_id: int, exam_type: str, reopened_by: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if exam_type == "final":
            cursor.execute(
                """
                UPDATE course_final_exams
                SET status = 'active', ended_at = NULL, ended_by = NULL
                WHERE id = %s
                """,
                (exam_id,)
            )
        else:
            cursor.execute(
                """
                UPDATE course_assignments
                SET status = 'active', ended_at = NULL, ended_by = NULL
                WHERE id = %s
                """,
                (exam_id,)
            )
        conn.commit()
        success = cursor.rowcount > 0
        if success:
            log_exam_event(exam_id, exam_type, reopened_by, "reopened", f"Exam reopened by mentor ID {reopened_by}")
        return success
    except Exception as e:
        conn.rollback()
        print("[!] Error reopening exam:", e)
        return False
    finally:
        conn.close()

def archive_exam(exam_id: int, exam_type: str, archived_by: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if exam_type == "final":
            cursor.execute(
                """
                UPDATE course_final_exams
                SET status = 'archived'
                WHERE id = %s
                """,
                (exam_id,)
            )
        else:
            cursor.execute(
                """
                UPDATE course_assignments
                SET status = 'archived'
                WHERE id = %s
                """,
                (exam_id,)
            )
        conn.commit()
        success = cursor.rowcount > 0
        if success:
            log_exam_event(exam_id, exam_type, archived_by, "archived", f"Exam archived by mentor ID {archived_by}")
        return success
    except Exception as e:
        conn.rollback()
        print("[!] Error archiving exam:", e)
        return False
    finally:
        conn.close()

# --- Authorization Verification & Ownership Helpers ---

def verify_mentor_owns_course(mentor_id: int, course_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Admins own everything
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        if u and u["role"] == "admin":
            return True

        cursor.execute(
            "SELECT id FROM mentor_courses WHERE mentor_id = %s AND course_id = %s",
            (mentor_id, course_id)
        )
        return cursor.fetchone() is not None
    except Exception as e:
        print("[!] Error in verify_mentor_owns_course:", e)
        return False
    finally:
        conn.close()

def verify_submission_belongs_to_mentor(submission_id: int, mentor_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Admins own everything
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        if u and u["role"] == "admin":
            return True

        cursor.execute(
            """
            SELECT qs.course_id 
            FROM quiz_submissions qs
            JOIN mentor_courses mc ON mc.course_id = qs.course_id
            WHERE qs.id = %s AND mc.mentor_id = %s
            """,
            (submission_id, mentor_id)
        )
        return cursor.fetchone() is not None
    except Exception as e:
        print("[!] Error in verify_submission_belongs_to_mentor:", e)
        return False
    finally:
        conn.close()

def verify_exam_belongs_to_mentor(exam_id: int, exam_type: str, mentor_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Admins own everything
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        if u and u["role"] == "admin":
            return True

        if exam_type == "final":
            cursor.execute(
                """
                SELECT cfe.course_id 
                FROM course_final_exams cfe
                JOIN mentor_courses mc ON mc.course_id = cfe.course_id
                WHERE cfe.id = %s AND mc.mentor_id = %s
                """,
                (exam_id, mentor_id)
            )
        else:
            cursor.execute(
                """
                SELECT ce.course_id 
                FROM course_assignments ce
                JOIN mentor_courses mc ON mc.course_id = ce.course_id
                WHERE ce.id = %s AND mc.mentor_id = %s
                """,
                (exam_id, mentor_id)
            )
        return cursor.fetchone() is not None
    except Exception as e:
        print("[!] Error in verify_exam_belongs_to_mentor:", e)
        return False
    finally:
        conn.close()

# --- Filtered Dashboard & Scoped Submissions ---

def get_submissions_for_exam(exam_id: int, exam_type: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            """
            SELECT qs.id, qs.user_id, qs.username, qs.course_id, qs.course_title, qs.challenge_title, 
                   qs.student_code, qs.language, qs.ai_score, qs.mentor_score, qs.warnings, qs.is_passed, 
                   qs.feedback, qs.mentor_feedback, qs.lesson_id, qs.review_status, qs.exam_id, qs.exam_type, qs.created_at, qs.question_description
            FROM quiz_submissions qs
            WHERE qs.exam_id = %s AND qs.exam_type = %s
            ORDER BY qs.created_at DESC
            """,
            (exam_id, exam_type)
        )
        rows = cursor.fetchall()
        for r in rows:
            if hasattr(r["created_at"], "isoformat"):
                r["created_at"] = r["created_at"].isoformat()
            else:
                r["created_at"] = str(r["created_at"])
        return rows
    except Exception as e:
        print("[!] Error in get_submissions_for_exam:", e)
        return []
    finally:
        conn.close()

def get_latest_ended_exam_for_mentor(mentor_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Retrieve all course IDs this mentor owns
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        is_admin = u and u["role"] == "admin"

        query_params = ()
        if is_admin:
            course_filter = ""
        else:
            course_filter = "WHERE course_id IN (SELECT course_id FROM mentor_courses WHERE mentor_id = %s)"
            query_params = (mentor_id,)

        # Query ended lesson exams
        cursor.execute(
            f"""
            SELECT ce.id, ce.course_id, ce.lesson_id, ce.title, ce.status, ce.ended_at, ce.ended_by, 'lesson' as exam_type,
                   c.title as course_title
            FROM course_assignments ce
            JOIN courses c ON c.id = ce.course_id
            {course_filter.replace("course_id", "ce.course_id")} {"AND" if "WHERE" in course_filter else "WHERE"} ce.status = 'ended'
            """,
            query_params
        )
        lessons = cursor.fetchall()

        # Query ended final exams
        cursor.execute(
            f"""
            SELECT cfe.id, cfe.course_id, NULL as lesson_id, cfe.title, cfe.status, cfe.ended_at, cfe.ended_by, 'final' as exam_type,
                   c.title as course_title
            FROM course_final_exams cfe
            JOIN courses c ON c.id = cfe.course_id
            {course_filter.replace("course_id", "cfe.course_id")} {"AND" if "WHERE" in course_filter else "WHERE"} cfe.status = 'ended'
            """,
            query_params
        )
        finals = cursor.fetchall()

        all_ended = lessons + finals
        if not all_ended:
            return None

        # Sort by ended_at desc. If ended_at is None/missing, sort safely
        def get_ended_time(x):
            val = x.get("ended_at")
            if not val:
                return datetime.min
            if isinstance(val, str):
                try:
                    return datetime.fromisoformat(val)
                except Exception:
                    return datetime.min
            return val

        all_ended.sort(key=get_ended_time, reverse=True)
        latest = all_ended[0]
        if latest.get("ended_at") and hasattr(latest["ended_at"], "isoformat"):
            latest["ended_at"] = latest["ended_at"].isoformat()
        return latest
    except Exception as e:
        print("[!] Error in get_latest_ended_exam_for_mentor:", e)
        return None
    finally:
        conn.close()

def get_archived_exams_for_mentor(mentor_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        is_admin = u and u["role"] == "admin"

        query_params = ()
        if is_admin:
            course_filter = ""
        else:
            course_filter = "WHERE course_id IN (SELECT course_id FROM mentor_courses WHERE mentor_id = %s)"
            query_params = (mentor_id,)

        # Fetch all lesson exams in status 'ended' or 'archived'
        cursor.execute(
            f"""
            SELECT ce.id, ce.course_id, ce.lesson_id, ce.title, ce.status, ce.ended_at, ce.ended_by, 'lesson' as exam_type,
                   c.title as course_title
            FROM course_assignments ce
            JOIN courses c ON c.id = ce.course_id
            {course_filter.replace("course_id", "ce.course_id")} {"AND" if "WHERE" in course_filter else "WHERE"} ce.status IN ('ended', 'archived')
            """,
            query_params
        )
        lessons = cursor.fetchall()

        # Fetch final exams in status 'ended' or 'archived'
        cursor.execute(
            f"""
            SELECT cfe.id, cfe.course_id, NULL as lesson_id, cfe.title, cfe.status, cfe.ended_at, cfe.ended_by, 'final' as exam_type,
                   c.title as course_title
            FROM course_final_exams cfe
            JOIN courses c ON c.id = cfe.course_id
            {course_filter.replace("course_id", "cfe.course_id")} {"AND" if "WHERE" in course_filter else "WHERE"} cfe.status IN ('ended', 'archived')
            """,
            query_params
        )
        finals = cursor.fetchall()

        all_exams = lessons + finals
        # Sort by ended_at desc
        def get_ended_time(x):
            val = x.get("ended_at")
            if not val:
                return datetime.min
            if isinstance(val, str):
                try:
                    return datetime.fromisoformat(val)
                except Exception:
                    return datetime.min
            return val

        all_exams.sort(key=get_ended_time, reverse=True)

        for x in all_exams:
            if x.get("ended_at") and hasattr(x["ended_at"], "isoformat"):
                x["ended_at"] = x["ended_at"].isoformat()
            else:
                x["ended_at"] = str(x.get("ended_at"))
        return all_exams
    except Exception as e:
        print("[!] Error in get_archived_exams_for_mentor:", e)
        return []
    finally:
        conn.close()

def mentor_score_submission(submission_id: int, score: int, feedback: str, mentor_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Retrieve username of the mentor
        cursor.execute("SELECT username FROM users WHERE id = %s", (mentor_id,))
        m_row = cursor.fetchone()
        m_name = m_row["username"] if m_row else "Mentor"

        # Check if submission exists and get details
        cursor.execute(
            "SELECT exam_id, exam_type, course_id, user_id FROM quiz_submissions WHERE id = %s",
            (submission_id,)
        )
        sub_row = cursor.fetchone()
        if not sub_row:
            return {"status": "error", "message": "Submission not found."}

        exam_id = sub_row["exam_id"]
        exam_type = sub_row["exam_type"] or "lesson"

        # Update the submission
        passed_val = 1 if score >= 80 else 0
        cursor.execute(
            """
            UPDATE quiz_submissions
            SET mentor_score = %s, mentor_feedback = %s, review_status = 'reviewed', is_passed = %s
            WHERE id = %s
            """,
            (score, feedback, passed_val, submission_id)
        )
        conn.commit()

        if exam_type == "final":
            cursor.execute("SELECT title, difficulty, tags FROM courses WHERE id = %s", (sub_row["course_id"],))
            c_row = cursor.fetchone()
            if c_row:
                import json
                try:
                    tags = json.loads(c_row["tags"])
                except Exception:
                    tags = []
                skill_name = tags[0] if tags and len(tags) > 0 else c_row["title"]
                difficulty = c_row["difficulty"]
            else:
                skill_name = "Unknown Skill"
                difficulty = "Beginner"

            if passed_val == 1:
                import uuid
                cert_id = f"CERT-{uuid.uuid4().hex[:8].upper()}"
                xp_map = {"Beginner": 500, "Intermediate": 1000, "Expert": 2000}
                xp_earned = xp_map.get(difficulty, 500)
                
                complete_enrollment(
                    user_id=sub_row["user_id"],
                    course_id=sub_row["course_id"],
                    xp_earned=xp_earned,
                    certificate_id=cert_id,
                    skill_name=skill_name,
                    difficulty=difficulty,
                    verified_by_mentor_id=mentor_id
                )
            else:
                fail_enrollment(
                    user_id=sub_row["user_id"],
                    course_id=sub_row["course_id"],
                    skill_name=skill_name
                )
        else:
            # For lesson exams, if graded, revert status back to 'enrolled' to unblock student
            cursor.execute("UPDATE enrollments SET status = 'enrolled' WHERE user_id = %s AND course_id = %s",
                           (sub_row["user_id"], sub_row["course_id"]))
            conn.commit()

        # Log event
        log_exam_event(
            exam_id=exam_id if exam_id else 0,
            exam_type=exam_type,
            mentor_id=mentor_id,
            action="reviewed",
            note=f"Submission {submission_id} reviewed and graded as {score}/100 by {m_name}"
        )

        return {"status": "success", "message": "Submission successfully reviewed."}
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

def get_user_submissions_scoped(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            """
            SELECT id, user_id, username, course_id, course_title, challenge_title, 
                   student_code, language, ai_score, mentor_score, warnings, is_passed, 
                   feedback, mentor_feedback, lesson_id, review_status, exam_id, exam_type, created_at
            FROM quiz_submissions
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,)
        )
        rows = cursor.fetchall()
        for r in rows:
            if hasattr(r["created_at"], "isoformat"):
                r["created_at"] = r["created_at"].isoformat()
            else:
                r["created_at"] = str(r["created_at"])
            
            # Scoping: if review_status is 'pending', do not return AI score or mentor score or feedback to student
            if r.get("review_status") == "pending":
                r["ai_score"] = None
                r["mentor_score"] = None
                r["feedback"] = None
                r["mentor_feedback"] = None
        return rows
    except Exception as e:
        print("[!] Error in get_user_submissions_scoped:", e)
        return []
    finally:
        conn.close()

def get_all_exams_for_mentor(mentor_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        is_admin = u and u["role"] == "admin"

        query_params = ()
        if is_admin:
            course_filter = ""
        else:
            course_filter = "WHERE course_id IN (SELECT course_id FROM mentor_courses WHERE mentor_id = %s)"
            query_params = (mentor_id,)

        # Fetch lesson exams
        cursor.execute(
            f"""
            SELECT ce.id, ce.course_id, ce.lesson_id, ce.title, ce.difficulty, ce.language, ce.status, ce.ended_at, ce.ended_by, 'lesson' as exam_type,
                   c.title as course_title
            FROM course_assignments ce
            JOIN courses c ON c.id = ce.course_id
            {course_filter.replace("course_id", "ce.course_id")}
            """,
            query_params
        )
        lessons = cursor.fetchall()

        # Fetch final exams
        cursor.execute(
            f"""
            SELECT cfe.id, cfe.course_id, NULL as lesson_id, cfe.title, cfe.difficulty, cfe.language, cfe.status, cfe.ended_at, cfe.ended_by, 'final' as exam_type,
                   c.title as course_title
            FROM course_final_exams cfe
            JOIN courses c ON c.id = cfe.course_id
            {course_filter.replace("course_id", "cfe.course_id")}
            """,
            query_params
        )
        finals = cursor.fetchall()

        all_exams = lessons + finals
        for x in all_exams:
            if x.get("ended_at") and hasattr(x["ended_at"], "isoformat"):
                x["ended_at"] = x["ended_at"].isoformat()
            elif x.get("ended_at"):
                x["ended_at"] = str(x["ended_at"])
        return all_exams
    except Exception as e:
        print("[!] Error in get_all_exams_for_mentor:", e)
        return []
    finally:
        conn.close()

# --- Admin & Mentor Assignment functions ---

def get_all_courses_brief() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT c.id, c.title, c.description, c.difficulty, c.tags, c.created_at, c.chatbot_enabled, c.status, u.username as mentor_name,
                   (SELECT MAX(created_at) FROM course_deletion_events WHERE course_id = c.id AND action = 'deleted') as deleted_at
            FROM courses c
            JOIN users u ON u.id = c.created_by
            ORDER BY c.created_at DESC
        """)
        rows = cursor.fetchall()
        courses_list = []
        for r in rows:
            try:
                tags = json.loads(r["tags"])
            except Exception:
                tags = []
            
            del_at = r.get("deleted_at")
            if del_at and hasattr(del_at, "isoformat"):
                del_at_str = del_at.isoformat()
            elif del_at:
                del_at_str = str(del_at)
            else:
                del_at_str = None

            courses_list.append({
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "difficulty": r["difficulty"],
                "tags": tags,
                "mentor_name": r["mentor_name"],
                "chatbot_enabled": bool(r.get("chatbot_enabled", 1)),
                "status": r.get("status", "active"),
                "deleted_at": del_at_str,
                "created_at": r["created_at"].isoformat() if isinstance(r["created_at"], datetime) else str(r["created_at"])
            })
        return courses_list
    except Exception as e:
        print("[!] Error in get_all_courses_brief:", e)
        return []
    finally:
        conn.close()


def get_all_mentors() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT id, username as name, email FROM users WHERE role = 'mentor' ORDER BY username ASC")
        return cursor.fetchall()
    except Exception as e:
        print("[!] Error in get_all_mentors:", e)
        return []
    finally:
        conn.close()

def get_course_mentors(course_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT u.id, u.username as name, u.email, mc.assigned_at, admin.username as assigned_by
            FROM users u
            JOIN mentor_courses mc ON mc.mentor_id = u.id
            LEFT JOIN users admin ON admin.id = mc.assigned_by
            WHERE mc.course_id = %s
            ORDER BY u.username ASC
        """, (course_id,))
        return cursor.fetchall()
    except Exception as e:
        print("[!] Error in get_course_mentors:", e)
        return []
    finally:
        conn.close()

def get_available_mentors_for_course(course_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT u.id, u.username as name, u.email
            FROM users u
            WHERE u.role = 'mentor'
              AND u.id NOT IN (SELECT mentor_id FROM mentor_courses WHERE course_id = %s)
            ORDER BY u.username ASC
        """, (course_id,))
        return cursor.fetchall()
    except Exception as e:
        print("[!] Error in get_available_mentors_for_course:", e)
        return []
    finally:
        conn.close()

def log_assignment_event(admin_id: int, mentor_id: int, course_id: int, action: str):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            """
            INSERT INTO mentor_assignment_events (admin_id, mentor_id, course_id, action)
            VALUES (%s, %s, %s, %s)
            """,
            (admin_id, mentor_id, course_id, action)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        print("[!] Error logging mentor assignment event:", e)
    finally:
        conn.close()

def assign_mentor_to_course(admin_id: int, mentor_id: int, course_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Verify mentor exists and has correct role
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        if not u:
            return {"success": False, "message": "Mentor does not exist."}
        if u["role"] != "mentor":
            return {"success": False, "message": "User role is not mentor."}

        # Verify course exists
        cursor.execute("SELECT id FROM courses WHERE id = %s", (course_id,))
        if not cursor.fetchone():
            return {"success": False, "message": "Course does not exist."}

        # Verify duplicate
        cursor.execute("SELECT id FROM mentor_courses WHERE mentor_id = %s AND course_id = %s", (mentor_id, course_id))
        if cursor.fetchone():
            return {"success": False, "message": "Mentor is already assigned to this course."}

        # Perform insertion
        cursor.execute("INSERT INTO mentor_courses (mentor_id, course_id, assigned_by) VALUES (%s, %s, %s)", (mentor_id, course_id, admin_id))
        conn.commit()

        # Log audit trail
        log_assignment_event(admin_id, mentor_id, course_id, "assigned")

        return {"success": True, "message": "Mentor assigned successfully."}
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": str(e)}
    finally:
        conn.close()

def remove_mentor_from_course(admin_id: int, mentor_id: int, course_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check mentor exists
        cursor.execute("SELECT id FROM users WHERE id = %s", (mentor_id,))
        if not cursor.fetchone():
            return {"success": False, "message": "Mentor does not exist."}

        # Check course exists
        cursor.execute("SELECT id FROM courses WHERE id = %s", (course_id,))
        if not cursor.fetchone():
            return {"success": False, "message": "Course does not exist."}

        # Check mapping exists
        cursor.execute("SELECT id FROM mentor_courses WHERE mentor_id = %s AND course_id = %s", (mentor_id, course_id))
        if not cursor.fetchone():
            return {"success": False, "message": "Assignment does not exist."}

        # Race condition protection: Lock rows and count in same transaction
        if IS_SQLITE:
            # Under SQLite, 'FOR UPDATE' row-level locks are not supported.
            # To ensure transaction safety and prevent orphan courses during concurrent removals,
            # we acquire a 'BEGIN IMMEDIATE' write lock on the database.
            cursor.execute("BEGIN IMMEDIATE")
        else:
            # Under PostgreSQL, we use row-level locking via 'FOR UPDATE' to block concurrent reads
            # on the target course assignments until the transaction commits or rolls back.
            cursor.execute("SELECT * FROM mentor_courses WHERE course_id = %s FOR UPDATE", (course_id,))
        
        # Count inside transaction after locking
        cursor.execute("SELECT COUNT(*) as count FROM mentor_courses WHERE course_id = %s", (course_id,))
        count_row = cursor.fetchone()
        count = count_row["count"] if count_row else 0
        
        if count <= 1:
            conn.rollback()
            return {"success": False, "message": "Course will still need at least one mentor after removal. Reverting."}

        # Perform deletion
        cursor.execute("DELETE FROM mentor_courses WHERE mentor_id = %s AND course_id = %s", (mentor_id, course_id))
        conn.commit()

        # Log audit trail
        log_assignment_event(admin_id, mentor_id, course_id, "removed")

        return {"success": True, "message": "Mentor removed successfully."}
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": str(e)}
    finally:
        conn.close()


def get_mentor_assignment_events_paginated(page: int, limit: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT COUNT(*) as count FROM mentor_assignment_events")
        total = cursor.fetchone()["count"]
        
        offset = (page - 1) * limit
        pages = (total + limit - 1) // limit if total > 0 else 0
        
        cursor.execute(
            """
            SELECT mae.id, c.title as course, u_mentor.username as mentor,
                   mae.action, mae.created_at as timestamp, u_admin.username as admin
            FROM mentor_assignment_events mae
            JOIN courses c ON c.id = mae.course_id
            JOIN users u_mentor ON u_mentor.id = mae.mentor_id
            JOIN users u_admin ON u_admin.id = mae.admin_id
            ORDER BY mae.created_at DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset)
        )
        rows = cursor.fetchall()
        
        items = []
        for r in rows:
            timestamp_str = r["timestamp"].isoformat() if isinstance(r["timestamp"], datetime) else str(r["timestamp"])
            items.append({
                "id": r["id"],
                "course": r["course"],
                "mentor": r["mentor"],
                "action": r["action"],
                "timestamp": timestamp_str,
                "admin": r["admin"]
            })
            
        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages
        }
    except Exception as e:
        print("[!] Error in get_mentor_assignment_events_paginated:", e)
        return {
            "items": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "pages": 0
        }
    finally:
        conn.close()

def get_mentor_courses(mentor_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check role of the mentor
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        is_admin = u and u["role"] == "admin"

        if is_admin:
            cursor.execute("""
                SELECT c.id, c.title, c.description, c.difficulty, c.tags, c.created_at, c.chatbot_enabled, u.username as mentor_name
                FROM courses c
                JOIN users u ON u.id = c.created_by
                ORDER BY c.created_at DESC
            """)
        else:
            cursor.execute("""
                SELECT c.id, c.title, c.description, c.difficulty, c.tags, c.created_at, c.chatbot_enabled, u.username as mentor_name
                FROM courses c
                JOIN users u ON u.id = c.created_by
                JOIN mentor_courses mc ON mc.course_id = c.id
                WHERE mc.mentor_id = %s
                ORDER BY c.created_at DESC
            """, (mentor_id,))
        rows = cursor.fetchall()
        
        courses_list = []
        for r in rows:
            try:
                tags = json.loads(r["tags"])
            except Exception:
                tags = []
            courses_list.append({
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "difficulty": r["difficulty"],
                "tags": tags,
                "mentor_name": r["mentor_name"],
                "chatbot_enabled": bool(r.get("chatbot_enabled", 1)),
                "created_at": r["created_at"].isoformat() if isinstance(r["created_at"], datetime) else str(r["created_at"])
            })
        return courses_list
    except Exception as e:
        print("[!] Error in get_mentor_courses:", e)
        return []
    finally:
        conn.close()

def update_exam(exam_id: int, exam_type: str, title: str, description: str, difficulty: str, language: str, boilerplate_code: str, test_cases: List[Dict[str, Any]], optimal_solution_explanation: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        test_cases_json = json.dumps(test_cases)
        if exam_type == "final":
            cursor.execute(
                """
                UPDATE course_final_exams
                SET title = %s, description = %s, difficulty = %s, language = %s, boilerplate_code = %s, test_cases = %s, optimal_solution_explanation = %s
                WHERE id = %s
                """,
                (title, description, difficulty, language, boilerplate_code, test_cases_json, optimal_solution_explanation, exam_id)
            )
        else:
            cursor.execute(
                """
                UPDATE course_assignments
                SET title = %s, description = %s, difficulty = %s, language = %s, boilerplate_code = %s, test_cases = %s, optimal_solution_explanation = %s
                WHERE id = %s
                """,
                (title, description, difficulty, language, boilerplate_code, test_cases_json, optimal_solution_explanation, exam_id)
            )
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        conn.rollback()
        print("[!] Error updating exam:", e)
        return False
    finally:
        conn.close()

def delete_exam(exam_id: int, exam_type: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if exam_type == "final":
            cursor.execute("DELETE FROM course_final_exams WHERE id = %s", (exam_id,))
        else:
            cursor.execute("DELETE FROM course_assignments WHERE id = %s", (exam_id,))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        conn.rollback()
        print("[!] Error deleting exam:", e)
        return False
    finally:
        conn.close()

def get_mentor_submissions(mentor_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check if admin
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        is_admin = u and u["role"] == "admin"

        if is_admin:
            cursor.execute("""
                SELECT id, user_id, username, course_id, course_title, challenge_title, student_code, language, ai_score, mentor_score, warnings, is_passed, feedback, mentor_feedback, created_at, lesson_id, is_final, exam_id, exam_type, review_status
                FROM quiz_submissions
                ORDER BY created_at DESC
            """)
        else:
            cursor.execute("""
                SELECT qs.id, qs.user_id, qs.username, qs.course_id, qs.course_title, qs.challenge_title, qs.student_code, qs.language, qs.ai_score, qs.mentor_score, qs.warnings, qs.is_passed, qs.feedback, qs.mentor_feedback, qs.created_at, qs.lesson_id, qs.is_final, qs.exam_id, qs.exam_type, qs.review_status
                FROM quiz_submissions qs
                JOIN mentor_courses mc ON mc.course_id = qs.course_id
                WHERE mc.mentor_id = %s
                ORDER BY qs.created_at DESC
            """, (mentor_id,))
        rows = cursor.fetchall()
        
        subs = []
        for r in rows:
            created_at_str = r["created_at"].isoformat() if isinstance(r["created_at"], datetime) else str(r["created_at"])
            subs.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "username": r["username"],
                "course_id": r["course_id"],
                "course_title": r["course_title"],
                "challenge_title": r["challenge_title"],
                "student_code": r["student_code"],
                "language": r["language"],
                "ai_score": r["ai_score"],
                "mentor_score": r["mentor_score"],
                "warnings": r["warnings"],
                "is_passed": bool(r["is_passed"]),
                "feedback": r["feedback"],
                "mentor_feedback": r.get("mentor_feedback"),
                "created_at": created_at_str,
                "lesson_id": r["lesson_id"],
                "is_final": bool(r.get("is_final", 0)),
                "exam_id": r.get("exam_id"),
                "exam_type": r.get("exam_type", "lesson"),
                "review_status": r.get("review_status", "pending")
            })
        return subs
    except Exception as e:
        print("[!] Error in get_mentor_submissions:", e)
        return []
    finally:
        conn.close()


def get_course_deletion_summary(course_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Get course title
        cursor.execute("SELECT title FROM courses WHERE id = %s", (course_id,))
        course_row = cursor.fetchone()
        if not course_row:
            return None
        
        course_name = course_row["title"]
        
        cursor.execute("SELECT COUNT(*) as count FROM course_lessons WHERE course_id = %s", (course_id,))
        lessons = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM course_assignments WHERE course_id = %s", (course_id,))
        lesson_exams = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM course_final_exams WHERE course_id = %s", (course_id,))
        final_exams = cursor.fetchone()["count"]
        
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM enrollments e
            JOIN users u ON e.user_id = u.id
            WHERE e.course_id = %s AND u.role = 'candidate'
        """, (course_id,))
        enrollments = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM mentor_courses WHERE course_id = %s", (course_id,))
        mentor_assignments = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM quiz_submissions WHERE course_id = %s", (course_id,))
        quiz_submissions = cursor.fetchone()["count"]
        
        cursor.execute("""
            SELECT COUNT(*) as count FROM exam_attempts
            WHERE (exam_type = 'lesson' AND exam_id IN (SELECT id FROM course_assignments WHERE course_id = %s))
               OR (exam_type = 'final' AND exam_id IN (SELECT id FROM course_final_exams WHERE course_id = %s))
        """, (course_id, course_id))
        exam_attempts = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM quiz_submissions WHERE course_id = %s AND review_status = 'reviewed'", (course_id,))
        reviewed_submissions = cursor.fetchone()["count"]
        
        return {
            "course_name": course_name,
            "lessons": lessons,
            "lesson_exams": lesson_exams,
            "final_exams": final_exams,
            "enrollments": enrollments,
            "mentor_assignments": mentor_assignments,
            "quiz_submissions": quiz_submissions,
            "exam_attempts": exam_attempts,
            "reviewed_submissions": reviewed_submissions
        }
    except Exception as e:
        print("[!] Error in get_course_deletion_summary:", e)
        return None
    finally:
        conn.close()


def execute_course_purge(course_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Fetch exam_id lists to delete attempts manually since there is no CASCADE
        cursor.execute("SELECT id FROM course_assignments WHERE course_id = %s", (course_id,))
        lesson_exam_ids = [row["id"] if isinstance(row, dict) else row[0] for row in cursor.fetchall()]
        
        cursor.execute("SELECT id FROM course_final_exams WHERE course_id = %s", (course_id,))
        final_exam_ids = [row["id"] if isinstance(row, dict) else row[0] for row in cursor.fetchall()]
        
        # 1. Delete exam_attempts
        if lesson_exam_ids:
            placeholders = ",".join(["%s"] * len(lesson_exam_ids))
            cursor.execute(f"DELETE FROM exam_attempts WHERE exam_type = 'lesson' AND exam_id IN ({placeholders})", tuple(lesson_exam_ids))
        if final_exam_ids:
            placeholders = ",".join(["%s"] * len(final_exam_ids))
            cursor.execute(f"DELETE FROM exam_attempts WHERE exam_type = 'final' AND exam_id IN ({placeholders})", tuple(final_exam_ids))
            
        # 2. Delete certificates
        cursor.execute("DELETE FROM certificates WHERE course_id = %s", (course_id,))
        
        # 3. Delete proctoring_violations
        cursor.execute("DELETE FROM proctoring_violations WHERE course_id = %s", (course_id,))
        
        # 4. Delete quiz_submissions
        cursor.execute("DELETE FROM quiz_submissions WHERE course_id = %s", (course_id,))
        
        # 5. Delete mentor_courses mappings
        cursor.execute("DELETE FROM mentor_courses WHERE course_id = %s", (course_id,))
        
        # 6. Delete enrollments
        cursor.execute("DELETE FROM enrollments WHERE course_id = %s", (course_id,))
        
        # 7. Delete course_final_exams
        cursor.execute("DELETE FROM course_final_exams WHERE course_id = %s", (course_id,))
        
        # 8. Delete course_assignments
        cursor.execute("DELETE FROM course_assignments WHERE course_id = %s", (course_id,))
        
        # 9. Delete course_lessons
        cursor.execute("DELETE FROM course_lessons WHERE course_id = %s", (course_id,))
        
        # 10. Delete course itself
        cursor.execute("DELETE FROM courses WHERE id = %s", (course_id,))
        
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print("[!] Error in execute_course_purge:", e)
        raise e
    finally:
        conn.close()
