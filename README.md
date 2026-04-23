# 🤖 InvoSync — AI-Powered Invoice Processing Agent

An intelligent agentic pipeline for automated invoice-to-PO matching, built with **LangGraph**, **Gemini 2.5 Flash**, **LlamaParse**, and a **Next.js** real-time dashboard.

## 🚀 Overview

InvoSync automates accounts payable by extracting structured data from PDF invoices, validating it against Purchase Orders in a PostgreSQL database, and surfacing results through a live-streaming dashboard — all powered by a multi-node AI agent graph.

### Key Features
- **🧠 Agentic Pipeline**: Multi-step LangGraph orchestration (Parse → Validate → PO Lookup → Compare)
- **📄 Structured Extraction**: Pydantic schema-enforced output from Gemini 2.5 Flash Lite via LlamaParse
- **⚡ Real-time SSE**: Live node-by-node processing updates streamed to the frontend
- **🔐 Role-Based Access**: Two-tier RBAC (Admin / Operator) with JWT authentication
- **📊 AI Observability**: LangSmith tracing for full prompt/response visibility
- **🗄️ PostgreSQL**: Production-grade database for POs, users, and processing logs

## 🏗️ Architecture

```mermaid
graph TD
    A[PDF Upload via Dashboard] --> B[FastAPI Backend]
    B --> C[LlamaParse — PDF to Markdown]
    C --> D[Gemini 2.5 Flash Lite — Structured Extraction]
    D --> E[Pydantic Validation — InvoiceExtraction Schema]
    E --> F{Valid Invoice?}
    F -->|Yes| G[PO Lookup — PostgreSQL]
    F -->|No| H[Rejected — Reason Logged]
    G --> I[Field-by-Field Comparison]
    I -->|Match| J[✅ Successful]
    I -->|Discrepancy| K[⚠️ Flagged for Review]
    
    B -.->|SSE Stream| L[Next.js Dashboard]
    L --> M[AI Pipeline Monitor]
    L --> N[Stats & Logs]
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI Model** | Google Gemini 2.5 Flash Lite |
| **Agent Framework** | LangGraph + LangChain |
| **Document Parsing** | LlamaParse (layout-aware OCR) |
| **Schema Enforcement** | Pydantic v2 (`InvoiceExtraction`) |
| **Backend** | FastAPI + Uvicorn |
| **Frontend** | Next.js 16 (App Router, TypeScript) |
| **Database** | PostgreSQL + SQLAlchemy |
| **Auth** | JWT (HS256) with RBAC |
| **Observability** | LangSmith Tracing |
| **Streaming** | Server-Sent Events (SSE) |

## 📦 Setup

### 1. Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
pip install -r ../requirements.txt

# Configure environment
cp .env.example .env           # Then edit with your API keys
```

### 2. Frontend
```bash
cd frontend
npm install
```

### 3. Database
Create a PostgreSQL database and set `DATABASE_URL` in `backend/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/your_db
```
Tables are created automatically on first run.

### 4. Run
```bash
# Terminal 1 — Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```
Open **http://localhost:3000**

## 🔑 Environment Variables

See [`backend/.env.example`](backend/.env.example) for the full list:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `LLAMA_CLOUD_API_KEY` | ✅ | LlamaCloud parsing key |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SECRET_KEY` | ✅ | JWT signing secret |
| `LANGCHAIN_API_KEY` | Optional | LangSmith observability |

## 📊 AI Observability (LangSmith)

Add these to `backend/.env` to enable full trace visibility:
```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_key
LANGCHAIN_PROJECT=InvoSync
```
View traces at [smith.langchain.com](https://smith.langchain.com) → Projects → InvoSync

---
*Built with LangGraph agentic orchestration and Gemini structured extraction.*
