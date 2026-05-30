import os
import re
from google import genai
from dotenv import load_dotenv
import json
from datetime import datetime
from database import get_system_settings

load_dotenv()

def analyze_fillers(text: str) -> dict:
    fillers = ['um', 'uh', 'like', 'basically', 'actually', 'literally', 'you know']
    found = {}
    count = 0
    text_lower = text.lower()
    for filler in fillers:
        pattern = r'\b' + re.escape(filler) + r'\b'
        matches = re.findall(pattern, text_lower)
        if matches:
            found[filler] = len(matches)
            count += len(matches)
    return {
        "filler_words": list(found.keys()),
        "filler_count": count
    }

def generate_interview_response(context: dict, chat_history: list, latest_user_response: str) -> dict:
    """
    Uses Gemini to evaluate the user's latest response and ask the next question.
    Adjusts difficulty dynamically, flags resume lies, and rates confidence.
    Returns a dict with {"ai_response": str, "evaluation": str, "adaptive_metrics": dict, "lie_detector": dict, "confidence_analysis": dict}
    """
    api_key = os.getenv("GEMINI_API_KEY")
    filler_metrics = analyze_fillers(latest_user_response)
    
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        print("WARNING: GEMINI_API_KEY not found or invalid. Using mock conversational data.")
        return {
            "ai_response": "This is a mock response because the Gemini API key is missing. Can you tell me more about your experience?",
            "evaluation": "Mock evaluation.",
            "adaptive_metrics": {
                "score": 3,
                "difficulty": context.get("current_difficulty", "Medium"),
                "rationale": "Mock mode: maintaining current difficulty."
            },
            "lie_detector": {
                "flagged": False,
                "reason": ""
            },
            "confidence_analysis": {
                "filler_words": filler_metrics["filler_words"],
                "filler_count": filler_metrics["filler_count"],
                "communication_rating": "Good"
            }
        }
    
    try:
        client = genai.Client(api_key=api_key)
        
        mode = context.get("interview_mode", "General")
        persona = context.get("persona", "Friendly")
        extracted = context.get("extracted_context", {})
        
        # Track current difficulty
        current_difficulty = context.get("current_difficulty", "Medium")
        is_final_turn = context.get("is_final_turn", False)
        
        if is_final_turn:
            turn_instruction = "6. THIS IS THE FINAL TURN OF THE INTERVIEW. Do NOT ask another question. Briefly thank the candidate for their time, acknowledge their final answer, and cleanly conclude the interview in 2-3 sentences max."
        else:
            turn_instruction = "6. Ask exactly ONE follow-up or new question matching the NEW difficulty level. Keep your spoken response conversational, concise (under 3 sentences), and natural (it will be read aloud)."
        
        settings = get_system_settings()
        prompt_temp = float(settings.get("prompt_temp", 0.7))
        system_prompt_override = settings.get("system_prompt", "").strip()
        
        system_prompt = f"""
        You are an expert technical interviewer. 
        Interview Mode: {mode}
        Your Persona: {persona} (Adopt this tone in your spoken response)
        Current Difficulty Level: {current_difficulty} (Ensure the next question you ask matches this difficulty level)
        
        Candidate Background (parsed from their resume):
        - Skills: {', '.join(extracted.get('skills', []))}
        - Experience: {extracted.get('experience_level', 'Unknown')}
        - Potential Weaknesses to probe: {', '.join(extracted.get('potential_weaknesses', []))}
        
        Conversation History:
        {json.dumps(chat_history[-5:], indent=2)}  # Only showing last 5 turns to save context
        
        Candidate's Latest Response:
        "{latest_user_response}"
        
        INSTRUCTIONS:
        1. Evaluate the candidate's latest response for technical correctness and confidence relative to the Current Difficulty Level.
        2. Grade their response from 1 to 5.
        3. Determine the next difficulty level:
           - If score >= 4: Increase difficulty (e.g. Medium -> Hard, Easy -> Medium, or remain Hard).
           - If score <= 2: Decrease difficulty (e.g. Medium -> Easy, Hard -> Medium, or remain Easy).
           - If score == 3: Maintain current difficulty.
        4. Cross-reference their response with their Candidate Background. If they claim a skill not listed, mismatch their experience level, or make highly implausible claims, flag it as a potential lie/inconsistency.
        5. Generate your next spoken response. If their answer was good, acknowledge it briefly. If it was bad, probe deeper.
        {turn_instruction}
        
        Return your response strictly in the following JSON format:
        {{
            "evaluation": "A brief internal note on how they did on the last question.",
            "ai_response": "The exact words you will speak back to the candidate.",
            "adaptive_metrics": {{
                "score": 3,
                "difficulty": "Easy" | "Medium" | "Hard",
                "rationale": "Why this score was given and why the difficulty was changed/maintained."
            }},
            "lie_detector": {{
                "flagged": true | false,
                "reason": "Detail the resume mismatch or contradiction here, or empty if false."
            }},
            "confidence_analysis": {{
                "communication_rating": "Excellent" | "Good" | "Needs Improvement"
            }}
        }}
        """
        
        if system_prompt_override:
            system_prompt = f"ADMINISTRATOR OVERRIDE INSTRUCTION: {system_prompt_override}\n\n" + system_prompt
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=system_prompt,
            config=genai.types.GenerateContentConfig(
                temperature=prompt_temp
            )
        )
        text_response = response.text
        
        # Clean up markdown JSON wrappers safely
        if "```json" in text_response:
            text_response = text_response.split("```json")[1].split("```")[0].strip()
        elif "```" in text_response:
            text_response = text_response.split("```")[1].split("```")[0].strip()
        else:
            text_response = text_response.strip()
            
        result = json.loads(text_response)
        
        # Merge programmatic filler metrics into the final output
        if "confidence_analysis" not in result:
            result["confidence_analysis"] = {}
        result["confidence_analysis"]["filler_words"] = filler_metrics["filler_words"]
        result["confidence_analysis"]["filler_count"] = filler_metrics["filler_count"]
        
        return result
    except Exception as e:
        print(f"Error generating interview response: {e}")
        return {
            "evaluation": f"Error connecting to AI: {str(e)}",
            "ai_response": "I'm having trouble connecting to my brain right now because of a quota issue. Could you try again in a minute?",
            "adaptive_metrics": {
                "score": 3,
                "difficulty": current_difficulty,
                "rationale": f"API error fallback: {str(e)}"
            },
            "lie_detector": {
                "flagged": False,
                "reason": ""
            },
            "confidence_analysis": {
                "filler_words": filler_metrics["filler_words"],
                "filler_count": filler_metrics["filler_count"],
                "communication_rating": "Needs Improvement"
            }
        }

