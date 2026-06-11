from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pypdf
import io
import json
import os
from services.llm_service import extract_resume_context
from services.interview_service import generate_interview_response, evaluate_interview
from services.email_service import send_study_reminder
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

class LoginRequest(BaseModel):
    username: str
    password: str

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
    res = create_user(req.username, req.email, req.password, role="candidate")
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/auth/login")
def login_candidate(req: LoginRequest):
    user = authenticate_user(req.username, req.password, role="candidate")
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
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
