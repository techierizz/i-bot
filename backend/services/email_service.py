import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_study_reminder(username: str, email: str, pending_tasks_count: int, pending_topics: list) -> bool:
    """
    Sends an email reminder using Gmail SMTP.
    """
    try:
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
<p>Regards,<br/>The HireMind Team</p>
"""
        
        sender_email = os.getenv("GMAIL_ADDRESS")
        sender_password = os.getenv("GMAIL_APP_PASSWORD")

        if not sender_email or not sender_password:
            logging.error("GMAIL_ADDRESS or GMAIL_APP_PASSWORD not set in environment.")
            return False

        # Create the email message
        msg = MIMEMultipart()
        msg['From'] = f"HireMind AI <{sender_email}>"
        msg['To'] = email
        msg['Subject'] = subject

        # Attach the HTML body
        msg.attach(MIMEText(html_body, 'html'))

        # Connect to Gmail's SMTP server
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls() # Secure the connection
        server.login(sender_email, sender_password)
        
        # Send email
        server.send_message(msg)
        server.quit()
        
        logging.info(f"Email sent successfully via Gmail SMTP to {email}")
        return True
    except Exception as e:
        logging.error(f"Error sending email via Gmail SMTP: {e}")
        return False

def send_password_reset_email(email: str, reset_link: str) -> tuple[bool, str]:
    """
    Sends a password reset email using Gmail SMTP.
    Returns (success, error_message).
    """
    try:
        sender_email = os.getenv("GMAIL_ADDRESS")
        sender_password = os.getenv("GMAIL_APP_PASSWORD")

        if not sender_email or not sender_password:
            logging.error("GMAIL_ADDRESS or GMAIL_APP_PASSWORD not set in environment.")
            return False, "GMAIL_ADDRESS or GMAIL_APP_PASSWORD not set in environment"

        subject = "Reset Your HireMind Password"
        
        # Create the email message using 'alternative' to support both text and HTML
        msg = MIMEMultipart('alternative')
        msg['From'] = f"HireMind AI <{sender_email}>"
        msg['To'] = email
        msg['Subject'] = subject

        # Plain text version
        text_body = f"""Someone requested a password reset for your HireMind account.

If you made this request, please go to the following link to reset your password:
{reset_link}

If you did not request this, you can safely ignore this email.

Regards,
The HireMind Team
"""
        
        # HTML version
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
        
        # Connect to Gmail's SMTP server
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
        
        # Send email
        server.send_message(msg)
        server.quit()
        
        logging.info(f"Password reset email sent successfully to {email}")
        return True, ""
    except Exception as e:
        error_str = str(e)
        logging.error(f"Error sending password reset email: {e}")
        return False, error_str
