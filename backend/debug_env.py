import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path("f:/Documents/Generative AI/InvoSync/backend/.env")
print(f"Checking for .env at: {env_path.resolve()}")
print(f"File exists: {env_path.exists()}")

if env_path.exists():
    load_dotenv(env_path)
    key = os.getenv("GEMINI_API_KEY")
    if key:
        print(f"GEMINI_API_KEY found! (Starts with: {key[:8]}...)")
        print(f"Length: {len(key)}")
    else:
        print("GEMINI_API_KEY NOT found in environment after loading.")
        
    # Check GROQ just in case
    groq = os.getenv("GROQ_API_KEY")
    if groq:
        print(f"GROQ_API_KEY also found! (Starts with: {groq[:8]}...)")
else:
    print("FATAL: .env file not found at the specified path.")
