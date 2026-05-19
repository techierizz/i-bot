import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
print(f"Loaded API Key: {api_key[:10]}... (truncated for security)")

try:
    client = genai.Client(api_key=api_key)
    print("Sending test request to Gemini API...")
    
    # Trying the most stable default alias
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Say hello in one short sentence!'
    )
    
    print("\nSUCCESS! Gemini is working perfectly.")
    print(f"Gemini says: {response.text}")
except Exception as e:
    print("\nERROR: Failed to connect to Gemini API.")
    print(f"Error details: {str(e)}")
