import logging
import os
import base64
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
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
        logging.error(f"Error sending study reminder email: {e}")
        return False

def send_password_reset_email(email: str, token: str) -> tuple[bool, str]:
    """
    Sends a password reset email using the Gmail REST API.
    Returns (success, error_message).
    """
    try:
        service = get_gmail_service()
        if not service:
            return False, "Gmail API service could not be initialized."

        FRONTEND_URL = os.getenv("FRONTEND_URL", "https://hiremind-ai-eta.vercel.app")
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        subject = "Reset Your HireMind Password"
        
        text_body = f"Please reset your password by clicking this link: {reset_link}\\nThis link will expire in 1 hour."
        html_body = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; background-color: #0d0d0d; color: #ffffff; padding: 20px; }}
                    .container {{ max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; padding: 30px; border: 1px solid #333; }}
                    .button {{ background-color: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 20px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Password Reset Request</h2>
                    <p>We received a request to reset your password for your HireMind account.</p>
                    <p>Click the button below to set a new password. This link will expire in 1 hour.</p>
                    <a href="{reset_link}" class="button">Reset Password</a>
                    <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
                </div>
            </body>
        </html>
        """
        
        msg = MIMEMultipart('alternative')
        msg['To'] = email
        msg['Subject'] = subject
        
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


import requests

def send_grade_email(email: str, username: str, course_title: str, is_passed: bool, feedback: str, cert_id: str = None) -> tuple[bool, str]:
    """
    Sends an email to the candidate when their final exam is graded.
    If passed, it downloads the certificate PDF from the internal endpoint and attaches it.
    """
    try:
        service = get_gmail_service()
        if not service:
            return False, "Gmail API service could not be initialized."

        subject = f"Your {course_title} Exam Results are In!"
        FRONTEND_URL = os.getenv("FRONTEND_URL", "https://hiremind-ai-eta.vercel.app")
        
        msg = MIMEMultipart('mixed')
        msg['To'] = email
        msg['Subject'] = subject
        
        # Format the feedback to be safe for HTML
        safe_feedback = feedback.replace('\n', '<br>')
        
        if is_passed:
            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; background-color: #0d0d0d; color: #ffffff; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; padding: 30px; border: 1px solid #333;">
                        <h2 style="color: #34d399;">Congratulations, {username}! 🎉</h2>
                        <p>You have successfully passed the final exam for <strong>{course_title}</strong>.</p>
                        
                        <div style="background-color: #0d0d0d; padding: 15px; border-radius: 8px; border-left: 4px solid #8B5CF6; margin: 20px 0;">
                            <h4 style="margin-top: 0; color: #a78bfa;">Mentor Feedback:</h4>
                            <p style="color: #e5e7eb; font-size: 14px;">{safe_feedback}</p>
                        </div>
                        
                        <p>We've attached your official HireMind certificate to this email. You can also view it on your dashboard.</p>
                        <a href="{FRONTEND_URL}/credentials" style="background-color: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 10px;">View Credentials Dashboard</a>
                    </div>
                </body>
            </html>
            """
        else:
            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; background-color: #0d0d0d; color: #ffffff; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; padding: 30px; border: 1px solid #333;">
                        <h2 style="color: #f87171;">Keep Trying, {username}! 💪</h2>
                        <p>Your final submission for <strong>{course_title}</strong> has been reviewed, but unfortunately it didn't meet the passing criteria this time.</p>
                        
                        <div style="background-color: #0d0d0d; padding: 15px; border-radius: 8px; border-left: 4px solid #f87171; margin: 20px 0;">
                            <h4 style="margin-top: 0; color: #fca5a5;">Mentor Feedback:</h4>
                            <p style="color: #e5e7eb; font-size: 14px;">{safe_feedback}</p>
                        </div>
                        
                        <p>Don't give up! Review the feedback, practice your skills, and try again when you're ready.</p>
                        <a href="{FRONTEND_URL}/learning" style="background-color: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 10px;">Return to Learning Hub</a>
                    </div>
                </body>
            </html>
            """
            
        # Attach the HTML body
        alt_part = MIMEMultipart('alternative')
        alt_part.attach(MIMEText(html_body, 'html'))
        msg.attach(alt_part)
        
        # If passed and we have a cert_id, download the PDF via the internal endpoint and attach it
        if is_passed and cert_id:
            try:
                # We use HTTP locally. Fastapi typically runs on port 8000.
                pdf_url = f"http://localhost:8000/api/learning/certificates/{cert_id}/download"
                response = requests.get(pdf_url, timeout=10)
                
                if response.status_code == 200:
                    pdf_attachment = MIMEApplication(response.content, _subtype="pdf")
                    pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f"{course_title}_Certificate.pdf")
                    msg.attach(pdf_attachment)
                else:
                    logging.warning(f"Could not download certificate PDF from internal endpoint. Status: {response.status_code}")
            except Exception as e:
                logging.error(f"Error fetching certificate PDF for email attachment: {e}")
                
        # Encode and send via REST API
        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
        service.users().messages().send(userId="me", body={'raw': raw_message}).execute()
        
        logging.info(f"Grading email sent successfully to {email}")
        return True, ""
    except Exception as e:
        error_str = str(e)
        logging.error(f"Error sending grading email: {e}")
        return False, error_str
