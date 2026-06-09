import logging
import os
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Google API client imports
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

def get_gmail_service():
    """
    Builds and returns the Gmail REST API service using the OAuth2 refresh token.
    """
    client_id = os.getenv("GMAIL_CLIENT_ID")
    client_secret = os.getenv("GMAIL_CLIENT_SECRET")
    refresh_token = os.getenv("GMAIL_REFRESH_TOKEN")

    if not client_id or not client_secret or not refresh_token:
        logging.error("Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN in environment.")
        return None

    # Construct the credentials object
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret
    )

    try:
        service = build('gmail', 'v1', credentials=creds)
        return service
    except Exception as e:
        logging.error(f"Error building Gmail service: {e}")
        return None

def send_study_reminder(username: str, email: str, pending_tasks_count: int, pending_topics: list) -> bool:
    """
    Sends an email reminder using the Gmail REST API.
    """
    try:
        service = get_gmail_service()
        if not service:
            return False

        subject = f"Your AI Interview Coach has some tasks for you!"
        FRONTEND_URL = os.getenv("FRONTEND_URL", "https://hiremind-ai-eta.vercel.app")
        
        html_body = f"""

<h2>Hey {username},</h2>
<p>You still have <strong>{pending_tasks_count} pending tasks</strong> in your Action Plan that have been waiting for over 2 days!</p>
<p>Tasks to review:</p>
<ul>
{''.join([f'<li>{t}</li>' for t in pending_topics])}
</ul>
<p>Ready to dive back into your roadmap to improve your skills and earn some XP?</p>
<div style="margin: 25px 0;">
  <a href="{FRONTEND_URL}/action-plan" style="background-color: #f59e0b; color: #18181b; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Go to Action Plan
  </a>
</div>
<br/>
<p>Best regards,<br/>The HireMind Team</p>
"""
        # Create message
        msg = MIMEMultipart('alternative')
        msg['To'] = email
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html'))

        # Encode and send via REST API
        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
        service.users().messages().send(userId="me", body={'raw': raw_message}).execute()
        
        logging.info(f"Study reminder email sent successfully to {email}")
        return True
    except Exception as e:
        logging.error(f"Error sending email via Gmail REST API: {e}")
        return False

def send_password_reset_email(email: str, reset_link: str) -> tuple[bool, str]:
    """
    Sends a password reset email using the Gmail REST API.
    Returns (success, error_message).
    """
    try:
        service = get_gmail_service()
        if not service:
            return False, "Missing Gmail OAuth credentials in environment"

        subject = "Reset Your HireMind Password"
        
        msg = MIMEMultipart('alternative')
        msg['To'] = email
        msg['Subject'] = subject

        text_body = f"""Someone requested a password reset for your HireMind account.

If you made this request, please go to the following link to reset your password:
{reset_link}

If you did not request this, you can safely ignore this email.

Regards,
The HireMind Team
"""
        
        html_body = f"""
<h2>Password Reset Request</h2>
<p>Someone requested a password reset for your HireMind account.</p>
<p>If you made this request, click the button below to set a new password:</p>
<div style="margin: 25px 0;">
  <a href="{reset_link}" style="background-color: #f59e0b; color: #18181b; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Reset Password
  </a>
</div>
<p>If you did not request this, you can safely ignore this email.</p>
<br/>
<p>Regards,<br/>The HireMind Team</p>
"""
        
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        
        msg.attach(part1)
        msg.attach(part2)
        
        # Encode and send via REST API
        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
        service.users().messages().send(userId="me", body={'raw': raw_message}).execute()
        
        logging.info(f"Password reset email sent successfully to {email}")
        return True, ""
    except Exception as e:
        error_str = str(e)
        logging.error(f"Error sending password reset email: {e}")
        return False, error_str
