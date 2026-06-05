import os
import json
from google import genai
from playwright.async_api import async_playwright

async def scrape_verification_url(url: str, certificate_id: str = None) -> str:
    browserless_token = os.getenv("BROWSERLESS_TOKEN")
    
    async with async_playwright() as p:
        if browserless_token and browserless_token != "ENTER_YOUR_BROWSERLESS_API_KEY_HERE":
            print("Connecting to Browserless.io...")
            browser = await p.chromium.connect_over_cdp(f'wss://chrome.browserless.io?token={browserless_token}')
        else:
            print("Using local Playwright Chromium...")
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
        
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            # wait a tiny bit for any JS rendering
            await page.wait_for_timeout(2000)
            
            # --- Interactive Heuristics ---
            # Try clicking obvious verification buttons (e.g., CodSoft)
            verify_btn = page.get_by_text("CLICK HERE TO VERIFY", exact=False)
            if await verify_btn.count() > 0:
                await verify_btn.first.click()
                await page.wait_for_timeout(1000)
                
            # If certificate_id is provided, try to find an input field and fill it
            if certificate_id:
                inputs = page.locator("input[type='text'], input[placeholder*='id' i], input[placeholder*='ID' i]")
                if await inputs.count() > 0:
                    await inputs.first.fill(certificate_id)
                    await inputs.first.press("Enter")
                    await page.wait_for_timeout(3000) # Wait for search results
            # ------------------------------
            
            # Scrape all visible text
            body_text = await page.locator("body").inner_text()
            
            await browser.close()
            return body_text
        except Exception as e:
            await browser.close()
            raise e

def evaluate_scraped_text(scraped_text: str, candidate_name: str, company: str, role: str) -> dict:
    prompt = f"""
    You are an automated verification agent. 
    We just scraped the official verification portal for a certificate. 
    Here is the raw text from the page:
    
    \"\"\"
    {scraped_text[:4000]}
    \"\"\"
    
    Based on this text, does it explicitly prove that a person named '{candidate_name}' completed the '{role}' role (or a similar valid experience) at '{company}'?
    Respond ONLY with a JSON object containing:
    `is_valid` (boolean),
    `fraud_reason` (string, explain why it failed if invalid, or leave empty)
    """
    
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return {"is_valid": False, "fraud_reason": "Gemini API key missing"}
            
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
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
        print(f"Error evaluating scraped text: {e}")
        return {"is_valid": False, "is_playwright_error": True, "fraud_reason": f"Failed to parse AI evaluation: {e}"}

async def verify_certificate_online(url: str, candidate_name: str, company: str, role: str, certificate_id: str = None) -> dict:
    try:
        scraped_text = await scrape_verification_url(url, certificate_id)
        if not scraped_text or len(scraped_text.strip()) < 10:
            return {"is_valid": False, "is_playwright_error": True, "fraud_reason": "Verification portal returned an empty page."}
            
        result = evaluate_scraped_text(scraped_text, candidate_name, company, role)
        result["verification_method"] = "Playwright Web Scraping"
        return result
    except Exception as e:
        print(f"Playwright error: {e}")
        return {"is_valid": False, "is_playwright_error": True, "fraud_reason": f"Could not reach or scrape verification portal: {str(e)}"}
