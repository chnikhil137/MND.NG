from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict
import asyncio
from core.rag_engine import (
    process_document, 
    init_qdrant_client, 
    setup_databases, 
    route_query, 
    create_rag_graph, 
    get_db_collections
)
from core.security import verify_token

router = APIRouter()

# Global state for prototype (in production, use a proper dependency injection/db session)
class EngineState:
    def __init__(self):
        self.dbs = None
        self.qdrant_client = None
        self.embeddings = None

state = EngineState()

class QueryRequest(BaseModel):
    query: str
    api_key: str

class QueryResponse(BaseModel):
    answer: str
    routed_db: str
    used_fallback: bool

@router.get("/collections")
def list_collections():
    return get_db_collections()

@router.post("/upload")
async def upload_documents(
    api_key: str = Form(...),
    db_id: str = Form(...),
    files: List[UploadFile] = File(...),
    user_payload: dict = Depends(verify_token)
):
    if db_id not in get_db_collections().keys():
        raise HTTPException(status_code=400, detail="Invalid Database ID")
        
    if not state.dbs:
        try:
            client, embeddings = init_qdrant_client("db_storage", "", api_key)
            state.qdrant_client = client
            state.embeddings = embeddings
            state.dbs = setup_databases(client, embeddings)
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Engine initialization failed: {e}")

    try:
        all_chunks = []
        for file in files:
            content = await file.read()
            chunks = await process_document(content)
            all_chunks.extend(chunks)
            
        if all_chunks:
            state.dbs[db_id].add_documents(all_chunks)
            
        return {"message": f"Successfully ingested {len(files)} files ({len(all_chunks)} chunks) into {db_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query", response_model=QueryResponse)
async def query_engine(req: QueryRequest, user_payload: dict = Depends(verify_token)):
    if not state.dbs:
        try:
            client, embeddings = init_qdrant_client("db_storage", "", req.api_key)
            state.qdrant_client = client
            state.embeddings = embeddings
            state.dbs = setup_databases(client, embeddings)
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Engine init failed. Bad API key? {e}")

    try:
        # 1. Route the query
        target_db_id = route_query(req.query, req.api_key)
        
        # 2. Execute RAG Graph
        graph = create_rag_graph(state.dbs, req.api_key)
        initial_state = {"question": req.query, "target_db": target_db_id}
        
        final_answer = ""
        used_fallback = False
        
        # Stream the graph execution to extract the final state
        # In a real app we might use websockets for streaming tokens, but we await the whole DAG here
        for output in graph.stream(initial_state):
            for key, value in output.items():
                if key == "web_search":
                    used_fallback = True
                if key == "generate":
                    final_answer = value.get("final_answer", "")
                    
        return QueryResponse(
            answer=final_answer,
            routed_db=target_db_id,
            used_fallback=used_fallback
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
