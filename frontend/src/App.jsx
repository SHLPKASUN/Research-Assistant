import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  Check,
  FileText,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './App.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(
  /\/$/,
  '',
);
const API_TIMEOUT_MS = 70_000;

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'The request timed out. Please try again.';
  }
  if (error.message) return error.message;
  return fallback;
}

function App() {
  const [file, setFile] = useState(null);
  const [documentContext, setDocumentContext] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const selectFile = (selectedFile) => {
    if (!selectedFile || uploading) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please choose a PDF file.');
      return;
    }

    setFile(selectedFile);
    setDocumentContext('');
    setAnalysis('');
    setMessages([]);
    setChatError('');
    setUploadError('');
  };

  const handleFileChange = (event) => {
    selectFile(event.target.files?.[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setFile(null);
    setDocumentContext('');
    setAnalysis('');
    setMessages([]);
    setUploadError('');
    setChatError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    setUploadError('');
    setAnalysis('');
    setDocumentContext('');
    setMessages([]);
    setChatError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/analyze-pdf`, formData, {
        timeout: API_TIMEOUT_MS,
      });
      const { analysis: summary, document_context: context } = response.data;

      if (!summary || !context) {
        throw new Error('The server returned an incomplete analysis. Please try again.');
      }

      setAnalysis(summary);
      setDocumentContext(context);
    } catch (error) {
      setUploadError(getErrorMessage(error, 'Unable to analyze this PDF.'));
    } finally {
      setUploading(false);
    }
  };

  const handleAskQuestion = async (event) => {
    event.preventDefault();
    const nextQuestion = question.trim();
    if (!nextQuestion || !documentContext || sending) return;

    const nextMessages = [...messages, { role: 'user', content: nextQuestion }];
    setMessages(nextMessages);
    setQuestion('');
    setSending(true);
    setChatError('');

    try {
      const response = await axios.post(`${API_URL}/ask-question`, {
        document_context: documentContext,
        messages: nextMessages.slice(-20),
      }, {
        timeout: API_TIMEOUT_MS,
      });

      if (!response.data.answer) {
        throw new Error('The server returned an empty answer. Please try again.');
      }

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response.data.answer },
      ]);
    } catch (error) {
      setMessages((current) => current.slice(0, -1));
      setQuestion(nextQuestion);
      setChatError(getErrorMessage(error, 'Unable to answer that question.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="Research Assistant home">
          <span className="brand-mark"><Sparkles size={20} /></span>
          <span>Paper<span className="brand-accent">wise</span></span>
        </a>
        <span className="header-note">AI-powered paper insights</span>
      </header>

      <main className="page-content" id="top">
        <section className="hero">
          <div className="eyebrow"><span /> YOUR RESEARCH, UNDERSTOOD</div>
          <h1>Make every paper<br /><span>easier to understand.</span></h1>
          <p>Get a structured summary, then ask questions grounded in the paper.</p>
        </section>

        <section className="panel upload-panel" aria-labelledby="upload-title">
          <div className="section-heading">
            <div className="section-icon upload-icon"><Upload size={19} /></div>
            <div>
              <span className="section-kicker">STEP 01</span>
              <h2 id="upload-title">Upload a research paper</h2>
            </div>
          </div>

          <form onSubmit={handleUpload}>
            <div
              className={`drop-zone${isDragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsDragging(false);
                }
              }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                className="file-input"
                id="paper-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label className="drop-zone-label" htmlFor="paper-file">
                <span className="drop-icon">
                  {file ? <FileText size={23} /> : <Upload size={23} />}
                </span>
                <span className="drop-copy">
                  <strong>{file ? file.name : 'Choose a PDF to get started'}</strong>
                  <span>{file ? 'Ready to analyze' : 'Browse files or drag and drop here'}</span>
                </span>
                <span className="browse-button">{file ? 'Change file' : 'Browse files'}</span>
              </label>
              <span className="file-hint">PDF files only · One paper at a time</span>
            </div>

            <div className="upload-actions">
              {file && (
                <button
                  className="text-button"
                  type="button"
                  onClick={clearFile}
                  disabled={uploading}
                >
                  <X size={16} /> Remove file
                </button>
              )}
              <button className="primary-button analyze-button" type="submit" disabled={!file || uploading}>
                {uploading ? (
                  <><LoaderCircle className="spinner" size={18} /> Analyzing paper...</>
                ) : (
                  <><Sparkles size={17} /> Generate summary</>
                )}
              </button>
            </div>
          </form>

          {uploadError && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{uploadError}</span>
            </div>
          )}
        </section>

        <div className="workspace-grid">
          <section className="panel summary-panel" aria-labelledby="summary-title">
            <div className="section-heading">
              <div className="section-icon summary-icon"><BookOpen size={19} /></div>
              <div>
                <span className="section-kicker">STEP 02</span>
                <h2 id="summary-title">Structured summary</h2>
              </div>
              {analysis && <span className="ready-badge"><Check size={13} /> Ready</span>}
            </div>

            {analysis ? (
              <div className="markdown-body">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon"><FileText size={23} /></span>
                <strong>Your summary will appear here</strong>
                <p>Upload a paper and generate a summary of its key ideas and findings.</p>
              </div>
            )}
          </section>

          <section className="panel chat-panel" aria-labelledby="chat-title">
            <div className="section-heading">
              <div className="section-icon chat-icon"><MessageCircle size={19} /></div>
              <div>
                <span className="section-kicker">STEP 03</span>
                <h2 id="chat-title">Ask the paper</h2>
              </div>
            </div>

            <div className={`chat-transcript${messages.length ? ' has-messages' : ''}`} aria-live="polite">
              {messages.length === 0 ? (
                <div className="empty-state chat-empty-state">
                  <span className="empty-state-icon"><MessageCircle size={22} /></span>
                  <strong>Curious about something?</strong>
                  <p>Ask a question about the paper. Answers stay grounded in its content.</p>
                </div>
              ) : (
                <div className="message-list">
                  {messages.map((message, index) => (
                    <article
                      className={`chat-message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                      key={`${message.role}-${index}`}
                    >
                      <span className="message-author">
                        {message.role === 'user' ? 'You' : 'Paperwise'}
                      </span>
                      <div className="message-bubble">
                        {message.role === 'assistant' ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <p>{message.content}</p>
                        )}
                      </div>
                    </article>
                  ))}
                  {sending && (
                    <article className="chat-message assistant-message">
                      <span className="message-author">Paperwise</span>
                      <div className="message-bubble typing-indicator" aria-label="Preparing an answer">
                        <LoaderCircle className="spinner" size={18} />
                        <span>Reading the paper...</span>
                      </div>
                    </article>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {chatError && (
              <div className="error-banner chat-error" role="alert">
                <AlertCircle size={17} />
                <span>{chatError}</span>
                <button type="button" onClick={() => setChatError('')} aria-label="Dismiss error">
                  <X size={16} />
                </button>
              </div>
            )}

            <form className="chat-form" onSubmit={handleAskQuestion}>
              <label className="sr-only" htmlFor="question-input">Ask a question about this paper</label>
              <textarea
                id="question-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={documentContext ? 'Ask a question about this paper...' : 'Upload a paper to start asking questions'}
                rows={2}
                maxLength={4000}
                disabled={!documentContext || sending}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form.requestSubmit();
                  }
                }}
              />
              <button
                className="send-button"
                type="submit"
                aria-label="Send question"
                disabled={!documentContext || !question.trim() || sending}
              >
                {sending ? <LoaderCircle className="spinner" size={18} /> : <ArrowUp size={19} />}
              </button>
            </form>
            <div className="chat-footer">
              <span>{documentContext ? 'Answers are based on the uploaded paper' : 'Analyze a PDF to enable the assistant'}</span>
              {messages.length > 0 && (
                <button
                  className="text-button clear-chat-button"
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setChatError('');
                  }}
                  disabled={sending}
                >
                  <RotateCcw size={14} /> Clear chat
                </button>
              )}
            </div>
          </section>
        </div>

        <footer className="page-footer">
          <Sparkles size={14} /> Built to help you focus on the ideas that matter.
        </footer>
      </main>
    </div>
  );
}

export default App;
