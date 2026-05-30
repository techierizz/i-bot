import os
from google import genai
import json
from dotenv import load_dotenv

load_dotenv()

def extract_resume_context(resume_text: str) -> dict:
    """
    Takes raw resume text and uses Gemini to extract structured context.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("WARNING: GEMINI_API_KEY not found in environment. Using mock data.")
        return {
            "skills": ["JavaScript", "React", "Python"],
            "experience_level": "Mid",
            "potential_weaknesses": ["System Design", "Cloud Deployment"],
            "summary": "Mock extracted context (API key not found)."
        }
    
    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        You are an expert technical recruiter analyzing a resume.
        Extract the following information from the resume text into a strict JSON format:
        - skills: list of technical skills
        - experience_level: Junior, Mid, Senior, or Lead
        - potential_weaknesses: list of 1-3 areas they might lack experience in based on their resume
        - summary: a 2 sentence summary of their background
        
        Resume Text:
        {resume_text}
        
        Return ONLY valid JSON.
        """
        
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            text_response = response.text
        except Exception as gemini_e:
            print(f"Gemini API failed during resume parsing: {gemini_e}. Attempting Groq fallback...")
            groq_api_key = os.getenv("GROQ_API_KEY")
            if not groq_api_key:
                raise gemini_e
                
            import groq
            groq_client = groq.Groq(api_key=groq_api_key)
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"}
            )
            text_response = completion.choices[0].message.content
        
        # Clean up markdown JSON wrappers safely
        if "```json" in text_response:
            text_response = text_response.split("```json")[1].split("```")[0].strip()
        elif "```" in text_response:
            text_response = text_response.split("```")[1].split("```")[0].strip()
        else:
            text_response = text_response.strip()
            
        return json.loads(text_response)
    except Exception as e:
        print(f"Error parsing with Gemini: {e}")
        return {
            "skills": ["Error parsing skills"],
            "experience_level": "Unknown",
            "potential_weaknesses": [],
            "summary": f"Could not parse resume with LLM. Error: {str(e)}"
        }
