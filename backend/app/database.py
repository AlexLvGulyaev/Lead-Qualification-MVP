"""Database connection"""
import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import settings


def get_connection():
    """Get database connection"""
    return psycopg2.connect(settings.database_url)


def query_db(query, params=None):
    """Execute query and return results"""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params or ())
            return cur.fetchall()
    finally:
        conn.close()


def query_one(query, params=None):
    """Execute query and return single result"""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params or ())
            return cur.fetchone()
    finally:
        conn.close()