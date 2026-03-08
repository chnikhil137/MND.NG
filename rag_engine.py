import os
from typing import TypedDict, Literal, Dict
from langchain_core.messages import BaseMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Qdrant
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from langchain_community.tools import DuckDuckGoSearchRun
from langgraph.graph import StateGraph, END

# Preset C configs
K_VALUE = 8

class AgentState(TypedDict):
    question: str
    target_db: str
    documents: list
    web_results: str
    final_answer: str

def get_db_collections():
    return {
        "knowledge_base": "Internal Knowledge Base",
        "research": "Research Papers & Articles",
        "strategy": "Strategic Documentation"
    }

def init_qdrant_client(qdrant_url: str, qdrant_api_key: str, google_api_key: str):
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=google_api_key)
    if qdrant_url == ":memory:":
        client = QdrantClient(location=":memory:")
    else:
        client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
    return client, embeddings

def setup_databases(client: QdrantClient, embeddings: GoogleGenerativeAIEmbeddings):
    dbs = {}
    vector_size = 768 # Google embedding-001 size
    collections = get_db_collections()
    
    for coll_id in collections.keys():
        try:
            client.get_collection(coll_id)
        except Exception:
            client.create_collection(
                collection_name=coll_id,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
            )
        
        dbs[coll_id] = Qdrant(
            client=client,
            collection_name=coll_id,
            embeddings=embeddings
        )
    return dbs

def route_query(question: str, google_api_key: str) -> str:
    """Uses Gemini to route the query to one of the 3 databases."""
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=google_api_key, temperature=0.0)
    
    prompt = f"""You are a strict routing agent for MND.NG - Mind Engine. 
Classify the user's query into EXACTLY ONE of these 3 database IDs:
- 'knowledge_base': Engineering, Architecture, Best Practices, internal wiki.
- 'research': Deep context, academic theory, industry reports, synthesized research.
- 'strategy': Roadmaps, Business Plans, Compliance, high-level strategy.

Output ONLY the exact database ID string. No other text, punctuation, or formatting.
If unsure, default to 'knowledge_base'.

Query: {question}"""
    
    response = llm.invoke(prompt)
    target = response.content.strip().lower()
    
    valid_dbs = list(get_db_collections().keys())
    for vdb in valid_dbs:
        if vdb in target:
            return vdb
            
    return "knowledge_base"

# LangGraph Nodes
def retrieve_node(state: AgentState, dbs: Dict[str, Qdrant]):
    question = state["question"]
    target_db = state["target_db"]
    
    db = dbs.get(target_db)
    if not db:
        return {"documents": []}
        
    retriever = db.as_retriever(search_kwargs={"k": K_VALUE})
    docs = retriever.invoke(question)
    
    return {"documents": docs}

def grade_documents_node(state: AgentState, google_api_key: str):
    """Evaluates if the retrieved documents answer the query."""
    question = state["question"]
    docs = state.get("documents", [])
    
    if not docs:
        return {"grade_status": "NO"}
        
    doc_text = "\n\n".join([d.page_content for d in docs])
    
    # Use Gemini-1.5-flash for faster, strict grading
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=google_api_key, temperature=0.0)
    prompt = f"""You are a strict grader evaluating if the provided context can answer the user's question.
Context:
{doc_text}

Question: {question}

Can the context fully answer the question? Respond ONLY with 'YES' or 'NO'."""

    response = llm.invoke(prompt)
    grade = response.content.strip().upper()
    
    if "YES" in grade:
        return {"grade_status": "YES"}
    else:
        return {"grade_status": "NO"}

def web_search_node(state: AgentState):
    """Triggers DuckDuckGo fallback."""
    question = state["question"]
    search = DuckDuckGoSearchRun()
    try:
        results = search.invoke(question)
    except:
        results = "Web search failed or yielded no results."
    
    return {"web_results": results}

def generate_node(state: AgentState, google_api_key: str):
    question = state["question"]
    docs = state.get("documents", [])
    web_results = state.get("web_results", "")
    target_db = state["target_db"]
    
    # Preset C Gemini config: Deep Context, Research Analyst
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", google_api_key=google_api_key, temperature=0.2, top_p=0.95)
    
    if web_results:
        # Fallback was used
        prompt = f"""You are MND.NG - Mind Engine, a Research Analyst AI.
The internal database ('{get_db_collections().get(target_db)}') did not contain adequate information to answer the query.
You performed a web search fallback via DuckDuckGo.
Explicitly state that this answer is derived from external web search context, not internal databases.

Web Context:
{web_results}

Question: {question}

Provide a deep, comprehensive answer."""
    else:
        # Internal docs were sufficient
        doc_text = "\n\n".join([d.page_content for d in docs])
        prompt = f"""You are MND.NG - Mind Engine, a Research Analyst AI.
Synthesize a deep, comprehensive answer based ONLY on the provided context retrieved from the '{get_db_collections().get(target_db)}' database.
If the context is insufficient, state exactly what is missing. Do not hallucinate external facts.

Internal Context:
{doc_text}

Question: {question}

Answer:"""

    response = llm.invoke(prompt)
    return {"final_answer": response.content}

def create_rag_graph(dbs: Dict[str, Qdrant], google_api_key: str):
    workflow = StateGraph(AgentState)
    
    # Adding nodes with closures for injected dependencies
    workflow.add_node("retrieve", lambda state: retrieve_node(state, dbs))
    workflow.add_node("grade", lambda state: grade_documents_node(state, google_api_key))
    workflow.add_node("web_search", web_search_node)
    workflow.add_node("generate", lambda state: generate_node(state, google_api_key))
    
    # Defining edges
    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "grade")
    
    def route_after_grade(state: AgentState) -> Literal["generate", "web_search"]:
        if state.get("grade_status", "NO") == "YES":
            return "generate"
        return "web_search"
        
    workflow.add_conditional_edges("grade", route_after_grade)
    workflow.add_edge("web_search", "generate")
    workflow.add_edge("generate", END)
    
    return workflow.compile()
