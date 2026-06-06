import logging
import os
import resend

# Ensure API key is set for Resend
resend.api_key = os.getenv("RESEND_API_KEY", "")

def send_study_reminder(username: str, email: str, pending_tasks_count: int, pending_topics: list) -> bool:
    """
    Sends an email reminder using the Resend API.
    """
    try:
        subject = f"Your AI Interview Coach has some tasks for you!"
        
        html_body = f"""

<h2>Hey {username},</h2>
<p>You still have <strong>{pending_tasks_count} pending tasks</strong> in your Action Plan that have been waiting for over 2 days!</p>
<p>Tasks to review:</p>
<ul>
{''.join([f'<li>{t}</li>' for t in pending_topics])}
</ul>
<p>Ready to dive back into your roadmap to improve your skills and earn some XP?</p>
<p>Head over to your <strong>Action Plan</strong> to complete your tasks.</p>
<br/>
<p>Regards,<br/>The HireMind Team</p>
"""
        
        # We need a verified domain to send from in Resend, but for testing, Resend allows sending 
        # from "onboarding@resend.dev" to the verified email address attached to the API key account.
        params = {
            "from": "onboarding@resend.dev",
            "to": [email],
            "subject": subject,
            "html": html_body,
        }
        
        # Send using the resend SDK
        email_response = resend.Emails.send(params)
        
        logging.info(f"Email sent successfully via Resend to {email}: {email_response}")
        return True
    except Exception as e:
        logging.error(f"Error sending email via Resend: {e}")
        return False
