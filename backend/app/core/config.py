from pydantic_settings import BaseSettings
from typing import Optional
import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in backend/ directory (3 parents up from backend/app/core/config.py)
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

class Settings(BaseSettings):
    """Application settings using Pydantic."""

    # API Keys
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    llama_cloud_api_key: str = os.getenv("LLAMA_CLOUD_API_KEY", "")
    
    # Database
    database_url: Optional[str] = os.getenv("DATABASE_URL")
    db_name: str = os.getenv("DB_NAME", "po_db")
    db_user: str = os.getenv("DB_USER", "postgres")
    db_password: str = os.getenv("DB_PASSWORD", "")
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: int = int(os.getenv("DB_PORT", 5432))
    
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "7b0b14c7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5") # Change this in prod!
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 # 24 hours
    
    # Processing Settings
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", 10))
    
    # Retry Settings
    max_retries: int = int(os.getenv("MAX_RETRIES", 3))
    

    # Paths
    # Keep temp_dir relative to the project root for consistency
    temp_dir: Path = Path(__file__).resolve().parent.parent.parent.parent / "invoices_temp"

    class Config:
        env_file = str(Path(__file__).resolve().parent.parent.parent / ".env")
        extra = "ignore"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
    
    def get_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

settings = Settings()
