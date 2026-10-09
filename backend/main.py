import os
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
import pypdf

# Load environment variables
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    raise ValueError("GOOGLE_API_KEY is missing from .env file.")

# Initialize Google GenAI client
client = genai.Client(api_key=api_key)

app = FastAPI(title="Research Assistant API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Research Assistant API is running"}

@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...)):
    try:
        # Validate file format
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Please upload a valid PDF file.")

        # Extract text from uploaded PDF
        file_bytes = await file.read()
        pdf_reader = pypdf.PdfReader(BytesIO(file_bytes))
        
        text = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"

        if not text.strip():
            raise HTTPException(status_code=400, detail="No readable text found in the PDF file.")

        # Prompt structured strictly to extract the exact 5 sections required by the specification
        prompt = f"""
        You are an expert AI research assistant.
        Analyze the following research paper thoroughly and generate a structured summary using strictly the following 5 sections:

        1. Title & Authors and Abstract
        2. Problem Statement
        3. Methodology
        4. Key Results
        5. Conclusion

        Ensure each section is clearly highlighted using Markdown headers and bullet points where necessary.

        Document Content:
        {text[:12000]}
        """

        # Call Gemini model API
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt
        )

        if not response.text:
            raise Exception("Gemini returned an empty response.")

        return {
            "filename": file.filename,
            "analysis": response.text
        }

    except HTTPException:
        raise
    except Exception as e:
        print("========== ERROR ==========")
        print(type(e).__name__)
        print(str(e))
        print("===========================")
        raise HTTPException(status_code=500, detail=f"Error occurred: {str(e)}")