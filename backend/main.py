from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as api_router

app = FastAPI(
    title="MND.NG Mind Engine API",
    description="Backend API for the Mind Engine RAG System",
    version="1.0.0",
)

# Configure CORS for Next.js frontend (default dev port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Mind Engine API is running"}
