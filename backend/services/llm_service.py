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
        - work_experiences: list of objects with keys 'company', 'role', 'start_date', 'end_date'. (Extract up to 3 most recent experiences. If none, return an empty array).
        
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

def validate_certificate(image_bytes: bytes, mime_type: str, candidate_name: str, company: str, role: str, start_date: str, end_date: str) -> dict:
    """
    Forensically validates a certificate image using Gemini 1.5 Pro multimodal.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"is_valid": False, "fraud_reason": "System Error: Gemini API key missing"}
        
    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        Perform forensic analysis on this document. 
        1) Extract any Certificate IDs or Verification URLs (e.g. from QR codes or text).
        2) Try to infer the full verification URL for this exact certificate at '{company}'. If you find a direct URL that verifies this certificate, return it as `verification_url`. 
        3) Even if online verification seems unavailable, perform visual forensic analysis: Ensure the document explicitly belongs to '{candidate_name}'. 
        4) Check for font mismatching or digital tampering around the candidate's name. 
        5) Verify the exact dates match the user's claimed timeline of {start_date} to {end_date}. 
        6) Ensure the role stated on the document matches {role} at {company}. 
        If it appears forged or tampered with, reject it with a specific fraud_reason. Return ONLY a JSON with `is_valid: boolean`, `fraud_reason: string` (empty if valid), `verification_method: string` ("Visual Forensic Verified"), `verification_url: string` (the direct verification link if found, else null), and `certificate_id: string` (the extracted ID if present, else null).
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                prompt,
                genai.types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            ],
            config=genai.types.GenerateContentConfig(
                tools=[{"google_search": {}}]
            )
        )
        
        text_response = response.text
        if "```json" in text_response:
            text_response = text_response.split("```json")[1].split("```")[0].strip()
        elif "```" in text_response:
            text_response = text_response.split("```")[1].split("```")[0].strip()
        else:
            text_response = text_response.strip()
            
        return json.loads(text_response)
    except Exception as e:
        print(f"Error validating certificate: {e}")
        return {"is_valid": False, "is_error": True, "fraud_reason": f"AI Validation Failed due to technical error: {e}"}
