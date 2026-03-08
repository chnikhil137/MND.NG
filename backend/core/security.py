from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Required for decoding Supabase JWTs properly
ALGORITHM = "HS256"

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Verifies the JWT token from the Authorization header using the Supabase JWT Secret.
    """
    token = credentials.credentials
    if not SUPABASE_JWT_SECRET:
        # If running locally without env, we pass for dev purposes but warn
        print("WARNING: SUPABASE_JWT_SECRET not set. Authentication bypassed.")
        return {"sub": "anonymous-dev-user"}

    try:
        # Decode the token using the Supabase JWT secret
        payload = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=[ALGORITHM],
            options={"verify_aud": False} # Supabase aud is usually 'authenticated'
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=401, 
            detail=f"Invalid authentication credentials: {str(e)}"
        )
