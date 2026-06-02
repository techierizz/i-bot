import psycopg2
from database import get_db_connection

def migrate():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        print("Running migration to add signature_data to users table...")
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_data TEXT;")
        conn.commit()
        print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
