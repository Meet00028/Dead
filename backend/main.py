from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Codebase Cartographer Engine")

# Configure CORS so your React frontend (Vite runs on 5173) can talk to Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Securely configure Gemini (Key stays on the server, NOT the browser)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Define what data React will send to Python
class CodePayload(BaseModel):
    code_content: str
    file_name: str

@app.post("/api/summarize")
async def summarize_code(payload: CodePayload):
    try:
        # Initialize Gemini 2.0 Flash
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        prompt = f"""
        Analyze this file ({payload.file_name}) and provide a strict, bulleted architectural summary.
        Include: Primary purpose, Key functions, and Notable dependencies.
        
        Code:
        {payload.code_content}
        """
        
        response = model.generate_content(prompt)
        return {"summary": response.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def health_check():
    return {"status": "Cartographer Engine Online"}