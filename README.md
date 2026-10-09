# Kolakaali AI — Research Assistant for PDFs

Kolakaali AI is a full-stack research assistant for exploring academic papers. Upload one text-based PDF at a time to generate a structured summary, ask questions grounded in the paper, and revisit recent analyses in the browser.

## Project overview

The application extracts text from an uploaded PDF and sends it to the backend's Gemini integration. The generated summary follows these five sections:

1. **Title & Authors and Abstract**
2. **Problem Statement**
3. **Methodology**
4. **Key Results**
5. **Conclusion**

After analysis, users can ask natural-language questions about the paper. The chat is instructed to use the uploaded paper as its source and to say when the paper does not contain enough information to answer. The app also identifies claims or research gaps explicitly described as unverified or tentative in the paper.

Up to five recent analyses, including their extracted document text and chat history, are saved in the browser's local storage so users can reopen them on the same browser and device.

## Tech stack

### Frontend

- React 19 with Vite 8
- JavaScript (JSX)
- Axios for HTTP requests to the API
- React Markdown for rendering summaries
- Framer Motion for interface animations
- Custom dark slate and lime UI

### Backend

- Python 3.11+
- FastAPI and Uvicorn
- pypdf for PDF text extraction
- Google GenAI Python SDK for Gemini API requests
- Pydantic for request validation and structured model responses
- python-dotenv for loading local environment variables

## Project structure

```text
.
├── backend/
│   ├── main.py              # FastAPI API, PDF processing, Gemini summary and chat
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Local API key (create this; do not commit it)
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React interface and application behavior
│   │   ├── App.css           # Application component styles
│   │   ├── index.css         # Global styles
│   │   └── main.jsx          # Frontend entry point
│   ├── index.html
│   ├── package.json
│   └── package-lock.json
└── README.md
```

## Prerequisites

- Node.js **20.19+** or **22.12+** for the Vite 8 development server
- Python **3.11+**
- A Google Gemini API key with access to a model configured by the backend

## Setup and installation

Run the frontend and backend in separate terminals.

### 1. Get the project

```bash
git clone https://github.com/SHLPKASUN/Research-Assistant.git
cd Research-Assistant
```

### 2. Configure and run the backend

Create and activate a virtual environment from the repository root:

**Windows PowerShell**

```powershell
py -3.11 -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
```

**macOS/Linux**

```bash
python3.11 -m venv backend/.venv
source backend/.venv/bin/activate
```

Install backend dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

Create `backend/.env` and add your key:

```dotenv
GOOGLE_API_KEY=your_google_gemini_api_key
```

The backend reads `GOOGLE_API_KEY` from `backend/.env`. Keep the key private and do not commit the `.env` file.

Start the API from the `backend` directory:

```bash
cd backend
uvicorn main:app --reload
```

The API is available at `http://127.0.0.1:8000`. Its root health endpoint is `http://127.0.0.1:8000/`, and the interactive API documentation is at `http://127.0.0.1:8000/docs`.

### 3. Configure and run the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

The frontend defaults to the backend URL `http://127.0.0.1:8000`. To use a different API server, create `frontend/.env` with:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
```

Restart Vite after changing frontend environment variables.

## Key features and how they work

### PDF analysis and structured summary

The frontend sends the selected PDF to the backend's `POST /analyze-pdf` endpoint. The backend extracts embedded text with pypdf, checks that readable text is available, then asks Gemini to return a validated structured response. The summary is requested in the five sections listed above; information not stated in the paper should be identified as such.

The backend currently accepts text-extractable PDFs. Image-only/scanned PDFs may not contain extractable text and are not OCR-processed.

### Grounded question-answering chat

The frontend sends the extracted paper text together with the conversation to `POST /ask-question`. The backend instructs Gemini to answer using only the paper, avoid unsupported assumptions, and clearly say when the paper does not provide enough information. This is prompt-grounded full-document context; a vector database or retrieval-augmented generation (RAG) pipeline is not currently used.

### Paper history

Recent paper summaries, extracted text, and chat messages are saved in the browser's local storage. The history is limited to five papers and is local to that browser/device; it is not a server-side account or cloud-synced history.

### Citations and exports

The interface can produce APA and IEEE-style citation text from metadata identified in the generated summary, copy citations, and copy or export the summary as Markdown or HTML. Users can also use the browser's print dialog to save a printable PDF. Automatically generated citation details should be checked against the original paper before formal use.

## Verification

Start both the backend and frontend, then verify the following manually:

1. Confirm `http://127.0.0.1:8000/` returns a running status message.
2. Upload a text-based research PDF and confirm the analysis completes.
3. Check that all five summary sections appear and compare key statements with the source paper.
4. Ask a question whose answer is in the paper and a question whose answer is absent; check that the latter is not answered with invented details.
5. Reopen the paper from Paper History and check copy/export actions and citations.

Frontend checks can also be run from `frontend/`:

```bash
npm run lint
npm run build
```

## Notes

- The Gemini API key is required by the backend at startup.
- PDF text is sent to the configured Gemini API to generate summaries and answers. Do not upload papers unless you are permitted to share their contents with that service.
- The backend enforces limits on extracted document text and chat input; see `backend/main.py` for the current values.
