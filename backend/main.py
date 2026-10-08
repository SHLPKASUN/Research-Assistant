import os
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
import pypdf

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    raise ValueError("GOOGLE_API_KEY is missing from .env file.")

client = genai.Client(api_key=api_key)

app = FastAPI()

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
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Please upload a PDF file.")

        file_bytes = await file.read()
        pdf_reader = pypdf.PdfReader(BytesIO(file_bytes))
        
        text = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"

        if not text.strip():
            raise HTTPException(status_code=400, detail="No readable text found in the PDF file.")

        prompt = f"""
        You are an expert research assistant.
        Analyze the following research document and provide:
        1. Summary
        2. Key Insights & Takeaways
        3. Main Topics Covered

        Document Content:
        {text[:10000]}
        """

                # Google API එකෙන් ඉල්ලන exact model එක
        response = client.models.generate_content(
            model="gemini-2.0-flash",
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