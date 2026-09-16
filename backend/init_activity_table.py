import psycopg2

DATABASE_URL = "postgresql://postgres:D0xNfoZinoF0WrHJ@db.hjdreybkiairzbckycch.supabase.co:5432/postgres"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS public.call_activities (
    id SERIAL PRIMARY KEY,
    caller_id INT REFERENCES public.users(id) ON DELETE SET NULL,
    caller_name VARCHAR(255) NOT NULL,
    caller_phone VARCHAR(50) NOT NULL,
    callee_id INT REFERENCES public.users(id) ON DELETE SET NULL,
    callee_name VARCHAR(255) NOT NULL,
    callee_phone VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    duration INT DEFAULT 0,
    fraud_score INT DEFAULT 0,
    risk_tier VARCHAR(50) DEFAULT 'Low Risk',
    flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
""")
conn.commit()

cur.execute("SELECT COUNT(*) FROM public.call_activities;")
print("call_activities table exists. Row count:", cur.fetchone()[0])
conn.close()
