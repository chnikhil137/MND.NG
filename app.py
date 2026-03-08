import streamlit as st
import os
from rag_engine import init_qdrant_client, setup_databases, route_query, create_rag_graph, get_db_collections
from document_processor import process_document

def init_session_state():
    if 'messages' not in st.session_state:
        st.session_state.messages = []
    if 'dbs' not in st.session_state:
        st.session_state.dbs = None
    if 'qdrant_client' not in st.session_state:
        st.session_state.qdrant_client = None

init_session_state()

st.title("🧠 MND.NG - Mind Engine")
st.caption("Deep Context Research Analyst & Enterprise Retrieval System")

# Sidebar
with st.sidebar:
    st.header("Command Center")
    api_key = st.text_input("Gemini API Key", type="password")
    
    st.divider()
    
    st.subheader("Data Ingestion")
    uploaded_files = st.file_uploader("Upload PDF Documents", type=['pdf'], accept_multiple_files=True)
    
    collections = get_db_collections()
    db_choice = st.selectbox("Assign to Database", options=list(collections.keys()), format_func=lambda x: collections[x])
    
    if st.button("Process Documents"):
        if not api_key:
            st.error("Please provide a Gemini API Key in the sidebar.")
        elif not uploaded_files:
            st.warning("Please upload at least one PDF.")
        else:
            with st.spinner("Initializing Vector Engine..."):
                if st.session_state.dbs is None:
                    try:
                        client, embeddings = init_qdrant_client(":memory:", "", api_key)
                        st.session_state.qdrant_client = client
                        st.session_state.dbs = setup_databases(client, embeddings)
                    except Exception as e:
                        st.error(f"Failed to initialize engine: {e}")
                        st.stop()
            
            with st.spinner(f"Ingesting into {collections[db_choice]}..."):
                all_chunks = []
                for file in uploaded_files:
                    chunks = process_document(file)
                    all_chunks.extend(chunks)
                
                if all_chunks:
                    try:
                        st.session_state.dbs[db_choice].add_documents(all_chunks)
                        st.toast("✅ Documents successfully processed and ingested!")
                    except Exception as e:
                        st.error(f"Failed to ingest documents: {str(e)}")

st.divider()

# Chat Interface
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Query the Mind Engine..."):
    if not api_key:
        st.warning("Please provide a Gemini API Key in the sidebar.")
        st.stop()
        
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
        
    with st.chat_message("assistant"):
        status_text = st.status("Analyzing routing pathways...", expanded=True)
        
        with status_text:
            if st.session_state.dbs is None:
                st.write("🔧 Initializing vector engine on first query...")
                try:
                    client, embeddings = init_qdrant_client(":memory:", "", api_key)
                    st.session_state.qdrant_client = client
                    st.session_state.dbs = setup_databases(client, embeddings)
                except Exception as e:
                    st.error(f"Failed to initialize engine. Is the API Key valid? Error: {e}")
                    st.stop()

            st.write("🧠 Engaging Gemini router...")
            try:
                target_db_id = route_query(prompt, api_key)
                st.write(f"🎯 Routed to: **{collections.get(target_db_id, 'Unknown')}**")
            except Exception as e:
                st.error(f"Routing failed: {e}. Defaulting to knowledge base.")
                target_db_id = "knowledge_base" # Safe fallback
                
            st.write("🔍 Searching vectors...")
            try:
                graph = create_rag_graph(st.session_state.dbs, api_key)
                # Execute graph
                initial_state = {"question": prompt, "target_db": target_db_id}
                
                final_answer = ""
                for output in graph.stream(initial_state):
                    for key, value in output.items():
                        if key == "retrieve":
                            docs_count = len(value.get('documents', []))
                            st.write(f"📄 Retrieved {docs_count} documents.")
                        elif key == "grade":
                            grade = value.get('grade_status')
                            st.write(f"⚖️ Document relevance grade: {grade}")
                            if grade == "NO":
                                st.write("🌐 Triggering DuckDuckGo web fallback...")
                        elif key == "web_search":
                            st.write("✅ Web research complete.")
                        elif key == "generate":
                            st.write("⚡ Synthesizing final response...")
                            final_answer = value.get("final_answer", "")
                
                if not final_answer:
                    final_answer = "No answer generated by the engine."
                    
                status_text.update(label="Analysis Complete", state="complete", expanded=False)
            except Exception as e:
                status_text.update(label="Analysis Failed", state="error", expanded=False)
                st.error(f"Execution Error: {str(e)}")
                final_answer = f"I encountered an error while processing the request: {str(e)}"
                
        st.markdown(final_answer)
        st.session_state.messages.append({"role": "assistant", "content": final_answer})
