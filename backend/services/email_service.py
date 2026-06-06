import logging

# We use standard logging to simulate sending an email.
# The user specified they want to see the email printed in the console as a stub for Resend/SendGrid.

def send_study_reminder(username: str, email: str, pending_tasks_count: int, pending_topics: list) -> bool:
    """
    Simulates sending an email reminder using a print statement.
    """
    try:
        subject = f"Your AI Interview Coach has some tasks for you!"
        
        body = f"""
======================================================
EMAIL STUB: OUTBOUND EMAIL TRIGGERED
------------------------------------------------------
To: {email} ({username})
Subject: {subject}

Hey {username},

You still have {pending_tasks_count} pending topics to study from your last interview!

Topics to review:
{chr(10).join([f'- {t}' for t in pending_topics])}

Ready to dive back into your roadmap to improve your skills and earn some XP?
Head over to the Action Plan Hub to complete your tasks.

Regards,
The HireMind Team
======================================================
"""
        print(body)
        logging.info(f"Simulated email sent to {email}")
        return True
    except Exception as e:
        print(f"Error simulating email: {e}")
        return False
