import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from app.db.session import DatabaseManager
from app.db.models import User

db = DatabaseManager()

with db.get_session() as session:
    users = session.query(User).all()
    print(f"Total users found in DB: {len(users)}")
    for u in users:
        print(f"ID: {u.id} | Username: {u.username} | Role: {u.role}")

from app.api.v1.endpoints.users import list_users
import asyncio

async def test_api():
    print("\nTesting list_users API function:")
    try:
        result = await list_users()
        print(f"API result: {result}")
    except Exception as e:
        print(f"API error: {e}")

if __name__ == "__main__":
    asyncio.run(test_api())
