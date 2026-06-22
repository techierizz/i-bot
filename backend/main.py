
from database import (
    get_courses,
    get_course_details,
    enroll_user_in_course,
    get_user_enrollments,
    complete_enrollment,
    fail_enrollment,
    get_user_certificates,
    get_user_skills,
    create_course,
    create_lesson,
    create_quiz_submission,
    get_quiz_submissions,
    mentor_score_submission,
    add_proctoring_violation,
    get_pending_violations,
    acknowledge_violation,
    submit_enrollment,
    create_course_exam,
    get_course_exam,
    create_course_final_exam,
    get_course_final_exam,
    get_certificate_by_id,
    check_syllabus_completion,
    check_and_finalize_course_completion,
    start_exam_attempt,
    has_valid_attempt,
    complete_attempt,
    end_exam,
    reopen_exam,
    archive_exam,
    verify_mentor_owns_course,
    verify_submission_belongs_to_mentor,
    verify_exam_belongs_to_mentor,
    get_submissions_for_exam,
    get_latest_ended_exam_for_mentor,
    get_archived_exams_for_mentor,
    get_user_submissions_scoped,
    get_all_exams_for_mentor,
    update_exam,
    delete_exam,
    log_exam_event,
    get_all_courses_brief,
    get_all_mentors,
    get_course_mentors,
    get_available_mentors_for_course,
    log_assignment_event,
    assign_mentor_to_course,
    remove_mentor_from_course,
    get_mentor_assignment_events_paginated,
    get_mentor_courses,
    get_mentor_submissions,
    get_course_deletion_summary,
    execute_course_purge
)
from services.learning_service import generate_ai_quiz, generate_ai_coding_challenge, generate_lesson_explanation_ai, generate_exam_for_lesson_ai, generate_final_exam_ai

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pypdf
import io
import json
import tempfile
import subprocess
import os
from services.llm_service import extract_resume_context
from services.interview_service import generate_interview_response, evaluate_interview
from services.email_service import send_study_reminder

active_simulations = {}

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import (
    init_db,
    create_user,
    authenticate_user,
    save_evaluation,
    get_admin_metrics,
    get_all_evaluations,
    delete_evaluation,
    get_user_gamification,
    add_xp_to_user,
    get_leaderboard,
    create_roadmap_tasks,
    save_user_resume,
    get_latest_user_resume,
    get_user_roadmap_tasks,
    complete_roadmap_task,
    get_users_with_pending_tasks,
)

app = FastAPI(title="HireMind AI Backend", description="Backend for the autonomous AI interview simulator")

