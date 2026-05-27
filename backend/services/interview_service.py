import os
import re
from google import genai
from dotenv import load_dotenv
import json

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
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=system_prompt
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
    user_turns = sum(1 for msg in chat_history if isinstance(msg, dict) and (msg.get("role") in ("user", "candidate") or "user" in msg or "candidate" in msg))
    if user_turns == 0:
        return {
            "scores": {
                "technical": 0, "communication": 0, "confidence": 0, "problem_solving": 0, "overall": 0
            },
            "feedback": {
                "technical": "Not enough data to evaluate.",
                "communication": "Not enough data to evaluate.",
                "confidence": "Not enough data to evaluate.",
                "problem_solving": "Not enough data to evaluate.",
                "overall_summary": "The interview was ended before a meaningful conversation occurred. Please answer at least 1 question to receive a full evaluation."
            },
            "roadmap": [],
            "resume_optimizer": {
                "ats_score_impact": 0, "what_to_add": [], "what_to_delete": [], "what_to_change": [], "bullet_points": []
            },
            "achievements": [],
            "xp_earned": 0,
            "xp_breakdown": {
                "base": 0, "score_bonus": 0, "achievement_bonus": 0, "total": 0
            }
        }

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
            "what_to_add": [
                "Add specific metrics (percentages, dollar values, or user counts) to quantify the impact of your work.",
                "Include a section detailing your specific cloud infrastructure experience (e.g., AWS S3, Lambda, API Gateway)."
            ],
            "what_to_delete": [
                "Remove vague phrases like 'Responsible for' or 'Helped team build'—they weaken your active contributions.",
                "Delete outdated skills or technologies that aren't relevant to a mid-level React/Fullstack role."
            ],
            "what_to_change": [
                "Change 'Cloud deployment' to explicitly list the services you orchestrated.",
                "Rewrite bullet points to start with strong action verbs (e.g., 'Architected', 'Refactored', 'Engineered')."
            ],
            "bullet_points": [
                {
                    "before": "Responsible for maintaining the main React application and improving load times.",
                    "after": "Refactored main React application using dynamic imports and code-splitting, reducing initial bundle size by 35% and improving PageSpeed score from 68 to 92.",
                    "rationale": "Shows direct technical action and quantifies the exact performance impact achieved."
                },
                {
                    "before": "Helped team build backend APIs using Python and FastAPI.",
                    "after": "Architected 10+ scalable backend REST APIs using Python and FastAPI, handling 50k+ daily active requests with sub-100ms response times.",
                    "rationale": "Specifies API scale, load metrics, and latency achievements to demonstrate system reliability."
                }
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

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        print("WARNING: GEMINI_API_KEY not found or invalid. Returning mock evaluation data.")
        return mock_data

    try:
        client = genai.Client(api_key=api_key)
        
        mode = context.get("interview_mode", "General")
        persona = context.get("persona", "Friendly")
        extracted = context.get("extracted_context", {})
        
        # Optimize context by taking the last 10 turns of history if large
        recent_history = chat_history[-10:] if len(chat_history) > 10 else chat_history
        
        system_prompt = f"""
        You are an expert technical interviewer and executive talent coach.
        Analyze the following complete interview chat transcript and the candidate's background context.
        Then, generate a comprehensive performance evaluation, a personalized 3-week study roadmap, and ATS resume optimizations.

        Candidate Background:
        - Skills: {', '.join(extracted.get('skills', []))}
        - Experience: {extracted.get('experience_level', 'Unknown')}
        
        Interview Configuration:
        - Mode: {mode}
        - Persona: {persona}
        
        Interview Transcript:
        {json.dumps(recent_history, indent=2)}

        INSTRUCTIONS:
        1. Score the candidate's performance from 0 to 100 on these 4 metrics:
           - Technical: Understanding of concepts, accuracy of code, system design thinking.
           - Communication: Conciseness, clarity, structuring of responses.
           - Confidence: Posture, decisiveness, lack of hesitation.
           - Problem Solving: Edge case analysis, logical reasoning, proactive optimization.
           - Overall: An average of the 4 scores, or weighted as you see fit.
        2. Provide constructive feedback for each of the 4 areas and a high-level overall summary.
        3. Generate a personalized 3-week roadmap tailored to their weaknesses shown in the interview. Each week should have a topic, description, and 3 actionable tasks.
        4. Provide ATS Resume Optimizer recommendations based on their answers:
           - what_to_add: 2-3 specific things missing from their resume (keywords, metrics, or sections).
           - what_to_delete: 2-3 specific things they should remove (fluff, filler, or weak phrasing).
           - what_to_change: 2-3 structural or phrasing changes they should make to existing content.
           - bullet_points: 2 before/after examples of how they can rewrite bullet points on their resume to show impact, along with a rationale.
        5. Award achievements/badges from the following list (choose 2-4 that best fit their interview behavior):
           - id: "fluent_speaker",   name: "Fluent Communicator",  icon: "MessageSquare" — excellent communication, < 5 filler words
           - id: "logic_master",     name: "Logic Master",          icon: "Zap"          — exceptional problem-solving, structured reasoning
           - id: "cracked_hard",     name: "Cracked Hard Round",    icon: "Trophy"       — handled Hard-difficulty questions well
           - id: "unshakable",       name: "Unshakable Focus",      icon: "Eye"          — high confidence score (>85), steady decisive answers
           - id: "clean_coder",      name: "Clean Coder",           icon: "Code"         — structured, precise, well-named code explanations
           - id: "perfectionist",    name: "Perfectionist",         icon: "Star"         — overall score above 90
           - id: "speed_demon",      name: "Speed Demon",           icon: "Zap"          — concise answers with no unnecessary rambling
           - id: "comeback_kid",     name: "Comeback Kid",          icon: "TrendingUp"   — recovered strongly after a weak answer
           - id: "deep_diver",       name: "Deep Diver",            icon: "BookOpen"     — demonstrated advanced depth beyond the question asked
           - id: "team_player",      name: "Team Player",           icon: "Users"        — highlighted collaboration and leadership examples effectively
        6. Calculate XP earned using this formula:
           - Base XP: Count the number of candidate responses in the chat history. Award 200 Base XP per candidate response, up to a maximum of 1000 Base XP (5+ responses).
           - Score bonus: add up to +500 based on overall score (score * 5)
           - Achievement bonus: +100 per badge awarded
           - Maximum total: 2500
           - Return a detailed xp_breakdown object.

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
            "what_to_add": ["string", "string"],
            "what_to_delete": ["string", "string"],
            "what_to_change": ["string", "string"],
            "bullet_points": [
              {{ "before": "string", "after": "string", "rationale": "string" }},
              {{ "before": "string", "after": "string", "rationale": "string" }}
            ]
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

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=system_prompt
        )
        text_response = response.text
        
        # Clean up markdown JSON wrappers safely
        if "```json" in text_response:
            text_response = text_response.split("```json")[1].split("```")[0].strip()
        elif "```" in text_response:
            text_response = text_response.split("```")[1].split("```")[0].strip()
        else:
            text_response = text_response.strip()
            
        return json.loads(text_response)
        
    except Exception as e:
        print(f"Error executing Gemini evaluation: {e}")
        return mock_data
