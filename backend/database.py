import os
import hashlib
import asyncpg
from typing import Optional, List, Dict, Any

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres.hjdreybkiairzbckycch:D0xNfoZinoF0WrHJ@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
)

SALT = "beyond404_salt_key_2026_"

def hash_password(password: str) -> str:
    return hashlib.sha256((SALT + password).encode("utf-8")).hexdigest()

_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
    return _pool

async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS public.users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(100) DEFAULT 'Analyst',
                tag VARCHAR(50) DEFAULT 'Personal',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        await conn.execute('''
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
        ''')

        count = await conn.fetchval('SELECT COUNT(*) FROM public.users;')
        if count == 0:
            sample_users = [
                ('Sanin CP', 'sanin@beyond404.ai', '+91 98765 43210', hash_password('password123'), 'Senior Analyst', 'Personal'),
                ('Alex Thomas', 'alex@beyond404.ai', '+91 98765 00001', hash_password('password123'), 'Security Officer', 'Personal'),
                ('Riya Nair', 'riya@beyond404.ai', '+91 98450 67890', hash_password('password123'), 'Fraud Analyst', 'Personal'),
                ('Bank Support', 'support@beyondbank.com', '+91 91234 56789', hash_password('password123'), 'Support Lead', 'Business'),
                ('Sarah Connor', 'sarah@beyond404.ai', '+91 99880 11223', hash_password('password123'), 'Forensic Investigator', 'Personal'),
                ('James Peter', 'james@beyond404.ai', '+91 99876 54321', hash_password('password123'), 'System Admin', 'Personal'),
            ]
            for u in sample_users:
                await conn.execute(
                    'INSERT INTO public.users (name, email, phone, password_hash, role, tag) VALUES ($1, $2, $3, $4, $5, $6)',
                    *u
                )

async def create_user(name: str, email: str, phone: str, password: str, role: str = "Analyst", tag: str = "Personal") -> Dict[str, Any]:
    pool = await get_pool()
    pw_hash = hash_password(password)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            '''
            INSERT INTO public.users (name, email, phone, password_hash, role, tag)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, email, phone, role, tag, created_at;
            ''',
            name.strip(), email.strip().lower(), phone.strip(), pw_hash, role.strip(), tag.strip()
        )
        d = dict(row)
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        return d

async def authenticate_user(identifier: str, password: str) -> Optional[Dict[str, Any]]:
    pool = await get_pool()
    pw_hash = hash_password(password)
    ident = identifier.strip().lower()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            '''
            SELECT id, name, email, phone, password_hash, role, tag, created_at
            FROM public.users
            WHERE LOWER(email) = $1 OR phone = $2;
            ''',
            ident, identifier.strip()
        )
        if not row:
            return None
        if row['password_hash'] != pw_hash:
            return None
        user = dict(row)
        del user['password_hash']
        if user.get("created_at"):
            user["created_at"] = user["created_at"].isoformat()
        return user

async def get_all_users() -> List[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            '''
            SELECT id, name, email, phone, role, tag, created_at
            FROM public.users
            ORDER BY id ASC;
            '''
        )
        res = []
        for r in rows:
            d = dict(r)
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            res.append(d)
        return res

async def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            '''
            SELECT id, name, email, phone, role, tag, created_at
            FROM public.users
            WHERE id = $1;
            ''',
            user_id
        )
        if not row:
            return None
        d = dict(row)
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        return d

async def record_call_activity(
    caller_id: Optional[int],
    caller_name: str,
    caller_phone: str,
    callee_id: Optional[int],
    callee_name: str,
    callee_phone: str,
    status: str,
    duration: int = 0,
    fraud_score: int = 0,
    risk_tier: str = "Low Risk",
    flagged: bool = False
) -> Dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            '''
            INSERT INTO public.call_activities (
                caller_id, caller_name, caller_phone,
                callee_id, callee_name, callee_phone,
                status, duration, fraud_score, risk_tier, flagged
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, caller_id, caller_name, caller_phone,
                      callee_id, callee_name, callee_phone,
                      status, duration, fraud_score, risk_tier, flagged, created_at;
            ''',
            caller_id, caller_name, caller_phone,
            callee_id, callee_name, callee_phone,
            status, duration, fraud_score, risk_tier, flagged
        )
        d = dict(row)
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        return d

async def get_user_activities(user_id: int) -> List[Dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            '''
            SELECT id, caller_id, caller_name, caller_phone,
                   callee_id, callee_name, callee_phone,
                   status, duration, fraud_score, risk_tier, flagged, created_at
            FROM public.call_activities
            WHERE caller_id = $1 OR callee_id = $1
            ORDER BY created_at DESC;
            ''',
            user_id
        )
        res = []
        for r in rows:
            d = dict(r)
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            res.append(d)
        return res