# Ensure static directories exist at module load time
import os
os.makedirs("static/videos", exist_ok=True)
from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configure CORS — allow deployed frontend + localhost dev
import os as _os
_frontend_url = _os.getenv("FRONTEND_URL", "http://localhost:3000")
_allowed_origins = [
    "http://localhost:3000",
    _frontend_url,
]
# Remove duplicates
_allowed_origins = list(set(_allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup hook to initialize SQLite database
@app.on_event("startup")
def on_startup():
    init_db()

class AdminRequiredException(HTTPException):
    def __init__(self, message: str = "Administrator privileges required."):
        self.message = message
        super().__init__(status_code=403, detail=message)

class AssignedCourseException(HTTPException):
    def __init__(self, message: str = "You are not assigned to this course."):
        self.message = message
        super().__init__(status_code=403, detail=message)


@app.exception_handler(AdminRequiredException)
def admin_required_exception_handler(request: Request, exc: AdminRequiredException):
    return JSONResponse(
        status_code=403,
        content={"message": exc.message}
    )

@app.exception_handler(AssignedCourseException)
def assigned_course_exception_handler(request: Request, exc: AssignedCourseException):
    return JSONResponse(
        status_code=403,
        content={"message": exc.message}
    )

def require_admin(admin_id: int):
    from database import get_db_connection, RealDictCursor
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT role FROM users WHERE id = %s", (admin_id,))
        user = cursor.fetchone()
        if not user or user["role"] != "admin":
            raise AdminRequiredException("Administrator privileges required.")
    finally:
        conn.close()



# Request schemas
class ChatRequest(BaseModel):
    context: Dict[str, Any]
    chat_history: List[Dict[str, str]]
    latest_user_response: str

class EvaluationRequest(BaseModel):
    context: Dict[str, Any]
    chat_history: List[Dict[str, Any]]

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "candidate"

class LoginRequest(BaseModel):
    username: str
    password: str
    role: str = "candidate"

class SettingsUpdateRequest(BaseModel):
    prompt_temp: Optional[float] = None
    system_prompt: Optional[str] = None

class SignatureUpdateRequest(BaseModel):
    signature_data: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# Endpoints
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "HireMind AI API"}

@app.get("/")
def root():
    return {"message": "Welcome to HireMind AI API"}

# Authentication routes
@app.post("/api/auth/register")
def register_candidate(req: RegisterRequest):
    res = create_user(req.username, req.email, req.password, role=req.role)
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/auth/login")
def login_candidate(req: LoginRequest):
    user = authenticate_user(req.username, req.password, role=req.role)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username, password, or role.")
    return {"status": "success", "user": user}

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    from database import get_user_email, create_password_reset_token
    from services.email_service import send_password_reset_email
    
    # We always return success to prevent email enumeration attacks
    # but we only send the email if a valid token is generated
    token = create_password_reset_token(req.email)
    
    email_sent = False
    error_msg = ""
    if token:
        # User is valid, send email
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        reset_link = f"{frontend_url}/login?mode=reset&token={token}"
        email_sent, error_msg = send_password_reset_email(req.email, reset_link)
        
    if email_sent:
        return {"status": "success", "message": "If that email is registered, a password reset link has been sent. (Email Sent: True)"}
    else:
        return {"status": "success", "message": f"If that email is registered, a password reset link has been sent. (Email Sent: False | Error: {error_msg})"}

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    from database import verify_and_use_password_reset_token
    import hashlib
    import uuid
    
    # Hash the new password (simple hash implementation similar to database.py)
    salt = uuid.uuid4().hex
    password_hash = hashlib.sha256(salt.encode() + req.new_password.encode()).hexdigest()
    db_password_hash = f"{password_hash}:{salt}"
    
    success = verify_and_use_password_reset_token(req.token, db_password_hash)
    
    if success:
        return {"status": "success", "message": "Password has been successfully reset."}
    else:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")


@app.post("/api/auth/admin/login")
def login_admin(req: LoginRequest):
    user = authenticate_user(req.username, req.password, role="admin")
    if not user:
        raise HTTPException(status_code=401, detail="Invalid administrator credentials.")
    return {"status": "success", "user": user}

# Admin Settings Routes
@app.get("/api/admin/settings")
def get_settings():
    from database import get_system_settings
    settings = get_system_settings()
    return {
        "prompt_temp": float(settings.get("prompt_temp", 0.7)),
        "system_prompt": settings.get("system_prompt", "")
    }

@app.post("/api/admin/settings")
def update_settings(req: SettingsUpdateRequest):
    from database import update_system_settings
    updates = {}
    if req.prompt_temp is not None:
        updates["prompt_temp"] = req.prompt_temp
    if req.system_prompt is not None:
        updates["system_prompt"] = req.system_prompt
    
    if updates:
        update_system_settings(updates)
    return {"status": "success"}

@app.get("/api/user/{user_id}/performance_insights")
def get_user_performance_insights(user_id: int):
    from database import get_performance_insights
    import json
    
    insights = get_performance_insights(user_id)
    if not insights:
        return {"status": "success", "data": None}
        
    for key in ["best_interview", "worst_interview"]:
        interview = insights.get(key)
        if interview:
            if isinstance(interview.get("evaluation_data"), str):
                interview["evaluation_data"] = json.loads(interview["evaluation_data"])
            if isinstance(interview.get("transcript"), str):
                interview["transcript"] = json.loads(interview["transcript"])
            if interview.get("created_at"):
                if hasattr(interview["created_at"], "isoformat"):
                    interview["created_at"] = interview["created_at"].isoformat()
        
    return {"status": "success", "data": insights}

@app.get("/api/user/{user_id}/stats")
def get_user_statistics(user_id: int):
    from database import get_user_stats
    try:
        stats = get_user_stats(user_id)
        return {"status": "success", "data": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user/{user_id}/signature")
def update_user_signature(user_id: int, req: SignatureUpdateRequest):
    from database import update_signature
    try:
        success = update_signature(user_id, req.signature_data)
        if success:
            return {"status": "success", "message": "Signature updated."}
        else:
            raise HTTPException(status_code=400, detail="Failed to update signature.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Candidate Resume setup
@app.post("/api/setup/upload")
async def upload_resume(
    file: UploadFile = File(...),
    mode: str = Form("General"),
    persona: str = Form("Friendly"),
    user_id: Optional[int] = Form(None)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        pdf_bytes = await file.read()
        pdf_reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        
        resume_text = ""
        for page in pdf_reader.pages:
            resume_text += page.extract_text() + "\n"
            
        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the PDF.")
            
        extracted_context = extract_resume_context(resume_text)

        # Save extracted experiences to the database
        if user_id and extracted_context.get("work_experiences"):
            from database import get_db_connection
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                # First delete any existing unverified experiences for this user (to reset if they upload a new resume)
                cursor.execute("DELETE FROM user_experiences WHERE user_id = %s", (user_id,))
                
                for exp in extracted_context["work_experiences"]:
                    company = exp.get("company", "Unknown")
                    role = exp.get("role", "Unknown")
                    start_date = exp.get("start_date", "")
                    end_date = exp.get("end_date", "")
                    
                    cursor.execute(
                        "INSERT INTO user_experiences (user_id, company, role, start_date, end_date) VALUES (%s, %s, %s, %s, %s)",
                        (user_id, company, role, start_date, end_date)
                    )
                
                # Also save the raw resume to the database immediately!
                cursor.execute(
                    """INSERT INTO user_resumes (user_id, raw_text) 
                       VALUES (%s, %s) 
                       ON CONFLICT (user_id) DO UPDATE 
                       SET raw_text = EXCLUDED.raw_text, created_at = CURRENT_TIMESTAMP""",
                    (user_id, resume_text)
                )
                conn.commit()
            except Exception as e:
                print(f"Error saving experiences: {e}")
                conn.rollback()
            finally:
                conn.close()

        return {
            "status": "success",
            "message": "Resume parsed successfully.",
            "data": {
                "interview_mode": mode,
                "persona": persona,
                "extracted_context": extracted_context,
                "raw_resume_text": resume_text,
                "raw_text_preview": resume_text[:200] + "..."
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing resume: {str(e)}")

@app.post("/api/interview/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response_data = generate_interview_response(
            context=request.context,
            chat_history=request.chat_history,
            latest_user_response=request.latest_user_response
        )
        return {"status": "success", "data": response_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")

@app.post("/api/interview/evaluate")
async def evaluate_endpoint(request: EvaluationRequest):
    try:
        evaluation_data = evaluate_interview(
            context=request.context,
            chat_history=request.chat_history
        )
        
        # Resolve user identity from nested context
        extracted_context = request.context.get("extracted_context", {})
        user_id = (
            request.context.get("user_id") or 
            request.context.get("user", {}).get("id") or 
            extracted_context.get("user_id") or
            extracted_context.get("user", {}).get("id")
        )
        username = (
            request.context.get("username") or
            request.context.get("user", {}).get("username") or
            extracted_context.get("username") or
            extracted_context.get("user", {}).get("username") or
            "Anonymous"
        )
        
        # Count actual user turns (not just total messages)
        user_turns = 0
        for msg in request.chat_history:
            if isinstance(msg, dict):
                if msg.get("role") in ("user", "candidate"):
                    user_turns += 1
                # Also check for dict-key format like {"user": "some text"}
                elif "user" in msg or "candidate" in msg:
                    user_turns += 1
        
        MIN_USER_TURNS = 2  # Must answer at least 2 questions to earn XP
        is_meaningful = user_turns >= MIN_USER_TURNS
        
        gamification_result = None
        if user_id:
            try:
                # Always save the evaluation record (even for short sessions)
                eval_id = save_evaluation(
                    user_id=int(user_id),
                    username=username,
                    mode=request.context.get("interview_mode", "General"),
                    overall=int(evaluation_data["scores"]["overall"]),
                    technical=int(evaluation_data["scores"]["technical"]),
                    communication=int(evaluation_data["scores"]["communication"]),
                    confidence=int(evaluation_data["scores"]["confidence"]),
                    problem_solving=int(evaluation_data["scores"]["problem_solving"]),
                    transcript=request.chat_history,
                    evaluation_data=evaluation_data
                )
                evaluation_data["id"] = eval_id
                # Extract roadmap tasks
                roadmap_tasks = []
                for week in evaluation_data.get("roadmap", []):
                    for action in week.get("actions", []):
                        roadmap_tasks.append(f"{week.get('topic', 'Study')}: {action}")
                
                # Save roadmap tasks
                create_roadmap_tasks(user_id=int(user_id), eval_id=eval_id, tasks=roadmap_tasks)
                print(f"[*] Evaluation and Roadmap tasks logged for user_id={user_id} (user_turns={user_turns})")
                
                # Update User Resume ATS feedback if a resume was used
                raw_resume_text = request.context.get("raw_resume_text") or request.context.get("extracted_context", {}).get("raw_resume_text")
                if raw_resume_text and "resume_optimizer" in evaluation_data:
                    save_user_resume(
                        user_id=int(user_id), 
                        raw_text=raw_resume_text,
                        ats_feedback_json=json.dumps(evaluation_data["resume_optimizer"])
                    )
                # Only award XP if the interview was meaningful
                if is_meaningful:
                    xp_earned = evaluation_data.get("xp_earned", 1000)
                    new_badges = [a["id"] for a in evaluation_data.get("achievements", [])]
                    gamification_result = add_xp_to_user(
                        user_id=int(user_id),
                        xp_earned=xp_earned,
                        new_badge_ids=new_badges
                    )
                    print(f"[*] Gamification updated: level={gamification_result['level']}, total_xp={gamification_result['total_xp']}")
                else:
                    print(f"[!] Skipping XP: only {user_turns} user turns (minimum {MIN_USER_TURNS})")
                    # Return current gamification state without adding XP
                    from database import get_user_gamification
                    current_state = get_user_gamification(int(user_id))
                    gamification_result = {
                        **current_state,
                        "xp_earned": 0,
                        "xp_base": 0,
                        "xp_bonus": 0,
                        "streak_multiplier": 1.0,
                        "level_up": False,
                        "new_badges": [],
                        "all_badges": current_state.get("badges", []),
                        "skipped_reason": f"Interview too short ({user_turns} answers, need {MIN_USER_TURNS}+)"
                    }
                    # Override evaluation XP to 0 for the frontend
                    evaluation_data["xp_earned"] = 0
                    evaluation_data["achievements"] = []
                
            except Exception as db_err:
                print(f"[!] Database/gamification error: {str(db_err)}")
                
        return {
            "status": "success",
            "data": evaluation_data,
            "gamification": gamification_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluating interview: {str(e)}")

# Gamification endpoints
@app.get("/api/gamification/{user_id}")
def fetch_user_gamification(user_id: int):
    try:
        return get_user_gamification(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/leaderboard")
def fetch_leaderboard():
    try:
        return get_leaderboard(limit=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Admin panel actions
@app.get("/api/admin/metrics")
def fetch_admin_metrics():
    try:
        return get_admin_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/candidates")
def fetch_admin_candidates():
    try:
        return get_all_evaluations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/admin/evaluation/{id}")
def delete_candidate_evaluation(id: int):
    try:
        success = delete_evaluation(id)
        if not success:
            raise HTTPException(status_code=404, detail="Evaluation record not found.")
        return {"status": "success", "message": "Evaluation record successfully deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Experience Validation Endpoints

@app.get("/api/user/{user_id}/experiences")
def get_user_experiences(user_id: int):
    from database import get_db_connection
    from psycopg2.extras import RealDictCursor
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT * FROM user_experiences WHERE user_id = %s ORDER BY id DESC", (user_id,))
        experiences = cursor.fetchall()
        
        cursor.execute("SELECT fraud_strikes, is_fraudulent FROM users WHERE id = %s", (user_id,))
        user_info = cursor.fetchone()
        
        return {
            "status": "success", 
            "data": {
                "experiences": [dict(e) for e in experiences],
                "is_fraudulent": user_info["is_fraudulent"] if user_info else False
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/experiences/validate")
async def validate_experience(
    experience_id: int = Form(...),
    user_id: int = Form(...),
    file: UploadFile = File(...)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Must upload an image (PNG/JPG).")
        
    image_bytes = await file.read()
    
    from database import get_db_connection
    from psycopg2.extras import RealDictCursor
    from services.llm_service import validate_certificate
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Fetch experience details and user name
        cursor.execute("SELECT * FROM user_experiences WHERE id = %s AND user_id = %s", (experience_id, user_id))
        exp = cursor.fetchone()
        
        cursor.execute("SELECT username FROM users WHERE id = %s", (user_id,))
        user_row = cursor.fetchone()
        candidate_name = user_row["username"] if user_row else "the candidate"
        
        if not exp:
            raise HTTPException(status_code=404, detail="Experience not found.")
            
        # Call Gemini Vision
        validation_result = validate_certificate(
            image_bytes=image_bytes,
            mime_type=file.content_type,
            candidate_name=candidate_name,
            company=exp["company"],
            role=exp["role"],
            start_date=exp["start_date"],
            end_date=exp["end_date"]
        )
        
        verification_url = validation_result.get("verification_url")
        certificate_id = validation_result.get("certificate_id")
        
        playwright_status = "Playwright not triggered (No Verification URL found in document by Gemini)"
        
        if verification_url:
            from services.playwright_service import verify_certificate_online
            playwright_result = await verify_certificate_online(
                url=verification_url,
                candidate_name=candidate_name,
                company=exp["company"],
                role=exp["role"],
                certificate_id=certificate_id
            )
            # If Playwright had a technical error (e.g. timeout, site down), we ignore it and fallback to the Visual Forensic result
            if not playwright_result.get("is_playwright_error"):
                validation_result.update(playwright_result)
                playwright_status = f"Playwright successfully scraped and validated via {verification_url}"
            else:
                playwright_status = f"Playwright fallback triggered due to error: {playwright_result.get('fraud_reason', 'Unknown error')}"
        
        is_valid = validation_result.get("is_valid", False)
        is_error = validation_result.get("is_error", False)
        fraud_reason = validation_result.get("fraud_reason", "")
        verification_method = validation_result.get("verification_method", "Visual Forensic Verified")
        
        if is_error:
            return {
                "status": "error",
                "message": fraud_reason,
                "raw_error": validation_result.get("error_details", "")
            }

        if is_valid:
            cursor.execute(
                "UPDATE user_experiences SET verification_status = 'Verified' WHERE id = %s", 
                (experience_id,)
            )
            message = f"Certificate verified successfully via {verification_method}."
        else:
            # Delete fake experience
            cursor.execute("DELETE FROM user_experiences WHERE id = %s", (experience_id,))
            
            # Apply penalties
            cursor.execute("UPDATE users SET fraud_strikes = fraud_strikes + 1 WHERE id = %s RETURNING fraud_strikes", (user_id,))
            strikes = cursor.fetchone()["fraud_strikes"]
            
            # Check total claimed experiences
            cursor.execute("SELECT COUNT(*) as total_exp FROM user_experiences WHERE user_id = %s", (user_id,))
            total_claimed = cursor.fetchone()["total_exp"] + strikes
            
            # If they faked ALL their experiences, or hit 2 strikes, mark as FRAUDULENT
            if strikes >= 2 or strikes >= total_claimed:
                cursor.execute("UPDATE users SET is_fraudulent = TRUE WHERE id = %s", (user_id,))
                message = f"Validation failed: {fraud_reason}. WARNING: Your account is now marked as FRAUDULENT."
            else:
                # Deduct XP
                cursor.execute("UPDATE user_gamification SET total_xp = GREATEST(0, total_xp - 500) WHERE user_id = %s", (user_id,))
                message = f"Validation failed: {fraud_reason}. Warning: 500 XP penalty applied. Please double-check your documents before uploading to avoid fraudulent tags"
                
        conn.commit()
        
        return {
            "status": "success",
            "is_valid": is_valid,
            "message": message,
            "fraud_reason": fraud_reason,
            "verification_method": verification_method,
            "playwright_status": playwright_status
        }
        
    except Exception as e:
        conn.rollback()
        print(f"Error in validate endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# ─────────────────────────────────────────────────────────────────────────────
# RESUME HUB ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
class ResumeUploadRequest(BaseModel):
    user_id: int
    raw_text: str

@app.get("/api/resume/{user_id}")
async def get_user_resume_endpoint(user_id: int):
    try:
        resume = get_latest_user_resume(user_id)
        if not resume:
            return {"status": "success", "data": None}
        return {"status": "success", "data": resume}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/resume")
async def process_user_resume(request: ResumeUploadRequest):
    try:
        # Re-run ATS optimization standalone
        from services.interview_service import optimize_resume_ats
        ats_feedback = optimize_resume_ats(request.raw_text, "Software Engineer")
        
        save_user_resume(request.user_id, request.raw_text, json.dumps(ats_feedback))
        return {"status": "success", "data": ats_feedback}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────────────────────────────────────
# ROADMAP HUB ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/roadmap/{user_id}")
async def get_user_roadmap(user_id: int):
    try:
        tasks = get_user_roadmap_tasks(user_id)
        return {"status": "success", "data": tasks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CompleteTaskRequest(BaseModel):
    user_id: int

@app.post("/api/roadmap/{task_id}/complete")
async def complete_task(task_id: int, request: CompleteTaskRequest):
    try:
        db_success = complete_roadmap_task(task_id, request.user_id)
        if not db_success:
            raise HTTPException(status_code=500, detail="Failed to update task")
            
        # Award gamification XP
        add_xp_to_user(request.user_id, 50, [])
        
        return {"status": "success", "message": "Task completed and XP awarded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/roadmap/reminders")
async def trigger_reminders():
    """
    Simulates a cron job or manual trigger to send email reminders 
    to all users who have pending roadmap tasks.
    """
    try:
        users_with_pending = get_users_with_pending_tasks()
        print(f"DEBUG: Found {len(users_with_pending)} users with pending tasks.")
        sent_count = 0
        
        for user in users_with_pending:
            user_id = user["user_id"]
            username = user["username"]
            email = user.get("email", f"{username}@example.com") # fallback if no email field
            
            print(f"DEBUG: Checking user {username} (ID {user_id}), DB Email: {email}")
            
            tasks = get_user_roadmap_tasks(user_id)
            pending_tasks = [t for t in tasks if not t.get("is_completed", False)]
            
            if len(pending_tasks) > 0:
                topics = [t["task_text"] for t in pending_tasks[:3]] # send top 3
                print(f"DEBUG: Sending to {email} with {len(pending_tasks)} tasks...")
                
                success = send_study_reminder(username, email, len(pending_tasks), topics)
                if success:
                    print(f"DEBUG: Successfully sent to {email}")
                    sent_count += 1
                else:
                    print(f"DEBUG: Failed to send to {email}")
            else:
                print(f"DEBUG: User {username} had no pending tasks found in get_user_roadmap_tasks()")
                    
        return {"status": "success", "message": f"Sent {sent_count} reminders."}
    except Exception as e:
        print(f"Error triggering reminders: {e}")
        raise HTTPException(status_code=500, detail="Failed to trigger reminders")

scheduler = AsyncIOScheduler()

@app.on_event("startup")
def start_scheduler():
    # Run the email reminders task every 24 hours
    scheduler.add_job(trigger_reminders, 'interval', hours=24)
    scheduler.start()
    print("Background email scheduler started.")

# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC VERIFICATION HUB ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/verify/{uid_string}")
async def verify_public_profile(uid_string: str):
    from database import get_db_connection, get_user_gamification, get_user_stats
    from psycopg2.extras import RealDictCursor
    try:
        parts = uid_string.split("-")
        if len(parts) >= 2 and parts[0] == "UID":
            user_id = int(parts[1])
        else:
            raise HTTPException(status_code=400, detail="Invalid UID format")
            
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id, username FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        g_state = get_user_gamification(user_id)
        stats = get_user_stats(user_id)
        
        return {
            "status": "success",
            "data": {
                "user": {
                    "username": user["username"]
                },
                "gamification": g_state,
                "stats": stats
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# ─────────────────────────────────────────────────────────────────────────────
# LEARNING SECTION SCHEMAS & API ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

class ExamCreateRequest(BaseModel):
    course_id: int
    lesson_id: int
    exam_type: str  # "ai_generated" or "custom"
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = "Intermediate"
    language: Optional[str] = "python"
    boilerplate_code: Optional[str] = ""
    test_cases: Optional[List[Dict[str, Any]]] = []
    optimal_solution_explanation: Optional[str] = ""
    topics: Optional[str] = ""
    num_questions: Optional[int] = 1
    user_id: int

class FinalExamCreateRequest(BaseModel):
    course_id: int
    exam_type: str  # "ai_generated" or "custom"
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = "Intermediate"
    language: Optional[str] = "python"
    boilerplate_code: Optional[str] = ""
    test_cases: Optional[List[Dict[str, Any]]] = []
    optimal_solution_explanation: Optional[str] = ""
    topics: Optional[str] = ""
    num_questions: Optional[int] = 1
    user_id: int

class EnrollRequest(BaseModel):
    user_id: int
    course_id: int

class QuizGenerateRequest(BaseModel):
    course_title: str
    difficulty: str

class QuizSubmitRequest(BaseModel):
    user_id: int
    course_id: int
    skill_name: str
    difficulty: str
    challenge_title: str
    description: str
    language: str
    test_cases: List[Dict[str, Any]]
    student_code: str
    boilerplate_code: Optional[str] = ""
    warnings: Optional[int] = 0
    lesson_id: Optional[int] = None
    is_final: Optional[bool] = False
    # Multi-question support
    student_codes: Optional[List[str]] = None        # one code string per question
    questions: Optional[List[Dict[str, Any]]] = None # question objects (title, description, test_cases, boilerplate_code)

class QuizHintRequest(BaseModel):
    challenge_title: str
    description: str
    language: str
    student_code: str
    chat_history: List[Dict[str, str]]
    user_message: str

class StartAttemptRequest(BaseModel):
    user_id: int
    exam_type: str  # "lesson" or "final"

@app.get("/api/learning/courses")
def fetch_courses(student_id: Optional[int] = None, user_id: Optional[int] = None):
    try:
        sid = student_id or user_id
        if sid is not None:
            from database import get_db_connection
            from database import RealDictCursor
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            try:
                cursor.execute("SELECT role FROM users WHERE id = %s", (sid,))
                u = cursor.fetchone()
                if u and u["role"] == "admin":
                    conn.close()
                    return get_courses()
                elif u and u["role"] == "mentor":
                    cursor.execute("""
                        SELECT c.id, c.title, c.description, c.difficulty, c.tags, c.created_at, c.chatbot_enabled, u.username as mentor_name
                        FROM courses c
                        JOIN users u ON u.id = c.created_by
                        JOIN mentor_courses mc ON mc.course_id = c.id
                        WHERE mc.mentor_id = %s AND c.status = 'active'
                        ORDER BY c.created_at DESC
                    """, (sid,))
                else:
                    cursor.execute("""
                        SELECT c.id, c.title, c.description, c.difficulty, c.tags, c.created_at, c.chatbot_enabled, u.username as mentor_name
                        FROM courses c
                        JOIN users u ON u.id = c.created_by
                        JOIN enrollments e ON e.course_id = c.id
                        WHERE e.user_id = %s AND c.status = 'active'
                        ORDER BY c.created_at DESC
                    """, (sid,))
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
            finally:
                conn.close()
        else:
            return get_courses()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/learning/courses/{id}")
def fetch_course_details(id: int, user_id: Optional[int] = None):
    details = get_course_details(id)
    if not details:
        raise HTTPException(status_code=404, detail="Course not found.")
    
    # Block non-admins from viewing soft-deleted courses
    is_admin = False
    if user_id is not None:
        try:
            from database import get_db_connection
            from database import RealDictCursor
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
            u = cursor.fetchone()
            is_admin = u and u["role"] == "admin"
            conn.close()
        except Exception:
            pass
    
    if details.get("status") == "deleted" and not is_admin:
        raise HTTPException(status_code=404, detail="Course not found.")
    
    if user_id is not None:
        check_user_course_access(user_id, id)
            
    return details


@app.post("/api/learning/enroll")
def enroll_course(req: EnrollRequest):
    res = enroll_user_in_course(req.user_id, req.course_id)
    if res["status"] == "error":
        raise HTTPException(status_code=500, detail=res["message"])
    elif res["status"] == "already_enrolled":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.get("/api/learning/enrollments/{user_id}")
def fetch_user_enrollments_route(user_id: int):
    try:
        return get_user_enrollments(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ScoreOverrideRequest(BaseModel):
    mentor_score: int
    feedback: str
    mentor_id: Optional[int] = None

class ExamActionRequest(BaseModel):
    mentor_id: int

def check_user_course_access(user_id: int, course_id: int):
    from database import get_db_connection, verify_mentor_owns_course
    from database import RealDictCursor
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        u = cursor.fetchone()
        if not u:
            raise AssignedCourseException("You are not assigned to this course.")
        if u["role"] == "admin":
            return
        elif u["role"] == "mentor":
            if not verify_mentor_owns_course(user_id, course_id):
                raise AssignedCourseException("You are not assigned to this course.")
        elif u["role"] == "candidate":
            cursor.execute("SELECT status FROM enrollments WHERE user_id = %s AND course_id = %s", (user_id, course_id))
            if not cursor.fetchone():
                raise AssignedCourseException("You are not assigned to this course.")
    finally:
        conn.close()

def check_is_mentor_or_admin(user_id: int):
    from database import get_db_connection
    from database import RealDictCursor
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        u = cursor.fetchone()
        if not u or u["role"] not in ("mentor", "admin"):
            raise AssignedCourseException("You are not assigned to this course.")
    finally:
        conn.close()

def require_mentor_owns_course(mentor_id: int, course_id: int):
    if not verify_mentor_owns_course(mentor_id, course_id):
        raise AssignedCourseException("You are not assigned to this course.")

def require_mentor_owns_submission(mentor_id: int, submission_id: int):
    if not verify_submission_belongs_to_mentor(submission_id, mentor_id):
        raise AssignedCourseException("You are not assigned to this course.")

def require_mentor_owns_exam(mentor_id: int, exam_id: int, exam_type: str):
    if not verify_exam_belongs_to_mentor(exam_id, exam_type, mentor_id):
        raise AssignedCourseException("You are not assigned to this course.")


@app.post("/api/learning/exams/{exam_id}/start-attempt")
def api_start_exam_attempt(exam_id: int, req: StartAttemptRequest):
    res = start_exam_attempt(user_id=req.user_id, exam_id=exam_id, exam_type=req.exam_type)
    if res["status"] == "error":
        raise HTTPException(status_code=403, detail=res["message"])
    return res

@app.post("/api/mentor/exams/{exam_id}/end")
def api_end_lesson_exam(exam_id: int, req: ExamActionRequest):
    require_mentor_owns_exam(req.mentor_id, exam_id, "lesson")
    success = end_exam(exam_id, "lesson", req.mentor_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to end exam.")
    return {"status": "success"}

@app.post("/api/mentor/exams/{exam_id}/reopen")
def api_reopen_lesson_exam(exam_id: int, req: ExamActionRequest):
    require_mentor_owns_exam(req.mentor_id, exam_id, "lesson")
    success = reopen_exam(exam_id, "lesson", req.mentor_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reopen exam.")
    return {"status": "success"}

@app.post("/api/mentor/exams/{exam_id}/archive")
def api_archive_lesson_exam(exam_id: int, req: ExamActionRequest):
    require_mentor_owns_exam(req.mentor_id, exam_id, "lesson")
    success = archive_exam(exam_id, "lesson", req.mentor_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to archive exam.")
    return {"status": "success"}

@app.post("/api/mentor/final-exams/{exam_id}/end")
def api_end_final_exam(exam_id: int, req: ExamActionRequest):
    require_mentor_owns_exam(req.mentor_id, exam_id, "final")
    success = end_exam(exam_id, "final", req.mentor_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to end final exam.")
    return {"status": "success"}

@app.post("/api/mentor/final-exams/{exam_id}/reopen")
def api_reopen_final_exam(exam_id: int, req: ExamActionRequest):
    require_mentor_owns_exam(req.mentor_id, exam_id, "final")
    success = reopen_exam(exam_id, "final", req.mentor_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reopen final exam.")
    return {"status": "success"}

@app.post("/api/mentor/final-exams/{exam_id}/archive")
def api_archive_final_exam(exam_id: int, req: ExamActionRequest):
    require_mentor_owns_exam(req.mentor_id, exam_id, "final")
    success = archive_exam(exam_id, "final", req.mentor_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to archive final exam.")
    return {"status": "success"}


@app.get("/api/mentor/exams/dashboard")
def api_mentor_dashboard(mentor_id: int):
    check_is_mentor_or_admin(mentor_id)
    latest = get_latest_ended_exam_for_mentor(mentor_id)
    archived = get_archived_exams_for_mentor(mentor_id)
    return {
        "status": "success",
        "latest_ended_exam": latest,
        "archived_exams": archived
    }

@app.get("/api/mentor/exams")
def api_all_mentor_exams(mentor_id: int):
    try:
        check_is_mentor_or_admin(mentor_id)
        return get_all_exams_for_mentor(mentor_id)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mentor/exams/{exam_id}/submissions")
def api_exam_submissions(exam_id: int, exam_type: str, mentor_id: int):
    check_is_mentor_or_admin(mentor_id)
    require_mentor_owns_exam(mentor_id, exam_id, exam_type)
    subs = get_submissions_for_exam(exam_id, exam_type)
    return {
        "status": "success",
        "submissions": subs
    }

@app.get("/api/mentor/courses")
def api_mentor_courses(mentor_id: int):
    check_is_mentor_or_admin(mentor_id)
    from database import get_db_connection, RealDictCursor
    import json
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT role FROM users WHERE id = %s", (mentor_id,))
        u = cursor.fetchone()
        is_admin = u and u["role"] == "admin"
        
        if is_admin:
            cursor.execute("""
                SELECT c.id, c.title, c.description, c.difficulty, c.tags, c.created_at, c.chatbot_enabled, u.username as mentor_name
                FROM courses c
                JOIN users u ON u.id = c.created_by
                WHERE c.status = 'active'
                ORDER BY c.created_at DESC
            """)
        else:
            cursor.execute("""
                SELECT c.id, c.title, c.description, c.difficulty, c.tags, c.created_at, c.chatbot_enabled, u.username as mentor_name
                FROM courses c
                JOIN mentor_courses mc ON mc.course_id = c.id
                JOIN users u ON u.id = c.created_by
                WHERE mc.mentor_id = %s AND c.status = 'active'
                ORDER BY c.created_at DESC
            """, (mentor_id,))
            
        rows = cursor.fetchall()
        courses_list = []
        for r in rows:
            try:
                r["tags"] = json.loads(r["tags"]) if isinstance(r["tags"], str) else []
            except:
                r["tags"] = []
            courses_list.append(r)
        return courses_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/mentor/submissions")
def fetch_mentor_submissions(mentor_id: int):
    check_is_mentor_or_admin(mentor_id)
    from database import get_mentor_submissions
    return get_mentor_submissions(mentor_id)


@app.post("/api/mentor/submissions/{id}/score")
def override_candidate_score(id: int, req: ScoreOverrideRequest):
    try:
        require_mentor_owns_submission(req.mentor_id, id)
        res = mentor_score_submission(id, req.mentor_score, req.feedback, mentor_id=req.mentor_id)
        if res["status"] == "error":
            raise HTTPException(status_code=500, detail=res["message"])
        return {"status": "success"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/api/learning/quiz/generate")
def generate_quiz(req: QuizGenerateRequest):
    try:
        quiz = generate_ai_coding_challenge(req.course_title, req.difficulty)
        return {"status": "success", "quiz": quiz}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/learning/quiz/submit")
def submit_quiz_route(req: QuizSubmitRequest):
    try:
        warnings_count = req.warnings or 0
        
        # Check attempt session if this is an exam
        exam_id = None
        exam_type = None
        is_exam = False
        
        from database import get_db_connection, RealDictCursor
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        if req.is_final:
            cursor.execute("SELECT id, status FROM course_final_exams WHERE course_id = %s", (req.course_id,))
            exam_row = cursor.fetchone()
            if exam_row:
                exam_id = exam_row["id"]
                exam_type = "final"
                is_exam = True
        elif req.lesson_id is not None:
            cursor.execute("SELECT id, status FROM course_exams WHERE course_id = %s AND lesson_id = %s", (req.course_id, req.lesson_id))
            exam_row = cursor.fetchone()
            if exam_row:
                exam_id = exam_row["id"]
                exam_type = "lesson"
                is_exam = True
        conn.close()

        if is_exam:
            if not has_valid_attempt(req.user_id, exam_id, exam_type):
                raise HTTPException(status_code=403, detail="You do not have an active exam session or the exam has been ended.")

        # Determine warning penalty: 1 warning = 10%, 2 warnings = 20%, >=3 warnings = immediate fail
        penalty = 0
        if warnings_count == 1:
            penalty = 10
        elif warnings_count == 2:
            penalty = 20
        elif warnings_count >= 3:
            penalty = 100

        if warnings_count >= 3:
            eval_result = {
                "score": 0,
                "passed": False,
                "feedback": "Disqualified due to proctoring violations (3 or more warnings accumulated) or voluntary exit in-between.",
                "test_cases_run": []
            }
            score = 0
        else:
            from services.learning_service import evaluate_ai_coding_challenge

            is_multi = (
                req.questions
                and isinstance(req.questions, list)
                and len(req.questions) > 0
                and req.student_codes
                and isinstance(req.student_codes, list)
                and len(req.student_codes) == len(req.questions)
            )

            if is_multi:
                # ── Multi-question evaluation ──────────────────────────
                all_scores = []
                all_feedbacks = []
                all_tc_runs = []

                for idx, question in enumerate(req.questions):
                    q_code = req.student_codes[idx] if idx < len(req.student_codes) else ""
                    q_boilerplate = question.get("boilerplate_code", "")
                    q_title = question.get("title", f"Question {idx + 1}")
                    q_desc = question.get("description", "")
                    q_tc = question.get("test_cases", [])
                    # Normalise test_cases: they can be dicts or objects
                    if q_tc and isinstance(q_tc[0], dict) and "input" in q_tc[0]:
                        pass # Already dicts
                    elif q_tc and hasattr(q_tc[0], "input"):
                        q_tc = [{"input": tc.input, "expected": tc.expected} for tc in q_tc]

                    q_eval = evaluate_ai_coding_challenge(
                        challenge_title=q_title,
                        description=q_desc,
                        language=req.language,
                        test_cases=q_tc,
                        student_code=q_code,
                        boilerplate_code=q_boilerplate
                    )

                    all_scores.append(q_eval.get("score", 0))
                    all_feedbacks.append(
                        f"### Question {idx + 1}: {q_title}\n{q_eval.get('feedback', '')}"
                    )
                    all_tc_runs.extend(q_eval.get("test_cases_run", []))

                avg_score = int(sum(all_scores) / len(all_scores)) if all_scores else 0
                eval_result = {
                    "score": avg_score,
                    "passed": avg_score >= 80,
                    "feedback": "\n\n".join(all_feedbacks),
                    "test_cases_run": all_tc_runs,
                    "per_question_scores": all_scores
                }
                score = avg_score

                # Combine all student codes for archiving
                combined_code_parts = []
                for idx, question in enumerate(req.questions):
                    q_title = question.get("title", f"Question {idx + 1}")
                    code = req.student_codes[idx] if idx < len(req.student_codes) else "(not submitted)"
                    combined_code_parts.append(f"# ── Question {idx + 1}: {q_title} ──\n{code}")
                archive_code = "\n\n".join(combined_code_parts)
            else:
                # ── Single-question evaluation ─────────────────────────
                eval_result = evaluate_ai_coding_challenge(
                    challenge_title=req.challenge_title,
                    description=req.description,
                    language=req.language,
                    test_cases=req.test_cases,
                    student_code=req.student_code,
                    boilerplate_code=req.boilerplate_code or ""
                )
                score = eval_result.get("score", 0)
                archive_code = req.student_code

        adjusted_score = max(0, score - penalty)
        eval_result["score"] = adjusted_score
        eval_result["passed"] = adjusted_score >= 80

        # Resolve archive_code for disqualified submissions
        if warnings_count >= 3:
            archive_code = req.student_code

        # Look up username and course title for archiving
        conn = get_db_connection()
        from database import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT username FROM users WHERE id = %s", (req.user_id,))
        user_row = cursor.fetchone()
        cursor.execute("SELECT title FROM courses WHERE id = %s", (req.course_id,))
        course_row = cursor.fetchone()
        conn.close()

        username = user_row["username"] if user_row else f"User {req.user_id}"
        course_title = course_row["title"] if course_row else f"Course {req.course_id}"

        # Save submission to history
        create_quiz_submission(
            user_id=req.user_id,
            username=username,
            course_id=req.course_id,
            course_title=course_title,
            challenge_title=req.challenge_title,
            student_code=archive_code,
            language=req.language,
            ai_score=adjusted_score,
            warnings=warnings_count,
            is_passed=adjusted_score >= 80,
            feedback=eval_result.get("feedback", ""),
            lesson_id=req.lesson_id,
            is_final=req.is_final or False,
            exam_id=exam_id,
            exam_type=exam_type
        )

        if is_exam:
            complete_attempt(req.user_id, exam_id, exam_type)

        # Determine XP earned
        xp_map = {"Beginner": 500, "Intermediate": 1000, "Expert": 2000}
        xp_earned = xp_map.get(req.difficulty, 500)
        
        msg = f"Coding challenge submitted successfully with draft AI score {adjusted_score}%."
        if penalty > 0:
            msg = f"Coding challenge submitted successfully with draft AI score {adjusted_score}% (including a {penalty}% penalty for {warnings_count} warning violations)."

        if is_exam:
            if req.is_final:
                res = submit_enrollment(user_id=req.user_id, course_id=req.course_id)
                if res["status"] == "error":
                    raise HTTPException(status_code=500, detail=res["message"])
            return {
                "status": "pending_review",
                "score": None,
                "warnings": warnings_count,
                "message": "Coding challenge submitted successfully. Your submission is pending final grading review by your mentor.",
                "evaluation": {
                    "score": None,
                    "passed": None,
                    "feedback": "Awaiting mentor review...",
                    "test_cases_run": []
                }
            }
        else:
            if adjusted_score >= 80:
                gamification_result = add_xp_to_user(req.user_id, xp_earned, [])
                return {
                    "status": "success",
                    "score": adjusted_score,
                    "warnings": warnings_count,
                    "message": f"{msg} You passed the lesson coding challenge and earned {xp_earned} XP!",
                    "evaluation": eval_result,
                    "gamification": gamification_result
                }
            else:
                gamification_result = add_xp_to_user(req.user_id, -100, [])
                return {
                    "status": "failed",
                    "score": adjusted_score,
                    "warnings": warnings_count,
                    "message": f"{msg} You did not pass the challenge. Deducted 100 XP. Try again!",
                    "evaluation": eval_result,
                    "gamification": gamification_result
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/learning/quiz/hint")
def request_hint(req: QuizHintRequest):
    try:
        from services.learning_service import generate_ai_hint
        hint = generate_ai_hint(
            challenge_title=req.challenge_title,
            description=req.description,
            language=req.language,
            student_code=req.student_code,
            chat_history=req.chat_history,
            user_message=req.user_message
        )
        return {"status": "success", "hint": hint}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- New Administrative Mentor Assignment APIs & Hardened Exam APIs ---

class AssignMentorRequest(BaseModel):
    admin_id: int
    mentor_id: int
    course_id: int

class ExamUpdateRequest(BaseModel):
    mentor_id: int
    title: str
    description: str
    difficulty: str
    language: str
    boilerplate_code: str
    test_cases: List[Dict[str, Any]]
    optimal_solution_explanation: Optional[str] = ""

@app.get("/api/admin/courses")
def api_get_admin_courses(admin_id: int):
    require_admin(admin_id)
    from database import get_all_courses_brief
    return get_all_courses_brief()

class DeletionRequest(BaseModel):
    admin_id: int
    password: str

@app.get("/api/admin/courses/{course_id}/deletion-summary")
def api_get_course_deletion_summary(course_id: int, admin_id: int):
    require_admin(admin_id)
    from database import get_course_deletion_summary
    summary = get_course_deletion_summary(course_id)
    if not summary:
        return JSONResponse(status_code=404, content={"message": "Course not found."})
    return summary

@app.post("/api/admin/courses/{course_id}/delete")
def api_delete_course(course_id: int, req: DeletionRequest):
    require_admin(req.admin_id)
    from database import get_db_connection, RealDictCursor, verify_password
    
    # 1. Verify admin password
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT password_hash FROM users WHERE id = %s AND role = 'admin'", (req.admin_id,))
    admin_row = cursor.fetchone()
    if not admin_row or not verify_password(req.password, admin_row["password_hash"]):
        conn.close()
        return JSONResponse(status_code=401, content={"message": "Invalid administrator password."})
        
    # Get course title
    cursor.execute("SELECT title FROM courses WHERE id = %s", (course_id,))
    course_row = cursor.fetchone()
    if not course_row:
        conn.close()
        return JSONResponse(status_code=404, content={"message": "Course not found."})
    course_title = course_row["title"]

    # 2. Check Deletion Safety Checks
    # a. Active student exam attempts (status = 'in_progress')
    cursor.execute("""
        SELECT COUNT(*) as count FROM exam_attempts
        WHERE status = 'in_progress'
          AND (
            (exam_type = 'lesson' AND exam_id IN (SELECT id FROM course_exams WHERE course_id = %s))
            OR
            (exam_type = 'final' AND exam_id IN (SELECT id FROM course_final_exams WHERE course_id = %s))
          )
    """, (course_id, course_id))
    active_attempts = cursor.fetchone()["count"]
    if active_attempts > 0:
        conn.close()
        return JSONResponse(status_code=400, content={"message": "Course contains active student exam attempts."})

    # b. Pending reviews (review_status = 'pending')
    cursor.execute("SELECT COUNT(*) as count FROM quiz_submissions WHERE course_id = %s AND review_status = 'pending'", (course_id,))
    pending_reviews = cursor.fetchone()["count"]
    if pending_reviews > 0:
        conn.close()
        return JSONResponse(status_code=400, content={"message": "Course contains submissions awaiting review."})

    # c. Active interview sessions (matching mode == course_title)
    from datetime import datetime, timedelta
    active_sims = 0
    now = datetime.now()
    for uid, sim in list(active_simulations.items()):
        if sim.get("mode") == course_title:
            if now - sim.get("last_seen", now) < timedelta(minutes=30):
                active_sims += 1
            else:
                active_simulations.pop(uid, None)
    if active_sims > 0:
        conn.close()
        return JSONResponse(status_code=400, content={"message": "Course contains active interview simulations."})

    # 3. Soft Delete Execution
    cursor.execute("UPDATE courses SET status = 'deleted' WHERE id = %s", (course_id,))
    
    # Log event
    cursor.execute("""
        INSERT INTO course_deletion_events (admin_id, course_id, action)
        VALUES (%s, %s, 'deleted')
    """, (req.admin_id, course_id))
    conn.commit()
    conn.close()
    
    return {"status": "success", "message": "Course successfully soft-deleted."}

@app.post("/api/admin/courses/{course_id}/restore")
def api_restore_course(course_id: int, req: DeletionRequest):
    require_admin(req.admin_id)
    from database import get_db_connection, RealDictCursor, verify_password
    
    # Verify admin password
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT password_hash FROM users WHERE id = %s AND role = 'admin'", (req.admin_id,))
    admin_row = cursor.fetchone()
    if not admin_row or not verify_password(req.password, admin_row["password_hash"]):
        conn.close()
        return JSONResponse(status_code=401, content={"message": "Invalid administrator password."})
        
    # Check if course exists
    cursor.execute("SELECT status FROM courses WHERE id = %s", (course_id,))
    course_row = cursor.fetchone()
    if not course_row:
        conn.close()
        return JSONResponse(status_code=404, content={"message": "Course not found."})
        
    # Update status to active
    cursor.execute("UPDATE courses SET status = 'active' WHERE id = %s", (course_id,))
    
    # Log event
    cursor.execute("""
        INSERT INTO course_deletion_events (admin_id, course_id, action)
        VALUES (%s, %s, 'restored')
    """, (req.admin_id, course_id))
    conn.commit()
    conn.close()
    
    return {"status": "success", "message": "Course successfully restored."}

@app.delete("/api/admin/courses/{course_id}/purge")
def api_purge_course(course_id: int, admin_id: int, password: str):
    require_admin(admin_id)
    from database import get_db_connection, RealDictCursor, verify_password, execute_course_purge
    
    # Verify admin password
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT password_hash FROM users WHERE id = %s AND role = 'admin'", (admin_id,))
    admin_row = cursor.fetchone()
    if not admin_row or not verify_password(password, admin_row["password_hash"]):
        conn.close()
        return JSONResponse(status_code=401, content={"message": "Invalid administrator password."})
        
    # Check if course is soft deleted
    cursor.execute("SELECT status FROM courses WHERE id = %s", (course_id,))
    course_row = cursor.fetchone()
    if not course_row:
        conn.close()
        return JSONResponse(status_code=404, content={"message": "Course not found."})
        
    if course_row["status"] != "deleted":
        conn.close()
        return JSONResponse(status_code=400, content={"message": "Course is not currently deleted."})
        
    # Check 30 days retention window
    cursor.execute("""
        SELECT created_at FROM course_deletion_events
        WHERE course_id = %s AND action = 'deleted'
        ORDER BY created_at DESC LIMIT 1
    """, (course_id,))
    event_row = cursor.fetchone()
    if not event_row:
        conn.close()
        return JSONResponse(status_code=400, content={"message": "Course deletion log not found. Cannot purge."})
        
    from datetime import datetime, timedelta
    deleted_at = event_row["created_at"]
    if isinstance(deleted_at, str):
        try:
            deleted_at = datetime.fromisoformat(deleted_at)
        except Exception:
            try:
                deleted_at = datetime.strptime(deleted_at, "%Y-%m-%d %H:%M:%S")
            except Exception:
                deleted_at = datetime.strptime(deleted_at.split(".")[0], "%Y-%m-%d %H:%M:%S")
                
    if datetime.now() - deleted_at < timedelta(days=30):
        conn.close()
        return JSONResponse(status_code=400, content={"message": "Course is not yet eligible for permanent deletion."})
        
    conn.close()
    
    # Execute Purge
    execute_course_purge(course_id)
    
    # Log event
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO course_deletion_events (admin_id, course_id, action)
        VALUES (%s, %s, 'purged')
    """, (admin_id, course_id))
    conn.commit()
    conn.close()
    
    return {"status": "success", "message": "Course permanently purged."}

@app.get("/api/admin/course-deletion-events")
def api_get_course_deletion_events(admin_id: int, page: int = 1, limit: int = 10):
    require_admin(admin_id)
    from database import get_db_connection, RealDictCursor
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        offset = (page - 1) * limit
        
        # Count total
        cursor.execute("SELECT COUNT(*) as count FROM course_deletion_events")
        total = cursor.fetchone()["count"]
        
        # Fetch logs
        cursor.execute("""
            SELECT e.id, e.admin_id, e.course_id, e.action, e.created_at, u.username as admin_name,
                   COALESCE(c.title, 'Purged Course ID ' || e.course_id) as course_title
            FROM course_deletion_events e
            JOIN users u ON u.id = e.admin_id
            LEFT JOIN courses c ON c.id = e.course_id
            ORDER BY e.created_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        rows = cursor.fetchall()
        
        events = []
        for r in rows:
            ts_str = r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"])
            events.append({
                "id": r["id"],
                "admin_id": r["admin_id"],
                "admin_name": r["admin_name"],
                "course_id": r["course_id"],
                "course_title": r["course_title"],
                "action": r["action"],
                "timestamp": ts_str
            })
            
        import math
        pages = math.ceil(total / limit)
        return {
            "status": "success",
            "events": events,
            "total": total,
            "page": page,
            "pages": pages
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/admin/mentors")
def api_get_admin_mentors(admin_id: int):
    require_admin(admin_id)
    from database import get_all_mentors
    return get_all_mentors()

@app.get("/api/admin/courses/{course_id}/mentors")
def api_get_course_mentors(course_id: int, admin_id: int):
    require_admin(admin_id)
    from database import get_course_mentors
    return get_course_mentors(course_id)

@app.get("/api/admin/courses/{course_id}/available-mentors")
def api_get_available_mentors(course_id: int, admin_id: int):
    require_admin(admin_id)
    from database import get_available_mentors_for_course
    return get_available_mentors_for_course(course_id)

@app.post("/api/admin/courses/assign-mentor")
def api_assign_mentor(req: AssignMentorRequest):
    require_admin(req.admin_id)
    from database import assign_mentor_to_course
    res = assign_mentor_to_course(req.admin_id, req.mentor_id, req.course_id)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.delete("/api/admin/courses/{course_id}/mentor/{mentor_id}")
def api_remove_mentor(course_id: int, mentor_id: int, admin_id: int):
    require_admin(admin_id)
    from database import remove_mentor_from_course
    res = remove_mentor_from_course(admin_id, mentor_id, course_id)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.get("/api/admin/mentor-assignment-events")
def api_get_mentor_assignment_events(admin_id: int, page: int = 1, limit: int = 50):
    require_admin(admin_id)
    from database import get_mentor_assignment_events_paginated
    return get_mentor_assignment_events_paginated(page, limit)

@app.put("/api/mentor/exams/{id}")
def update_lesson_exam(id: int, req: ExamUpdateRequest):
    require_mentor_owns_exam(req.mentor_id, id, "lesson")
    success = update_exam(
        exam_id=id,
        exam_type="lesson",
        title=req.title,
        description=req.description,
        difficulty=req.difficulty,
        language=req.language,
        boilerplate_code=req.boilerplate_code,
        test_cases=req.test_cases,
        optimal_solution_explanation=req.optimal_solution_explanation
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update exam.")
    return {"status": "success"}

@app.delete("/api/mentor/exams/{id}")
def delete_lesson_exam(id: int, mentor_id: int):
    require_mentor_owns_exam(mentor_id, id, "lesson")
    success = delete_exam(id, "lesson")
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete exam.")
    return {"status": "success"}

@app.put("/api/mentor/final-exams/{id}")
def update_final_exam(id: int, req: ExamUpdateRequest):
    require_mentor_owns_exam(req.mentor_id, id, "final")
    success = update_exam(
        exam_id=id,
        exam_type="final",
        title=req.title,
        description=req.description,
        difficulty=req.difficulty,
        language=req.language,
        boilerplate_code=req.boilerplate_code,
        test_cases=req.test_cases,
        optimal_solution_explanation=req.optimal_solution_explanation
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update final exam.")
    return {"status": "success"}

@app.delete("/api/mentor/final-exams/{id}")
def delete_final_exam(id: int, mentor_id: int):
    require_mentor_owns_exam(mentor_id, id, "final")
    success = delete_exam(id, "final")
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete final exam.")
    return {"status": "success"}

@app.post("/api/mentor/exams")
def add_or_generate_exam(req: ExamCreateRequest):
    import json
    try:
        # Check course ownership
        require_mentor_owns_course(req.user_id, req.course_id)

        if req.exam_type == "ai_generated":
            from database import get_db_connection, RealDictCursor
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT title, difficulty FROM courses WHERE id = %s", (req.course_id,))
            course = cursor.fetchone()
            cursor.execute("SELECT title, content, language FROM course_lessons WHERE id = %s AND course_id = %s", (req.lesson_id, req.course_id))
            lesson = cursor.fetchone()
            conn.close()
            
            if not course or not lesson:
                raise HTTPException(status_code=404, detail="Course or Lesson not found.")
                
            # Call AI generation
            num_q = req.num_questions or 1
            exam_data = generate_exam_for_lesson_ai(
                course_title=course["title"],
                lesson_title=lesson["title"],
                lesson_content=lesson["content"],
                topics=req.topics or "",
                difficulty=req.difficulty or course["difficulty"],
                num_questions=num_q
            )
            
            # Normalise: multi-question exam has a "questions" list
            if "questions" in exam_data and isinstance(exam_data["questions"], list):
                # Store questions as JSON in description field
                description_to_store = json.dumps(exam_data["questions"])
                boilerplate_to_store = ""   # boilerplate lives inside each question
                test_cases_to_store = []    # test cases live inside each question
                optimal_to_store = ""       # optimal explanation lives inside each question
            else:
                description_to_store = exam_data["description"]
                boilerplate_to_store = exam_data["boilerplate_code"]
                test_cases_to_store = exam_data["test_cases"]
                optimal_to_store = exam_data.get("optimal_solution_explanation", "")
            
            # Save generated exam
            res = create_course_exam(
                course_id=req.course_id,
                lesson_id=req.lesson_id,
                title=exam_data["title"],
                description=description_to_store,
                difficulty=exam_data["difficulty"],
                language=exam_data["language"],
                boilerplate_code=boilerplate_to_store,
                test_cases=test_cases_to_store,
                optimal_solution_explanation=optimal_to_store,
                created_by=req.user_id
            )
        else:
            res = create_course_exam(
                course_id=req.course_id,
                lesson_id=req.lesson_id,
                title=req.title,
                description=req.description,
                difficulty=req.difficulty or "Intermediate",
                language=req.language or "python",
                boilerplate_code=req.boilerplate_code or "",
                test_cases=req.test_cases or [],
                optimal_solution_explanation=req.optimal_solution_explanation or "",
                created_by=req.user_id
            )
            
        if res["status"] == "error":
            raise HTTPException(status_code=500, detail=res["message"])
            
        # Log audit trail event
        log_exam_event(res["exam_id"], "lesson", req.user_id, "created", f"Lesson exam created by mentor ID {req.user_id}")
        return {"status": "success", "exam_id": res["exam_id"]}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/learning/courses/{course_id}/lessons/{lesson_id}/exam")
def fetch_lesson_exam(course_id: int, lesson_id: int, user_id: Optional[int] = None):
    if user_id is None:
        raise AssignedCourseException("You are not assigned to this course.")
    check_user_course_access(user_id, course_id)
    import json
    exam = get_course_exam(course_id, lesson_id)
    if not exam:
        raise HTTPException(status_code=404, detail="No exam configured for this lesson.")
    # Strip solution from student-facing response
    exam.pop("optimal_solution_explanation", None)

    # Detect multi-question exam: description is a JSON-encoded list of questions
    try:
        maybe_questions = json.loads(exam.get("description", ""))
        if isinstance(maybe_questions, list) and len(maybe_questions) > 0 and isinstance(maybe_questions[0], dict):
            # Strip optimal_solution_explanation from each question
            for q in maybe_questions:
                q.pop("optimal_solution_explanation", None)
            exam["questions"] = maybe_questions
            exam["is_multi"] = True
            exam["description"] = ""   # clear raw JSON from description
    except Exception:
        pass  # Not JSON – it's a regular single-question exam

    exam["has_active_session"] = has_valid_attempt(user_id, exam["id"], "lesson")

    return exam

@app.get("/api/learning/courses/{course_id}/exams")
def fetch_course_exams(course_id: int, user_id: Optional[int] = None):
    if user_id is None:
        raise AssignedCourseException("You are not assigned to this course.")
    check_user_course_access(user_id, course_id)
    from database import get_db_connection, RealDictCursor
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        "SELECT id, lesson_id, title, difficulty, language FROM course_exams WHERE course_id = %s",
        (course_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return rows


@app.get("/api/learning/submissions/{user_id}")
def fetch_user_submissions(user_id: int):
    try:
        return get_user_submissions_scoped(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/proctoring/violation")
async def upload_proctoring_violation(
    file: UploadFile = File(...),
    user_id: int = Form(...),
    username: str = Form(...),
    course_id: int = Form(...),
    course_title: str = Form(...)
):
    try:
        import os
        import uuid
        # Create directory if it doesn't exist
        os.makedirs("static/proctoring", exist_ok=True)
        
        # Generate a unique file name
        file_ext = os.path.splitext(file.filename)[1] or ".webm"
        filename = f"violation_{uuid.uuid4().hex}{file_ext}"
        filepath = os.path.join("static", "proctoring", filename)
        
        # Read file content and write it to disk
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
            
        # Save record in the database
        web_path = f"static/proctoring/{filename}"
        res = add_proctoring_violation(
            user_id=user_id,
            username=username,
            course_id=course_id,
            course_title=course_title,
            image_path=web_path
        )
        if res["status"] == "error":
            raise Exception(res["message"])
            
        return {"status": "success", "violation_id": res["violation_id"], "path": web_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mentor/violations")
def fetch_mentor_violations():
    try:
        return get_pending_violations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/mentor/violations/{id}/acknowledge")
def acknowledge_proctoring_alert(id: int):
    try:
        res = acknowledge_violation(id)
        if res["status"] == "error":
            raise Exception(res["message"])
            
        image_path = res["image_path"]
        # Delete file from disk if it exists
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
                print(f"[*] Deleted alert video clip: {image_path}")
            except Exception as io_err:
                print(f"[!] Error deleting video file {image_path}: {io_err}")
                
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/learning/certificates/{user_id}")
def fetch_user_certificates_route(user_id: int):
    try:
        return get_user_certificates(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/learning/skills/{user_id}")
def fetch_user_skills_route(user_id: int):
    try:
        return get_user_skills(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Request schemas for Course/Lesson creation
class CreateCourseRequest(BaseModel):
    title: str
    description: str
    created_by: int
    difficulty: str
    tags: List[str]
    chatbot_enabled: Optional[bool] = True

class CreateLessonRequest(BaseModel):
    course_id: int
    title: str
    content: Optional[str] = None
    video_url: Optional[str] = None
    practice_code: Optional[str] = None
    language: Optional[str] = None
    order_index: int
    auto_generate: Optional[bool] = False
    mentor_id: Optional[int] = None

@app.post("/api/learning/courses")
def create_course_route(req: CreateCourseRequest):
    res = create_course(
        title=req.title,
        description=req.description,
        created_by=req.created_by,
        difficulty=req.difficulty,
        tags=req.tags,
        chatbot_enabled=req.chatbot_enabled
    )
    if res["status"] == "error":
        raise HTTPException(status_code=500, detail=res["message"])
    return res

@app.post("/api/learning/lessons")
def create_lesson_route(req: CreateLessonRequest):
    if req.mentor_id is None:
        raise AssignedCourseException("You are not assigned to this course.")
    require_mentor_owns_course(req.mentor_id, req.course_id)
    
    course = get_course_details(req.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    
    content = req.content or ""
    practice_code = req.practice_code or ""
    language = req.language or "python"
    video_url = req.video_url or ""

    if req.auto_generate or not content.strip():
        ai_data = generate_lesson_explanation_ai(
            lesson_title=req.title,
            course_title=course["title"],
            difficulty=course["difficulty"]
        )
        content = ai_data.get("content", content)
        practice_code = ai_data.get("practice_code", practice_code)
        language = ai_data.get("language", language)
        
        # Auto-assign standard YouTube tutorial if not provided
        if not video_url.strip():
            course_title_lower = course["title"].lower()
            if "python" in course_title_lower:
                video_url = "https://www.youtube.com/embed/kqtD5dpn9C8"
            elif "next.js" in course_title_lower or "react" in course_title_lower:
                video_url = "https://www.youtube.com/embed/wm5gMKuwSYk"
            elif "system" in course_title_lower or "design" in course_title_lower or "architecture" in course_title_lower:
                video_url = "https://www.youtube.com/embed/m8IOfntE940"
            else:
                video_url = "https://www.youtube.com/embed/kqtD5dpn9C8"

    res = create_lesson(
        course_id=req.course_id,
        title=req.title,
        content=content,
        video_url=video_url,
        practice_code=practice_code,
        language=language,
        order_index=req.order_index
    )
    if res["status"] == "error":
        raise HTTPException(status_code=500, detail=res["message"])
    return res

@app.post("/api/learning/upload-video")
def upload_video(request: Request, file: UploadFile = File(...)):
    import uuid
    import shutil
    
    content_type = file.content_type
    if not content_type or not content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video files are allowed.")
        
    ext = file.filename.split(".")[-1] if "." in file.filename else "mp4"
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join("static", "videos", unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")
        
    base_url = str(request.base_url).rstrip("/")
    video_url = f"{base_url}/static/videos/{unique_filename}"
    return {"status": "success", "video_url": video_url}

@app.post("/api/mentor/final-exams")
def add_or_generate_final_exam(req: FinalExamCreateRequest):
    import json as _json
    try:
        # Check course ownership
        require_mentor_owns_course(req.user_id, req.course_id)

        if req.exam_type == "ai_generated":
            from database import get_db_connection, RealDictCursor
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT title, difficulty FROM courses WHERE id = %s", (req.course_id,))
            course = cursor.fetchone()
            conn.close()

            if not course:
                raise HTTPException(status_code=404, detail="Course not found.")

            # Call AI generation
            num_q = req.num_questions or 1
            exam_data = generate_final_exam_ai(
                course_title=course["title"],
                difficulty=req.difficulty or course["difficulty"],
                topics=req.topics or "",
                num_questions=num_q
            )

            # Normalise: multi-question exam has a "questions" list
            if "questions" in exam_data and isinstance(exam_data["questions"], list):
                description_to_store = _json.dumps(exam_data["questions"])
                boilerplate_to_store = ""
                test_cases_to_store = []
                optimal_to_store = ""
            else:
                description_to_store = exam_data["description"]
                boilerplate_to_store = exam_data["boilerplate_code"]
                test_cases_to_store = exam_data["test_cases"]
                optimal_to_store = exam_data.get("optimal_solution_explanation", "")

            res = create_course_final_exam(
                course_id=req.course_id,
                title=exam_data["title"],
                description=description_to_store,
                difficulty=exam_data["difficulty"],
                language=exam_data["language"],
                boilerplate_code=boilerplate_to_store,
                test_cases=test_cases_to_store,
                optimal_solution_explanation=optimal_to_store,
                created_by=req.user_id
            )
        else:
            res = create_course_final_exam(
                course_id=req.course_id,
                title=req.title,
                description=req.description,
                difficulty=req.difficulty or "Intermediate",
                language=req.language or "python",
                boilerplate_code=req.boilerplate_code or "",
                test_cases=req.test_cases or [],
                optimal_solution_explanation=req.optimal_solution_explanation or "",
                created_by=req.user_id
            )

        if res["status"] == "error":
            raise HTTPException(status_code=500, detail=res["message"])

        # Log audit trail event
        log_exam_event(res["exam_id"], "final", req.user_id, "created", f"Final exam created by mentor ID {req.user_id}")
        return {"status": "success", "exam_id": res["exam_id"]}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/learning/courses/{course_id}/final-exam")
def fetch_final_exam(course_id: int, user_id: Optional[int] = None):
    if user_id is None:
        raise AssignedCourseException("You are not assigned to this course.")
    check_user_course_access(user_id, course_id)
    import json as _json
    exam = get_course_final_exam(course_id)
    if not exam:
        raise HTTPException(status_code=404, detail="No final exam configured for this course.")
    # Strip solution from student-facing response
    exam.pop("optimal_solution_explanation", None)

    # Detect multi-question exam: description is a JSON-encoded list of questions
    try:
        maybe_questions = _json.loads(exam.get("description", ""))
        if isinstance(maybe_questions, list) and len(maybe_questions) > 0 and isinstance(maybe_questions[0], dict):
            for q in maybe_questions:
                q.pop("optimal_solution_explanation", None)
            exam["questions"] = maybe_questions
            exam["is_multi"] = True
            exam["description"] = ""
    except Exception:
        pass

    exam["has_active_session"] = has_valid_attempt(user_id, exam["id"], "final")

    return exam


@app.get("/api/public/certificate/verify/{cert_id}")
def verify_certificate_public(cert_id: str):
    """Public, unauthenticated endpoint to verify a certificate ID."""
    cert = get_certificate_by_id(cert_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found or invalid.")
    
    # Generate cryptographic hash for the response, same as printed on PDF
    import hashlib
    hasher = hashlib.sha256(cert["certificate_id"].encode('utf-8'))
    hash_bytes = hasher.digest()
    short_hash = f"SHA256:{hasher.hexdigest()[:12]}...{hasher.hexdigest()[-6:]}".upper()
    
    secure_matrix = []
    for row in range(5):
        for col in range(5):
            byte_idx = row * 5 + col
            is_filled = (hash_bytes[byte_idx // 8] & (1 << (byte_idx % 8))) != 0
            secure_matrix.append(bool(is_filled))
            
    return {
        "status": "valid",
        "certificate": {
            "certificate_id": cert["certificate_id"],
            "skill_name": cert["skill_name"],
            "course_title": cert["course_title"],
            "difficulty": cert["difficulty"],
            "candidate_name": cert["candidate_name"],
            "evaluator_name": cert["mentor_name"],
            "issue_date": cert["issue_date"],
            "secure_hash": short_hash,
            "secure_matrix": secure_matrix
        }
    }


@app.get("/api/learning/certificates/{cert_id}/download")
def download_certificate(cert_id: str):
    cert = get_certificate_by_id(cert_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")
        
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.pdfgen import canvas
        from fastapi.responses import StreamingResponse
        import io
        import math
        import hashlib
        
        buffer = io.BytesIO()
        width, height = landscape(letter)
        c = canvas.Canvas(buffer, pagesize=landscape(letter))
        
        # 1. Helper function for spaced text (premium serif headers)
        def draw_spaced_centred_string(canvas_obj, x, y, text, font_name, font_size, color, spacing=2):
            canvas_obj.saveState()
            canvas_obj.setFont(font_name, font_size)
            canvas_obj.setFillColor(color)
            chars = list(text)
            total_width = 0
            char_widths = []
            for char in chars:
                w = canvas_obj.stringWidth(char, font_name, font_size)
                char_widths.append(w)
                total_width += w + spacing
            total_width -= spacing
            
            start_x = x - total_width / 2
            current_x = start_x
            for i, char in enumerate(chars):
                canvas_obj.drawString(current_x, y, char)
                current_x += char_widths[i] + spacing
            canvas_obj.restoreState()
        # 2. Helper function to draw polygons reliably
        def draw_polygon(canvas_obj, points, fill=True, stroke=True):
            if not points:
                return
            flat_points = []
            if isinstance(points[0], (list, tuple)):
                for pt in points:
                    flat_points.extend(pt)
            else:
                flat_points = points
                
            p = canvas_obj.beginPath()
            p.moveTo(flat_points[0], flat_points[1])
            for i in range(2, len(flat_points), 2):
                p.lineTo(flat_points[i], flat_points[i+1])
            p.close()
            canvas_obj.drawPath(p, fill=fill, stroke=stroke)
        # 3. Obsidian Midnight Violet Background (Rich, dark premium hue)
        c.setFillColor(colors.HexColor("#080512"))
        c.rect(0, 0, width, height, fill=True, stroke=False)
        
        # 4. Subtle Technical Grid Lines
        c.setStrokeColor(colors.HexColor("#120d24"))
        c.setLineWidth(0.4)
        # Vertical grid lines
        for x in range(0, int(width), 40):
            c.line(x, 0, x, height)
        # Horizontal grid lines
        for y in range(0, int(height), 40):
            c.line(0, y, width, y)
            
        # Draw soft, tiny glowing dots at grid crossings (constellation style)
        c.saveState()
        c.setFillColor(colors.HexColor("#3b2a75"))
        c.setFillAlpha(0.25)
        for x in range(40, int(width), 80):
            for y in range(40, int(height), 80):
                c.circle(x, y, 1.0, fill=True, stroke=False)
        c.restoreState()
            
        # 5. Spirograph / Guilloche Pattern (Centred Background Watermark, very faint)
        c.saveState()
        c.translate(width / 2, height / 2)
        c.setStrokeColor(colors.HexColor("#130f28"))
        c.setLineWidth(0.4)
        for _ in range(36):
            c.rotate(10)
            c.ellipse(-160, -65, 320, 130, stroke=True, fill=False)
        c.restoreState()
        
        # Concentric faint circular watermarks
        c.setStrokeColor(colors.HexColor("#1a1438"))
        c.setLineWidth(0.5)
        for r in range(120, 240, 40):
            c.circle(width / 2, height / 2, r, stroke=True, fill=False)
        # 6. Multi-Layer Premium Borders
        # Outer Gold Line
        c.setStrokeColor(colors.HexColor("#c5a059")) # Warm Gold
        c.setLineWidth(0.8)
        c.rect(20, 20, width - 40, height - 40, fill=False, stroke=True)
        
        # Main Thick Gold Border
        c.setStrokeColor(colors.HexColor("#c5a059"))
        c.setLineWidth(2.5)
        c.rect(25, 25, width - 50, height - 50, fill=False, stroke=True)
        
        # Inner Indigo Accent Border
        c.setStrokeColor(colors.HexColor("#4f46e5")) # Indigo
        c.setLineWidth(0.6)
        c.rect(31, 31, width - 62, height - 62, fill=False, stroke=True)
        
        # 7. Ornamental Corner Brackets
        def draw_corner(cx, cy, dx, dy):
            c.saveState()
            c.setStrokeColor(colors.HexColor("#c5a059"))
            c.setLineWidth(1.2)
            c.line(cx, cy, cx + dx * 20, cy)
            c.line(cx, cy, cx, cy + dy * 20)
            
            c.setStrokeColor(colors.HexColor("#4f46e5"))
            c.setLineWidth(0.8)
            c.line(cx + dx * 5, cy + dy * 5, cx + dx * 16, cy + dy * 5)
            c.line(cx + dx * 5, cy + dy * 5, cx + dx * 5, cy + dy * 16)
            
            c.setFillColor(colors.HexColor("#c5a059"))
            draw_polygon(c, [
                cx + dx * 10, cy + dy * 10 - 3,
                cx + dx * 10 + 3, cy + dy * 10,
                cx + dx * 10, cy + dy * 10 + 3,
                cx + dx * 10 - 3, cy + dy * 10
            ], fill=True, stroke=False)
            c.restoreState()
            
        draw_corner(31, 31, 1, 1)
        draw_corner(width - 31, 31, -1, 1)
        draw_corner(31, height - 31, 1, -1)
        draw_corner(width - 31, height - 31, -1, -1)
        
        # 8. Header Badge Pill (Secure Credential Banner)
        c.saveState()
        c.setFillColor(colors.HexColor("#0d0a1c"))
        c.setStrokeColor(colors.HexColor("#c5a059"))
        c.setLineWidth(0.8)
        c.roundRect(width/2 - 180, height - 65, 360, 20, 10, fill=True, stroke=True)
        
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(colors.HexColor("#e2e0e8"))
        c.drawCentredString(width / 2, height - 58, "★   HIREMIND SECURE CRYPTOGRAPHIC CREDENTIAL   ★")
        c.restoreState()
        
        # 9. Certificate Typography & Main Text
        # Certificate Title (with shadow for a premium 3D look)
        draw_spaced_centred_string(c, width / 2 + 1.2, height - 121.2, "CERTIFICATE OF COMPLETION", "Times-Bold", 28, colors.HexColor("#040208"), spacing=4)
        draw_spaced_centred_string(c, width / 2, height - 120, "CERTIFICATE OF COMPLETION", "Times-Bold", 28, colors.HexColor("#c5a059"), spacing=4)
        
        # Title divider accent line
        c.setStrokeColor(colors.HexColor("#c5a059"))
        c.setLineWidth(1)
        c.line(width/2 - 80, height - 135, width/2 + 80, height - 135)
        
        # Certify text
        c.setFont("Times-Italic", 12.5)
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.drawCentredString(width / 2, height - 168, "This is to officially certify that the candidate")
        
        # Recipient Name (with shadow for depth)
        c.setFont("Times-Bold", 28)
        c.setFillColor(colors.HexColor("#040208"))
        c.drawCentredString(width / 2 + 1.2, height - 211.2, cert["candidate_name"])
        c.setFillColor(colors.white)
        c.drawCentredString(width / 2, height - 210, cert["candidate_name"])
        
        # Ornamental separator under recipient name
        c.setStrokeColor(colors.HexColor("#c5a059"))
        c.setLineWidth(0.8)
        c.line(width/2 - 160, height - 225, width/2 - 15, height - 225)
        c.line(width/2 + 15, height - 225, width/2 + 160, height - 225)
        
        c.setFillColor(colors.HexColor("#8b5cf6"))
        draw_polygon(c, [width/2, height - 229, width/2 + 5, height - 225, width/2, height - 221, width/2 - 5, height - 225], fill=True, stroke=False)
        c.setFillColor(colors.HexColor("#c5a059"))
        c.circle(width/2 - 10, height - 225, 1.8, fill=True, stroke=False)
        c.circle(width/2 + 10, height - 225, 1.8, fill=True, stroke=False)
        
        # Core completion statement
        c.setFont("Times-Italic", 12.5)
        c.setFillColor(colors.HexColor("#94a3b8"))
        c.drawCentredString(width / 2, height - 262, "has successfully completed all proctored assessments and requirements for")
        
        # Course Title
        c.setFont("Times-Bold", 20)
        c.setFillColor(colors.HexColor("#818cf8"))
        c.drawCentredString(width / 2, height - 296, cert["course_title"])
        
        # Difficulty/Achievement Tag
        difficulty_text = f"{cert['difficulty']} Level"
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(colors.HexColor("#c5a059"))
        c.drawCentredString(width / 2, height - 314, f"★   VERIFIED {difficulty_text.upper()} ACHIEVEMENT   ★")
        
        # Main separator line above footer
        c.setStrokeColor(colors.HexColor("#161230"))
        c.setLineWidth(1.0)
        c.line(80, height - 375, width - 80, height - 375)
        
        # 10. LEFT COLUMN: Metadata & Cryptographic Security Hash
        left_x = 90
        
        # Issue Date
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.HexColor("#818cf8"))
        c.drawString(left_x, 160, "ISSUE DATE")
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(colors.white)
        
        # Fix date str
        try:
            issue_date_str = cert["issue_date"].split("T")[0] if isinstance(cert["issue_date"], str) else cert["issue_date"].strftime("%Y-%m-%d")
        except AttributeError:
            issue_date_str = str(cert["issue_date"]).split(" ")[0]
            
        c.drawString(left_x, 140, issue_date_str)
        
        # Credential ID
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.HexColor("#818cf8"))
        c.drawString(left_x, 115, "CREDENTIAL ID")
        c.setFont("Courier-Bold", 12)
        c.setFillColor(colors.HexColor("#c5a059"))
        c.drawString(left_x, 95, cert["certificate_id"])
        
        # QR Code block below
        c.saveState()
        matrix_y = 45 # Shifted up
        
        # Generate QR Code linking to verify page
        import qrcode
        from reportlab.lib.utils import ImageReader
        import io
        
        verify_url = f"https://hiremind.vercel.app/verify/{cert['certificate_id']}"
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=0,
        )
        qr.add_data(verify_url)
        qr.make(fit=True)
        
        # Create QR image with Gold modules on transparent/dark background
        qr_img = qr.make_image(fill_color="#c5a059", back_color="#080512").convert('RGBA')
        
        qr_io = io.BytesIO()
        qr_img.save(qr_io, format="PNG")
        qr_io.seek(0)
        
        qr_reader = ImageReader(qr_io)
        qr_size = 35
        c.drawImage(qr_reader, left_x, matrix_y, width=qr_size, height=qr_size)
        c.restoreState()
        
        # 11. CENTER COLUMN: Official Gold/Indigo Seal
        seal_x = (width / 2) + 3 # Shifted 3 points right to align perfectly with the background grid
        seal_y = 80 # Shifted higher
        
        c.saveState()
        
        # Watermark "HireMind" behind the emblem
        c.setFont("Helvetica-Bold", 34)
        c.setFillColor(colors.white)
        c.setFillAlpha(0.06)
        c.drawCentredString(seal_x, seal_y - 12, "HIREMIND")
        
        # Lower opacity for the emblem to blend better
        c.setFillAlpha(0.85)
        c.setStrokeAlpha(0.85)
        
        # Outer Gold Border (Now transparent inside)
        c.setStrokeColor(colors.HexColor("#c5a059"))
        c.setLineWidth(2)
        c.circle(seal_x, seal_y, 35, fill=False, stroke=True)
        
        # Thick Inner Gold Ring
        c.setStrokeColor(colors.HexColor("#c5a059"))
        c.setLineWidth(2.5)
        c.circle(seal_x, seal_y, 28, fill=False, stroke=True)
        
        # Thin Inner Gold Ring
        c.setLineWidth(0.5)
        c.circle(seal_x, seal_y, 23, fill=False, stroke=True)
        
        # 3D Premium Center Diamond Emblem
        c.setFillColor(colors.HexColor("#c5a059"))
        draw_polygon(c, [seal_x, seal_y + 15, seal_x + 12, seal_y, seal_x, seal_y], fill=True, stroke=False)
        c.setFillColor(colors.HexColor("#eaddb6"))
        draw_polygon(c, [seal_x, seal_y + 15, seal_x - 12, seal_y, seal_x, seal_y], fill=True, stroke=False)
        c.setFillColor(colors.HexColor("#8a6d3b"))
        draw_polygon(c, [seal_x, seal_y - 15, seal_x + 12, seal_y, seal_x, seal_y], fill=True, stroke=False)
        c.setFillColor(colors.HexColor("#c5a059"))
        draw_polygon(c, [seal_x, seal_y - 15, seal_x - 12, seal_y, seal_x, seal_y], fill=True, stroke=False)
        
        c.restoreState()
        
        # 12. RIGHT COLUMN: Mentor Signature Block (Aligned Right to width - 90)
        sig_x = width - 90
        sig_y = 85
        
        # Gold underline
        c.setStrokeColor(colors.HexColor("#c5a059"))
        c.setLineWidth(1.5)
        c.line(sig_x - 140, sig_y + 25, sig_x, sig_y + 25)
        
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.HexColor("#818cf8"))
        c.drawRightString(sig_x, sig_y + 52, "VERIFIED BY COURSE MENTOR")
        
        # Cursive Mentor Name
        c.setFont("Times-BoldItalic", 13) # Slightly smaller font
        c.setFillColor(colors.HexColor("#c084fc")) # Purple-400
        c.drawCentredString(sig_x - 70, sig_y + 32, f"Mentor {cert['mentor_name']}")
        
        # Mentor Name / Signature
        has_sig = False
        if cert.get("mentor_signature"):
            import base64
            from reportlab.lib.utils import ImageReader
            from PIL import Image, ImageFilter
            import io
            
            try:
                sig_data = cert["mentor_signature"]
                if sig_data.startswith("data:image"):
                    header, encoded = sig_data.split(",", 1)
                    img_data = base64.b64decode(encoded)
                    
                    # Convert to white pixels
                    img_pil = Image.open(io.BytesIO(img_data)).convert("RGBA")
                    data = img_pil.getdata()
                    new_data = [(255, 255, 255, item[3]) if item[3] > 0 else item for item in data]
                    img_pil.putdata(new_data)
                    
                    # Make it slightly bold using MaxFilter (dilates white pixels)
                    img_pil = img_pil.filter(ImageFilter.MaxFilter(3))
                    
                    new_img_io = io.BytesIO()
                    img_pil.save(new_img_io, format="PNG")
                    new_img_io.seek(0)
                    
                    img = ImageReader(new_img_io)
                    # Center the signature completely under the gold line. 
                    # The line spans from sig_x - 140 to sig_x. Center is sig_x - 70.
                    sig_w = 90
                    sig_h = 28
                    c.drawImage(img, sig_x - 70 - (sig_w/2), sig_y - 10, width=sig_w, height=sig_h, mask='auto')
                    has_sig = True
            except Exception as e:
                print("[!] Error drawing signature:", e)
                
        if not has_sig:
            c.setFont("Helvetica-Bold", 9.5)
            c.setFillColor(colors.white)
            c.drawRightString(sig_x, sig_y + 4, cert['mentor_name'])
        
        # Sub-label
        c.setFont("Helvetica-Oblique", 7.5)
        c.setFillColor(colors.HexColor("#64748b"))
        c.drawCentredString(sig_x - 70, sig_y - 25, "Authorized Academic Evaluator")
        
        c.showPage()
        c.save()
        buffer.seek(0)
        
        headers = {
            'Content-Disposition': f'attachment; filename="certificate_{cert_id}.pdf"'
        }
        return StreamingResponse(buffer, media_type="application/pdf", headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {str(e)}")


class CodeExecuteRequest(BaseModel):
    code: str
    language: str

@app.post("/api/learning/execute")
def execute_code(req: CodeExecuteRequest):
    allowed_langs = ["python", "javascript", "java", "c++"]
    if req.language.lower() not in allowed_langs:
        raise HTTPException(status_code=400, detail="Unsupported language")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        lang = req.language.lower()
        stdout = ""
        stderr = ""
        try:
            if lang == "python":
                file_path = os.path.join(temp_dir, "script.py")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(req.code)
                result = subprocess.run(["python", file_path], capture_output=True, text=True, timeout=5)
                stdout = result.stdout
                stderr = result.stderr

            elif lang == "javascript":
                file_path = os.path.join(temp_dir, "script.js")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(req.code)
                result = subprocess.run(["node", file_path], capture_output=True, text=True, timeout=5)
                stdout = result.stdout
                stderr = result.stderr

            elif lang == "java":
                file_path = os.path.join(temp_dir, "Main.java")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(req.code)
                compile_res = subprocess.run(["javac", file_path], capture_output=True, text=True, timeout=5)
                if compile_res.returncode != 0:
                    stderr = compile_res.stderr
                else:
                    run_res = subprocess.run(["java", "-cp", temp_dir, "Main"], capture_output=True, text=True, timeout=5)
                    stdout = run_res.stdout
                    stderr = run_res.stderr

            elif lang == "c++":
                file_path = os.path.join(temp_dir, "main.cpp")
                out_path = os.path.join(temp_dir, "a.exe" if os.name == "nt" else "a.out")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(req.code)
                compile_res = subprocess.run(["g++", file_path, "-o", out_path], capture_output=True, text=True, timeout=5)
                if compile_res.returncode != 0:
                    stderr = compile_res.stderr
                else:
                    run_res = subprocess.run([out_path], capture_output=True, text=True, timeout=5)
                    stdout = run_res.stdout
                    stderr = run_res.stderr

        except subprocess.TimeoutExpired:
            stderr = "Error: Execution timed out (exceeded 5 seconds)."
        except Exception as e:
            stderr = f"Error during execution: {str(e)}"

        return {"stdout": stdout, "stderr": stderr}