def evaluate_interview(context: dict, chat_history: list) -> dict:
    """
    Evaluates the entire interview chat history using Gemini.
    Provides a comprehensive feedback report, learning roadmap, resume suggestions, and achievements.
    Returns a structured dictionary matching the dashboard evaluation scheme.
    """
    raw_user_turns = sum(1 for msg in chat_history if isinstance(msg, dict) and (msg.get("role") in ("user", "candidate") or "user" in msg or "candidate" in msg))
    # Exclude the initial "Are you ready?" prompt from the question count
    user_turns = max(0, raw_user_turns - 1)

    mock_data = {
        "scores": {
            "technical": 85,
            "communication": 78,
            "confidence": 90,
            "problem_solving": 82,
            "overall": 84
        },
        "feedback": {
            "technical": "Demonstrated strong knowledge of core React concepts like hooks and component lifecycle, though deep async patterns could be improved.",
            "communication": "Fluent and clear. Avoided filler words mostly, but could structure complex architectural answers more concisely.",
            "confidence": "Highly confident posture and steady tone. Maintained solid gaze focus throughout the session.",
            "problem_solving": "Approached problem-solving logically. Suggested optimizations and edge cases before writing code.",
            "overall_summary": "Overall, the candidate is a strong fit for a mid-level React position. They show solid coding fundamentals and a healthy problem-solving attitude, with slight room for improvement in high-level system architecture communication."
        },
        "roadmap": [
            {
                "week": 1,
                "topic": "Concurrency & State Management",
                "description": "Deep dive into React 19 concurrent features, transition APIs, and advanced state management patterns (Zustand/Redux).",
                "actions": [
                    "Build a demo app using React 19's useTransition and action handlers.",
                    "Compare Zustand and Context API for global state scalability.",
                    "Review React Fiber architecture and render phases."
                ]
            },
            {
                "week": 2,
                "topic": "System Design & Performance Optimization",
                "description": "Learn to design scalable web apps. Focus on caching, CDN delivery, SSR, and rendering bottlenecks.",
                "actions": [
                    "Read through the System Design Primer repo.",
                    "Optimize a Next.js app to achieve 90+ Lighthouse performance score.",
                    "Practice drawing architecture diagrams using excalidraw."
                ]
            },
            {
                "week": 3,
                "topic": "Structured Communication & Mock Practice",
                "description": "Adopt the STAR (Situation, Task, Action, Result) method for behavioral questions and practice strict timing.",
                "actions": [
                    "Write down answers to 5 common behavioral questions using the STAR framework.",
                    "Conduct 2 peer mock interviews on Pramp or similar platform.",
                    "Record yourself answering coding questions to reduce filler word usage."
                ]
            }
        ],
        "resume_optimizer": {
            "ats_score_impact": 15,
            "line_modifications": [
                {
                    "exact_line": "Responsible for maintaining the main React application and improving load times.",
                    "modification_reason": "Shows direct technical action and quantifies the exact performance impact achieved.",
                    "suggested_change": "Refactored main React application using dynamic imports and code-splitting, reducing initial bundle size by 35% and improving PageSpeed score from 68 to 92."
                }
            ],
            "top_tips": [
                "Your resume uses a complex two-column design that ATS parsers often scramble. Switch to a single-column format."
            ]
        },
        "achievements": [
            {
                "id": "fluent_speaker",
                "name": "Fluent Communicator",
                "icon": "MessageSquare",
                "description": "Maintained low filler word count (under 5 occurrences) throughout the interview."
            },
            {
                "id": "unshakable",
                "name": "Unshakable Focus",
                "icon": "Eye",
                "description": "Maintained consistent eye-gaze focus and calm physical posture."
            },
            {
                "id": "logic_master",
                "name": "Logic Master",
                "icon": "Zap",
                "description": "Successfully answered all high-difficulty questions with structured reasoning."
            }
        ],
        "xp_earned": 1450,
        "xp_breakdown": {
            "base": 1000,
            "score_bonus": 350,
            "achievement_bonus": 100,
            "total": 1450
        }
    }

    try:
        question_limit = int(context.get("question_limit", 10))
    except (ValueError, TypeError):
        question_limit = 10

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        print("WARNING: GEMINI_API_KEY not found or invalid. Returning mock evaluation data.")
        if user_turns < question_limit:
            mock_data["scores"] = {"technical": 0, "communication": 0, "confidence": 0, "problem_solving": 0, "overall": 0}
            mock_data["feedback"]["overall_summary"] = f"Interview ended early. You answered {user_turns} out of {question_limit} questions. You must complete all questions to earn evaluation and XP."
            mock_data["xp_earned"] = 0
            mock_data["achievements"] = []
            mock_data["roadmap"] = []
            mock_data["resume_optimizer"] = {"ats_score_impact": 0, "line_modifications": [], "top_tips": []}
            mock_data["xp_breakdown"] = {"base": 0, "score_bonus": 0, "achievement_bonus": 0, "total": 0}
        return mock_data

    try:
        client = genai.Client(api_key=api_key)
        
        mode = context.get("interview_mode", "General")
        persona = context.get("persona", "Friendly")
        extracted = context.get("extracted_context", {})
        raw_resume = context.get("raw_resume_text") or extracted.get("raw_resume_text", "No resume provided.")
        
        # Optimize context by taking the last 10 turns of history if large
        recent_history = chat_history[-10:] if len(chat_history) > 10 else chat_history
        
        settings = get_system_settings()
        prompt_temp = float(settings.get("prompt_temp", 0.7))
        system_prompt_override = settings.get("system_prompt", "").strip()
        
        system_prompt = f"""
        You are an expert technical interviewer and an expert ATS Resume Optimizer.
        You have two tasks:
        1. Evaluate the candidate's interview performance based on the transcript.
        2. Optimize their resume for ATS systems based purely on their raw resume text.

        Current Date: {datetime.now().strftime('%B %d, %Y')}

        Raw Resume Text:
        {raw_resume}
        
        Candidate Background (Extracted):
        - Skills: {', '.join(extracted.get('skills', []))}
        - Experience: {extracted.get('experience_level', 'Unknown')}
        
        Interview Configuration:
        - Mode: {mode}
        - Persona: {persona}
        
        Interview Transcript:
        {json.dumps(recent_history, indent=2)}

        INSTRUCTIONS:
        1. Score the candidate's performance from 0 to 100 on these 4 metrics (if the interview was empty/aborted, score 0):
           - Technical: Understanding of concepts, accuracy of code, system design thinking.
           - Communication: Conciseness, clarity, structuring of responses.
           - Confidence: Posture, decisiveness, lack of hesitation.
           - Problem Solving: Edge case analysis, logical reasoning, proactive optimization.
           - Overall: An average of the 4 scores.
        2. Provide constructive feedback for each of the 4 areas and a high-level overall summary.
        3. Generate a personalized 3-week roadmap tailored to their weaknesses shown in the interview.
        4. Provide ATS Resume Optimizer recommendations based STRICTLY on the Raw Resume Text above:
           - Scan all the lines in the raw resume.
           - Provide ats_score_impact: An integer between 20 and 85 representing the projected POSITIVE percentage score boost (do NOT use negative numbers).
           - Provide line_modifications: find 3-5 exact sentences/lines from the resume that are poorly written or not ATS-friendly, and provide a suggested change along with a modification reason.
           - Provide top_tips: Provide exactly 5 highly critical ATS formatting/content tips tailored to this resume. Do NOT use markdown bolding (**), asterisks, or bullet points in the strings. Provide plain text only.
           - This resume optimization MUST be provided even if the interview transcript is empty.
        5. Award achievements/badges from the following list (choose 2-4 that best fit their interview behavior):
           - id: "fluent_speaker",   name: "Fluent Communicator",  icon: "MessageSquare"
           - id: "logic_master",     name: "Logic Master",          icon: "Zap"
           - id: "cracked_hard",     name: "Cracked Hard Round",    icon: "Trophy"
           - id: "unshakable",       name: "Unshakable Focus",      icon: "Eye"
           - id: "clean_coder",      name: "Clean Coder",           icon: "Code"
           - id: "perfectionist",    name: "Perfectionist",         icon: "Star"
           - id: "speed_demon",      name: "Speed Demon",           icon: "Zap"
           - id: "comeback_kid",     name: "Comeback Kid",          icon: "TrendingUp"
           - id: "deep_diver",       name: "Deep Diver",            icon: "BookOpen"
           - id: "team_player",      name: "Team Player",           icon: "Users"
        6. Calculate XP earned using this formula:
           - Base XP: {question_limit * 200} Base XP
           - Score bonus: add up to +500 based on overall score (score * 5)
           - Achievement bonus: +100 per badge awarded
           - Maximum total: {(question_limit * 200) + 500 + 400}

        You must return your output strictly in the following JSON format:
        {{
          "scores": {{
            "technical": number,
            "communication": number,
            "confidence": number,
            "problem_solving": number,
            "overall": number
          }},
          "feedback": {{
            "technical": "string",
            "communication": "string",
            "confidence": "string",
            "problem_solving": "string",
            "overall_summary": "string"
          }},
          "roadmap": [
            {{ "week": 1, "topic": "string", "description": "string", "actions": ["string", "string", "string"] }},
            {{ "week": 2, "topic": "string", "description": "string", "actions": ["string", "string", "string"] }},
            {{ "week": 3, "topic": "string", "description": "string", "actions": ["string", "string", "string"] }}
          ],
          "resume_optimizer": {{
            "ats_score_impact": number,
            "line_modifications": [
              {{ "exact_line": "string", "modification_reason": "string", "suggested_change": "string" }}
            ],
            "top_tips": ["string", "string"]
          }},
          "achievements": [
            {{ "id": "string", "name": "string", "icon": "string", "description": "string" }}
          ],
          "xp_earned": number,
          "xp_breakdown": {{
            "base": number,
            "score_bonus": number,
            "achievement_bonus": number,
            "total": number
          }}
        }}
        """

        if system_prompt_override:
            system_prompt = f"ADMINISTRATOR OVERRIDE INSTRUCTION: {system_prompt_override}\n\n" + system_prompt

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=system_prompt,
            config=genai.types.GenerateContentConfig(
                temperature=prompt_temp
            )
        )
        text_response = response.text
        
        # Clean up markdown JSON wrappers safely
        if "```json" in text_response:
            text_response = text_response.split("```json")[1].split("```")[0].strip()
        elif "```" in text_response:
            text_response = text_response.split("```")[1].split("```")[0].strip()
        else:
            text_response = text_response.strip()
            
        parsed_response = json.loads(text_response)
        
        # If the interview was aborted early (e.g. they only said "yes"),
        # zero out the evaluation scores to avoid giving unearned mock XP,
        # but keep the ATS resume_optimizer which operates independently.
        if user_turns < question_limit:
            base_xp = 0
            parsed_response["scores"] = {"technical": 0, "communication": 0, "confidence": 0, "problem_solving": 0, "overall": 0}
            parsed_response["feedback"]["overall_summary"] = "Interview ended before completion. Evaluation unavailable, but ATS Resume Optimization has been provided below based on your resume."
            parsed_response["achievements"] = []
            parsed_response["roadmap"] = []
            parsed_response["xp_earned"] = base_xp
            parsed_response["xp_breakdown"] = {"base": base_xp, "score_bonus": 0, "achievement_bonus": 0, "total": base_xp}

        # Recalculate XP accurately to avoid LLM math errors
        if user_turns >= question_limit:
            base_xp = question_limit * 200
            score_bonus = int(parsed_response.get("scores", {}).get("overall", 0)) * 5
            achievement_bonus = len(parsed_response.get("achievements", [])) * 100
            
            # Deductions from telemetry metrics
            deductions = 0
            deduction_reasons = []
            
            metrics = context.get("metrics", {})
            filler_count = metrics.get("fillerCount", 0)
            if filler_count >= 16:
                deductions -= 100
                deduction_reasons.append(f"Frequent filler words (-100)")
            elif filler_count >= 6:
                deductions -= 50
                deduction_reasons.append(f"Frequent filler words (-50)")
                
            total_sec = max(metrics.get("totalSeconds", 1), 1)
            look_away_sec = metrics.get("lookAwaySeconds", 0)
            if (look_away_sec / total_sec) > 0.2:
                deductions -= 100
                deduction_reasons.append("Poor eye contact (-100)")
                
            fidgety_sec = metrics.get("fidgetySeconds", 0)
            if (fidgety_sec / total_sec) > 0.3:
                deductions -= 100
                deduction_reasons.append("Highly Fidgety/Nervous (-100)")
                
            if metrics.get("lieFlagged", False):
                deductions -= 250
                deduction_reasons.append("Inconsistency Flagged (-250)")
            
            # Calculate total and floor at 0
            total_xp = max(0, base_xp + score_bonus + achievement_bonus + deductions)
            
            parsed_response["xp_earned"] = total_xp
            parsed_response["xp_breakdown"] = {
                "base": base_xp,
                "score_bonus": score_bonus,
                "achievement_bonus": achievement_bonus,
                "total": total_xp
            }
            if deductions < 0:
                parsed_response["xp_breakdown"]["deductions"] = abs(deductions)
                parsed_response["xp_breakdown"]["deduction_reason"] = ", ".join(deduction_reasons)

        return parsed_response
        
    except Exception as e:
        print(f"Error executing Gemini evaluation: {e}")
        
        if user_turns < question_limit:
            base_xp = 0
            return {
                "scores": {
                    "technical": 0, "communication": 0, "confidence": 0, "problem_solving": 0, "overall": 0
                },
                "feedback": {
                    "technical": "Evaluation unavailable.",
                    "communication": "Evaluation unavailable.",
                    "confidence": "Evaluation unavailable.",
                    "problem_solving": "Evaluation unavailable.",
                    "overall_summary": "The AI could not properly evaluate the interview due to insufficient data or a system error. You have still been awarded Base XP for your participation!"
                },
                "roadmap": [],
                "resume_optimizer": {
                    "ats_score_impact": 0, "line_modifications": [], "top_tips": []
                },
                "achievements": [],
                "xp_earned": base_xp,
                "xp_breakdown": {
                    "base": base_xp, "score_bonus": 0, "achievement_bonus": 0, "total": base_xp
                }
            }
            
        return mock_data
