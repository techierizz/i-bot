from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pypdf
import io
import json
from datetime import datetime
from services.llm_service import extract_resume_context
from services.interview_service import generate_interview_response, evaluate_interview
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

# In-memory store to track active sessions (user_id -> last_activity_datetime)
active_sessions: Dict[int, datetime] = {}

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

class AddXPRequest(BaseModel):
    user_id: int
    amount: int

class SettingsUpdateRequest(BaseModel):
    prompt_temp: Optional[float] = None
    system_prompt: Optional[str] = None

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

@app.get("/api/user/{user_id}/best_interview")
def get_user_best_interview(user_id: int):
    from database import get_best_interview
    import json
    
    best = get_best_interview(user_id)
    if not best:
        return {"status": "success", "data": None}
        
    if isinstance(best.get("evaluation_data"), str):
        best["evaluation_data"] = json.loads(best["evaluation_data"])
    if isinstance(best.get("transcript"), str):
        best["transcript"] = json.loads(best["transcript"])
        
    # Format date
    if best.get("created_at"):
        best["created_at"] = best["created_at"].isoformat()
        
    return {"status": "success", "data": best}

@app.get("/api/user/{user_id}/stats")
def get_user_statistics(user_id: int):
    from database import get_user_stats
    try:
        stats = get_user_stats(user_id)
        return {"status": "success", "data": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Candidate Resume setup
@app.post("/api/setup/upload")
async def upload_resume(
    file: UploadFile = File(...),
    mode: str = Form("General"),
    persona: str = Form("Friendly")
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
        
        return {
            "status": "success",
            "message": "Resume parsed successfully.",
            "data": {
                "interview_mode": mode,
                "persona": persona,
                "extracted_context": extracted_context,
                "raw_resume_text": resume_text
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing resume: {str(e)}")

@app.post("/api/interview/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        # Extract user_id to track active session
        extracted_context = request.context.get("extracted_context", {})
        user_id = (
            request.context.get("user_id") or 
            request.context.get("user", {}).get("id") or 
            extracted_context.get("user_id") or
            extracted_context.get("user", {}).get("id")
        )
        if user_id:
            try:
                active_sessions[int(user_id)] = datetime.now()
            except (ValueError, TypeError):
                pass
                
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
        
        try:
            question_limit = int(request.context.get("question_limit", 10))
        except (ValueError, TypeError):
            question_limit = 10
            
        actual_user_turns = max(0, user_turns - 1)
        MIN_USER_TURNS = question_limit
        is_meaningful = actual_user_turns >= MIN_USER_TURNS
        
        gamification_result = None
        if user_id:
            try:
                # Always save the evaluation record (even for short sessions)
                save_evaluation(
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
                print(f"[*] Evaluation logged for user_id={user_id} (actual_user_turns={actual_user_turns})")
                
                # Only award XP if the interview was meaningful
                if is_meaningful:
                    xp_earned = evaluation_data.get("xp_earned", question_limit * 200)
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
                        "skipped_reason": f"Interview too short ({actual_user_turns} answers, need {MIN_USER_TURNS}+)"
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
@app.post("/api/gamification/add_xp")
def api_add_xp(req: AddXPRequest):
    try:
        # Give XP, no badges awarded for roadmap tasks currently
        result = add_xp_to_user(user_id=req.user_id, xp_earned=req.amount, new_badge_ids=[])
        return {"status": "success", "gamification": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        metrics = get_admin_metrics()
        
        # Calculate active sessions based on last 2 minutes (120 seconds)
        now = datetime.now()
        active_count = 0
        
        # We need to iterate over a copy of items since we might delete
        for uid, last_time in list(active_sessions.items()):
            if (now - last_time).total_seconds() < 120:
                active_count += 1
            else:
                # cleanup inactive sessions
                del active_sessions[uid]
                
        metrics["active_sessions"] = active_count
        return metrics
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
