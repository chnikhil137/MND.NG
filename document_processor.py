import os
import tempfile
from typing import List
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
import streamlit as st

def process_document(file) -> List[Document]:
    """Process uploaded PDF document directly with chunking for Preset C."""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            tmp_file.write(file.getvalue())
            tmp_path = tmp_file.name
            
        loader = PyPDFLoader(tmp_path)
        documents = loader.load()
        
        os.unlink(tmp_path)
        
        # Preset C: Chunk size: 1500 tokens. Overlap: 250 tokens
        # Langchain RecursiveCharacterTextSplitter uses characters. 1 token ~ 4 chars.
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=6000, 
            chunk_overlap=1000 
        )
        texts = text_splitter.split_documents(documents)
        
        return texts
    except Exception as e:
        st.error(f"Error processing document: {e}")
        return []
