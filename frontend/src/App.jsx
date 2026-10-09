import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import {
  AlertCircle,
  ArrowUp,
  Check,
  CircleHelp,
  Copy,
  Download,
  FileDown,
  FileText,
  History,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Printer,
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
const PAPER_HISTORY_KEY = 'research-assistant-paper-history';
const MAX_HISTORY_ITEMS = 5;
const SUGGESTED_QUESTIONS = [
  'Explain the methodology',
  'What are the main limitations?',
  'What are practical applications?',
];

const workspaceVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};
const workspaceGroupVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};
const workspaceCardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};
const featureCardMotionProps = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: 'easeOut' },
};

function LoadingSkeleton({ variant }) {
  return (
    <div className={`loading-skeleton loading-skeleton-${variant}`} role="status">
      <span className="sr-only">Analyzing paper, please wait.</span>
      <div className="skeleton-block" />
      <div className="skeleton-line skeleton-line-long" />
      <div className="skeleton-line skeleton-line-medium" />
      <div className="skeleton-line skeleton-line-short" />
      {variant === 'summary' && (
        <>
          <div className="skeleton-block skeleton-block-secondary" />
          <div className="skeleton-line skeleton-line-long" />
          <div className="skeleton-line skeleton-line-medium" />
        </>
      )}
    </div>
  );
}

function loadPaperHistory() {
  try {
    const savedHistory = JSON.parse(localStorage.getItem(PAPER_HISTORY_KEY) || '[]');
    if (!Array.isArray(savedHistory)) {
      throw new Error('Saved paper history has an invalid format.');
    }

    return {
      papers: savedHistory
        .filter((paper) => (
          paper
          && typeof paper.id === 'string'
          && typeof paper.title === 'string'
          && typeof paper.filename === 'string'
          && typeof paper.analysis === 'string'
          && typeof paper.documentContext === 'string'
          && Array.isArray(paper.messages)
        ))
        .map((paper) => ({
          ...paper,
          unverifiedClaims: Array.isArray(paper.unverifiedClaims)
            ? paper.unverifiedClaims.filter((claim) => typeof claim === 'string')
            : null,
        }))
        .slice(0, MAX_HISTORY_ITEMS),
      error: '',
    };
  } catch (error) {
    console.error('Could not load saved paper history.', error);
    return {
      papers: [],
      error: 'Saved paper history could not be loaded from this browser.',
    };
  }
}

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'The request timed out. Please try again.';
  }
  if (error.message) return error.message;
  return fallback;
}

function cleanCitationText(value) {
  return value
    .replace(/\*\*|__/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCitationMetadata(summary) {
  const titleSection = summary.match(
    /^#{1,3}\s*Title\s*&\s*Authors\s+and\s+Abstract[^\n]*\n([\s\S]*?)(?=^#{1,3}\s|(?![\s\S]))/im,
  )?.[1] || summary;
  const plainTitleSection = titleSection.replace(/\*\*|__/g, '');
  const extractField = (label) => {
    const match = plainTitleSection.match(
      new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${label}\\s*:\\s*([^\\n]+)`, 'i'),
    );
    return match ? cleanCitationText(match[1]) : '';
  };

  const title = extractField('Title');
  const authorText = extractField('Authors');
  const authors = authorText
    .replace(/\([^)]*\)/g, '')
    .split(/\s*(?:,|;|\band\b|&)\s*/i)
    .map((author) => author.trim())
    .filter(Boolean);
  const yearMatch = plainTitleSection.match(
    /(?:^|\n)\s*(?:[-*]\s*)?(?:Publication\s+)?Year\s*:\s*((?:19|20)\d{2})\b/i,
  );

  return {
    title,
    authors,
    year: yearMatch?.[1] || 'n.d.',
  };
}

function formatApaAuthor(author) {
  const names = author.split(/\s+/).filter(Boolean);
  if (names.length < 2) return names[0] || '';

  const surname = names.pop().replace(/,$/, '');
  const initials = names
    .map((name) => name.split('-').map((part) => `${part[0]?.toUpperCase() || ''}.`).join('-'))
    .join(' ');
  return `${surname}, ${initials}`;
}

function formatIeeeAuthor(author) {
  const names = author.split(/\s+/).filter(Boolean);
  if (names.length < 2) return names[0] || '';

  const surname = names.pop().replace(/,$/, '');
  const initials = names
    .map((name) => name.split('-').map((part) => `${part[0]?.toUpperCase() || ''}.`).join('-'))
    .join(' ');
  return `${initials} ${surname}`;
}

function formatAuthorList(authors, formatAuthor, conjunction) {
  const formattedAuthors = authors.map(formatAuthor);
  if (formattedAuthors.length < 2) return formattedAuthors.join('');

  const precedingAuthors = formattedAuthors.slice(0, -1).join(', ');
  const lastAuthor = formattedAuthors[formattedAuthors.length - 1];
  return `${precedingAuthors}${conjunction === '&' ? ', &' : ', and'} ${lastAuthor}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderMarkdownInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '<strong>$1$2</strong>')
    .replace(/\*(.+?)\*|_(.+?)_/g, '<em>$1$2</em>');
}

function renderMarkdownToHtml(markdown) {
  const output = [];
  let paragraph = [];
  let listType = '';

  const closeParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${paragraph.map(renderMarkdownInline).join(' ')}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      output.push(`</${listType}>`);
      listType = '';
    }
  };

  markdown.split(/\r?\n/).forEach((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unorderedItem = line.match(/^\s*[-*]\s+(.+)$/);
    const orderedItem = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (!line.trim()) {
      closeParagraph();
      closeList();
    } else if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
    } else if (unorderedItem || orderedItem) {
      closeParagraph();
      const nextListType = unorderedItem ? 'ul' : 'ol';
      if (listType !== nextListType) {
        closeList();
        output.push(`<${nextListType}>`);
        listType = nextListType;
      }
      output.push(`<li>${renderMarkdownInline((unorderedItem || orderedItem)[1])}</li>`);
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  });

  closeParagraph();
  closeList();
  return output.join('\n');
}

function createExportHtml(summary, title, apaCitation, ieeeCitation) {
  const citations = [apaCitation, ieeeCitation]
    .filter(Boolean)
    .map((citation) => `<li>${escapeHtml(citation)}</li>`)
    .join('\n');
  const citationSection = citations
    ? `<section class="references"><h2>References</h2><ul>${citations}</ul></section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #172033; }
    body { max-width: 820px; margin: 48px auto; padding: 0 28px; line-height: 1.7; }
    h1, h2, h3 { color: #172033; line-height: 1.3; }
    h1 { padding-bottom: 12px; border-bottom: 3px solid #00ff00; }
    h2 { margin-top: 30px; padding-bottom: 6px; border-bottom: 1px solid #d8e0e8; }
    li { margin: 6px 0; }
    code { padding: 2px 5px; background: #f0f3f6; border-radius: 4px; }
    .references { margin-top: 42px; }
    @media print {
      body { max-width: none; margin: 0; padding: 0; }
      h1, h2, h3 { break-after: avoid; }
      p, li { orphans: 3; widows: 3; }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${renderMarkdownToHtml(summary)}
    ${citationSection}
  </main>
</body>
</html>`;
}

function App() {
  const [historyState, setHistoryState] = useState(loadPaperHistory);
  const { papers, error: historyError } = historyState;
  const [file, setFile] = useState(null);
  const [documentContext, setDocumentContext] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [unverifiedClaims, setUnverifiedClaims] = useState(null);
  const [activePaperId, setActivePaperId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(-1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [exportError, setExportError] = useState('');
  const copyStatusTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const progressTimerRef = useRef(null);
  const citationMetadata = getCitationMetadata(analysis);
  const currentPaperTitle = citationMetadata.title
    || file?.name.replace(/\.pdf$/i, '')
    || papers.find((paper) => paper.id === activePaperId)?.title
    || 'Research paper summary';
  const apaAuthors = citationMetadata.authors.length
    ? `${formatAuthorList(citationMetadata.authors, formatApaAuthor, '&')} `
    : '';
  const apaCitation = citationMetadata.title
    ? `${apaAuthors}(${citationMetadata.year}). ${citationMetadata.title}.`
    : '';
  const ieeeCitation = citationMetadata.title
    ? `${citationMetadata.authors.length ? `${formatAuthorList(citationMetadata.authors, formatIeeeAuthor, 'and')}, ` : ''}“${citationMetadata.title},” ${citationMetadata.year === 'n.d.' ? '[n.d.]' : `${citationMetadata.year}.`}`
    : '';

  const updatePaperHistory = (updatePapers) => {
    const nextPapers = updatePapers(papers);
    let errorMessage = '';
    try {
      localStorage.setItem(PAPER_HISTORY_KEY, JSON.stringify(nextPapers));
    } catch (error) {
      console.error('Could not save paper history.', error);
      errorMessage = 'Paper history could not be saved. Check this browser’s local storage space.';
    }
    setHistoryState({ papers: nextPapers, error: errorMessage });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => () => window.clearTimeout(copyStatusTimerRef.current), []);

  useEffect(() => {
    if (!uploading || uploadStep !== 1) return undefined;

    const timer = window.setTimeout(() => {
      setUploadStep(2);
      setUploadProgress(65);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [uploading, uploadStep]);

  useEffect(() => {
    if (!uploading || uploadStep !== 2) return undefined;

    const timer = window.setInterval(() => {
      setUploadProgress((current) => Math.min(94, current + 1));
    }, 350);
    return () => window.clearInterval(timer);
  }, [uploading, uploadStep]);

  useEffect(() => () => window.clearTimeout(progressTimerRef.current), []);

  const selectFile = (selectedFile) => {
    if (!selectedFile || uploading) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please choose a PDF file.');
      return;
    }

    setFile(selectedFile);
    setActivePaperId('');
    setDocumentContext('');
    setAnalysis('');
    setUnverifiedClaims(null);
    setCopyStatus('');
    setMessages([]);
    setChatError('');
    setUploadError('');
    setExportError('');
    setUploadStep(-1);
    setUploadProgress(0);
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
    setActivePaperId('');
    setDocumentContext('');
    setAnalysis('');
    setUnverifiedClaims(null);
    setCopyStatus('');
    setMessages([]);
    setUploadError('');
    setChatError('');
    setExportError('');
    setUploadStep(-1);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    window.clearTimeout(progressTimerRef.current);
    setUploadStep(0);
    setUploadProgress(4);
    setActivePaperId('');
    setUploadError('');
    setAnalysis('');
    setUnverifiedClaims(null);
    setDocumentContext('');
    setMessages([]);
    setChatError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/analyze-pdf`, formData, {
        timeout: API_TIMEOUT_MS,
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const ratio = Math.min(1, progressEvent.loaded / progressEvent.total);
          setUploadProgress(4 + Math.round(ratio * 34));
          if (ratio === 1) setUploadStep((current) => (current < 1 ? 1 : current));
        },
      });
      const {
        summary,
        analysis: legacySummary,
        unverified_claims: claims,
        document_context: context,
      } = response.data;
      const paperSummary = summary || legacySummary;

      if (!paperSummary || !context || !Array.isArray(claims)
        || claims.some((claim) => typeof claim !== 'string')) {
        throw new Error('The server returned an incomplete analysis. Please try again.');
      }

      setAnalysis(paperSummary);
      setUnverifiedClaims(claims);
      setDocumentContext(context);
      const paperId = window.crypto?.randomUUID?.()
        || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const paperTitle = getCitationMetadata(paperSummary).title
        || file.name.replace(/\.pdf$/i, '');
      setActivePaperId(paperId);
      updatePaperHistory((currentPapers) => [
          {
            id: paperId,
            title: paperTitle,
            filename: file.name,
            analysis: paperSummary,
            documentContext: context,
            unverifiedClaims: claims,
            messages: [],
          },
          ...currentPapers.filter((paper) => paper.id !== paperId),
        ].slice(0, MAX_HISTORY_ITEMS));
      setCopyStatus('');
      setExportError('');
      setUploadStep(3);
      setUploadProgress(100);
      progressTimerRef.current = window.setTimeout(() => {
        setUploadStep(-1);
        setUploadProgress(0);
      }, 1400);
    } catch (error) {
      setUploadStep(-1);
      setUploadProgress(0);
      setUploadError(getErrorMessage(error, 'Unable to analyze this PDF.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSummary = () => {
    if (!analysis) return;

    const summaryFile = new Blob([analysis], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(summaryFile, 'research_summary.md');
  };

  const downloadBlob = (blob, filename) => {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  };

  const handleDownloadHtml = () => {
    if (!analysis) return;

    const htmlFile = new Blob(
      [createExportHtml(analysis, currentPaperTitle, apaCitation, ieeeCitation)],
      { type: 'text/html;charset=utf-8' },
    );
    downloadBlob(htmlFile, 'research_summary.html');
    setExportError('');
  };

  const handlePrintSummary = () => {
    if (!analysis) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setExportError('Allow pop-ups for this site to print or save the summary as a PDF.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      createExportHtml(analysis, currentPaperTitle, apaCitation, ieeeCitation),
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
    setExportError('');
  };

  const handleSelectHistory = (paper) => {
    if (uploading || sending) return;

    setActivePaperId(paper.id);
    setFile(null);
    setAnalysis(paper.analysis);
    setUnverifiedClaims(paper.unverifiedClaims);
    setDocumentContext(paper.documentContext);
    setMessages(paper.messages);
    setQuestion('');
    setUploadError('');
    setChatError('');
    setCopyStatus('');
    setExportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyText = async (text, label) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable in this browser.');
      }
      await navigator.clipboard.writeText(text);
      setCopyStatus('Copied!');
    } catch (error) {
      setCopyStatus(error.message || `Could not copy ${label}.`);
    }

    window.clearTimeout(copyStatusTimerRef.current);
    copyStatusTimerRef.current = window.setTimeout(() => setCopyStatus(''), 2200);
  };

  const handleAskQuestion = async (questionText) => {
    const nextQuestion = questionText.trim();
    if (!nextQuestion || !documentContext || sending) return;

    const nextMessages = [...messages, { role: 'user', content: nextQuestion }];
    setMessages(nextMessages);
    updatePaperHistory((currentPapers) => currentPapers.map((paper) => (
      paper.id === activePaperId ? { ...paper, messages: nextMessages } : paper
    )));
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

      const completedMessages = [
        ...nextMessages,
        { role: 'assistant', content: response.data.answer },
      ];
      setMessages(completedMessages);
      updatePaperHistory((currentPapers) => currentPapers.map((paper) => (
        paper.id === activePaperId ? { ...paper, messages: completedMessages } : paper
      )));
    } catch (error) {
      const restoredMessages = nextMessages.slice(0, -1);
      setMessages(restoredMessages);
      updatePaperHistory((currentPapers) => currentPapers.map((paper) => (
        paper.id === activePaperId ? { ...paper, messages: restoredMessages } : paper
      )));
      setQuestion(nextQuestion);
      setChatError(getErrorMessage(error, 'Unable to answer that question.'));
    } finally {
      setSending(false);
    }
  };

  const handleQuestionSubmit = (event) => {
    event.preventDefault();
    void handleAskQuestion(question);
  };

  return (
    <LazyMotion features={domAnimation}>
    <div className="app-shell">
      <m.header
        className="app-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <a className="brand" href="#top" aria-label="කොළකෑලි AI home">
          <span className="sinhala-brand">
            <span className="sinhala-brand-text">කොළකෑලි</span>
            <svg
              className="sinhala-brand-underline"
              viewBox="0 0 230 20"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M4 13 Q102 1 178 9 Q191 10 202 12 Q187 11 177 10 Q101 5 4 16 Q0 15 4 13Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="ai-brand">AI</span>
        </a>
        <span className="header-note">Smarter Research Starts Here</span>
      </m.header>

      <main className="page-content" id="top">
        <m.section
          className="hero"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
        >
          <div className="eyebrow"><span /> YOUR RESEARCH, UNDERSTOOD</div>
          <h1>Make Every Paper<br /><span>Easier To Understand.</span></h1>
          <p>Get a structured summary, then ask questions grounded in the paper.</p>
        </m.section>

        <m.section
          className="panel upload-panel"
          aria-labelledby="upload-title"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.14 }}
        >
          <div className="section-heading">
            <div className="section-icon upload-icon"><Upload size={19} /></div>
            <div>
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

          {uploadStep >= 0 && (
            <div className="upload-progress" role="status" aria-live="polite">
              <div
                className="progress-track"
                role="progressbar"
                aria-label={`PDF analysis progress: ${['Uploading PDF', 'Extracting Text', 'AI Analyzing', 'Analysis complete'][uploadStep]}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
                aria-valuetext={`${uploadProgress}% — ${['Uploading PDF', 'Extracting Text', 'AI Analyzing', 'Analysis complete'][uploadStep]}`}
              >
                <span className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <ol className="progress-steps">
                {['Uploading PDF', 'Extracting Text', 'AI Analyzing'].map((step, index) => (
                  <li
                    className={index < uploadStep ? 'is-complete' : index === uploadStep ? 'is-current' : ''}
                    key={step}
                  >
                    <span className="progress-step-marker">
                      {index < uploadStep ? <Check size={11} /> : index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {uploadError && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{uploadError}</span>
            </div>
          )}
        </m.section>

        <m.div
          className="research-workspace"
          variants={workspaceVariants}
          initial="hidden"
          animate="visible"
        >
          <m.aside
            className="paper-sidebar"
            aria-label="Paper history and research gaps"
            variants={workspaceCardVariants}
          >
            <section className="paper-history panel" aria-labelledby="paper-history-title">
              <div className="history-heading">
                <div className="history-title">
                  <History size={17} aria-hidden="true" />
                  <h2 id="paper-history-title">Paper history</h2>
                  <span className="tooltip-wrap">
                    <button
                      className="tooltip-trigger"
                      type="button"
                      aria-label="About Paper History"
                      aria-describedby="paper-history-tooltip"
                    >
                      <CircleHelp size={14} aria-hidden="true" />
                    </button>
                    <span className="tooltip-content" role="tooltip" id="paper-history-tooltip">
                      Your five most recent summaries are saved in this browser so you can reopen them later.
                    </span>
                  </span>
                </div>
                <span className="history-count">{papers.length}/{MAX_HISTORY_ITEMS}</span>
              </div>
              <p className="history-caption">Saved on this device</p>
              {historyError && (
                <p className="history-error" role="alert">{historyError}</p>
              )}
              {papers.length ? (
                <ul className="paper-history-list">
                  {papers.map((paper) => (
                    <li key={paper.id}>
                      <button
                        className={`history-paper-button${paper.id === activePaperId ? ' is-active' : ''}`}
                        type="button"
                        onClick={() => handleSelectHistory(paper)}
                        disabled={uploading || sending}
                        aria-current={paper.id === activePaperId ? 'true' : undefined}
                        title={paper.title}
                      >
                        <FileText size={16} aria-hidden="true" />
                        <span>{paper.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="history-empty">Your summarized papers will appear here.</p>
              )}
            </section>

            <section
              className="unverified-card panel"
              aria-labelledby="unverified-title"
              aria-busy={uploading}
            >
              <div className="unverified-heading">
                <span className="unverified-icon" aria-hidden="true">
                  <Lightbulb size={17} />
                </span>
                <h2 id="unverified-title">Unverified Claims &amp; Gaps</h2>
                <span className="tooltip-wrap">
                  <button
                    className="tooltip-trigger"
                    type="button"
                    aria-label="About Unverified Claims and Gaps"
                    aria-describedby="unverified-tooltip"
                  >
                    <CircleHelp size={14} aria-hidden="true" />
                  </button>
                  <span className="tooltip-content" role="tooltip" id="unverified-tooltip">
                    Highlights tentative claims and open research gaps explicitly mentioned in the paper.
                  </span>
                </span>
              </div>
              {uploading ? (
                <LoadingSkeleton variant="claims" />
              ) : !analysis ? (
                <p className="unverified-placeholder">
                  Upload a paper to reveal research gaps.
                </p>
              ) : unverifiedClaims === null ? (
                <p className="unverified-placeholder">
                  Research gaps were not captured for this saved paper.
                </p>
              ) : (
                <ul className="unverified-list">
                  {unverifiedClaims.map((claim, index) => (
                    <li key={`${index}-${claim}`}>{claim}</li>
                  ))}
                </ul>
              )}
            </section>
          </m.aside>

          <m.div
            className="workspace-grid"
            variants={workspaceGroupVariants}
          >
          <m.section
            className="panel summary-panel"
            aria-labelledby="summary-title"
            aria-busy={uploading}
            variants={workspaceCardVariants}
          >
            <div className="section-heading">
              <div className="section-icon summary-icon"><FileText size={19} /></div>
              <div>
                <h2 id="summary-title">Structured summary</h2>
              </div>
              {analysis && (
                <div className="summary-header-actions">
                  <button
                    className="summary-action-button"
                    type="button"
                    onClick={() => void copyText(analysis, 'summary')}
                  >
                    <Copy size={14} /> Copy Summary
                  </button>
                  <button
                    className="summary-action-button"
                    type="button"
                    onClick={handleDownloadSummary}
                  >
                    <Download size={14} /> Download (.md)
                  </button>
                  <button
                    className="summary-action-button"
                    type="button"
                    onClick={handleDownloadHtml}
                  >
                    <FileDown size={14} /> Download (.html)
                  </button>
                  <button
                    className="summary-action-button"
                    type="button"
                    onClick={handlePrintSummary}
                  >
                    <Printer size={14} /> Print / Save PDF
                  </button>
                  <span className="ready-badge"><Check size={13} /> Ready</span>
                </div>
              )}
            </div>
            {exportError && (
              <div className="error-banner export-error" role="alert">
                <AlertCircle size={17} />
                <span>{exportError}</span>
              </div>
            )}
            {analysis && copyStatus && (
              <div className="copy-status" role="status" aria-live="polite">{copyStatus}</div>
            )}

            {uploading ? (
              <LoadingSkeleton variant="summary" />
            ) : analysis ? (
              <>
                <div className="markdown-body">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
                <div className="citation-box">
                  <div className="citation-heading">
                    <div>
                      <span className="section-kicker">REFERENCE</span>
                      <h3>Quick citations</h3>
                    </div>
                  </div>
                  {citationMetadata.title ? (
                    <>
                      <div className="citation-entry">
                        <div className="citation-label">APA</div>
                        <p>{apaAuthors}({citationMetadata.year}). <em>{citationMetadata.title}</em>.</p>
                        <button
                          className="citation-copy-button"
                          type="button"
                          onClick={() => void copyText(apaCitation, 'APA citation')}
                          aria-label="Copy APA citation"
                        >
                          <Copy size={14} /> Copy
                        </button>
                      </div>
                      <div className="citation-entry">
                        <div className="citation-label">IEEE</div>
                        <p>{ieeeCitation}</p>
                        <button
                          className="citation-copy-button"
                          type="button"
                          onClick={() => void copyText(ieeeCitation, 'IEEE citation')}
                          aria-label="Copy IEEE citation"
                        >
                          <Copy size={14} /> Copy
                        </button>
                      </div>
                      <p className="citation-note">
                        {citationMetadata.year === 'n.d.'
                          ? 'Publication year was not found in the generated summary.'
                          : 'Check generated citation details against the original paper.'}
                      </p>
                    </>
                  ) : (
                    <p className="citation-note">
                      A title could not be identified in the summary, so citations could not be generated.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon"><FileText size={23} /></span>
                <strong>Your summary will appear here</strong>
                <p>Upload a paper and generate a summary of its key ideas and findings.</p>
              </div>
            )}
          </m.section>

          <m.section
            className="panel chat-panel"
            aria-labelledby="chat-title"
            variants={workspaceCardVariants}
          >
            <div className="section-heading">
              <div className="section-icon chat-icon"><MessageCircle size={19} /></div>
              <div>
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

            {analysis && (
              <div className="suggested-questions" aria-label="Suggested questions">
                <p className="quick-prompt-label">Try asking</p>
                {SUGGESTED_QUESTIONS.map((suggestedQuestion) => (
                  <button
                    className="question-chip quick-prompt-chip"
                    key={suggestedQuestion}
                    type="button"
                    onClick={() => setQuestion(suggestedQuestion)}
                    disabled={!documentContext || sending}
                  >
                    {suggestedQuestion}
                  </button>
                ))}
              </div>
            )}

            <form className="chat-form" onSubmit={handleQuestionSubmit}>
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
                    updatePaperHistory((currentPapers) => currentPapers.map((paper) => (
                      paper.id === activePaperId ? { ...paper, messages: [] } : paper
                    )));
                    setChatError('');
                  }}
                  disabled={sending}
                >
                  <RotateCcw size={14} /> Clear chat
                </button>
              )}
            </div>
          </m.section>
          </m.div>
        </m.div>

        <m.section
          className="feature-overview"
          aria-labelledby="features-title"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <h2 id="features-title">
            <span className="feature-script feature-script-muted">Explore Our</span>{' '}
            <span className="feature-script">Features</span>
          </h2>
          <section className="feature-group" aria-labelledby="core-features-title">
            <div className="feature-group-heading">
              <h3 id="core-features-title">Core Features</h3>
              <p>The main tools for understanding a research paper.</p>
            </div>
            <div className="feature-grid core-feature-grid">
              <m.article className="feature-card" {...featureCardMotionProps}>
                <span className="feature-icon" aria-hidden="true">⚡</span>
                <h4>PDF Analysis</h4>
                <p>Upload one academic PDF and extract its research content for analysis.</p>
              </m.article>
              <m.article className="feature-card" {...featureCardMotionProps}>
                <span className="feature-icon" aria-hidden="true">📊</span>
                <h4>Structured Summary</h4>
                <p>Get a readable five-part summary: title and authors, problem, methodology, results, and conclusion.</p>
              </m.article>
              <m.article className="feature-card" {...featureCardMotionProps}>
                <span className="feature-icon" aria-hidden="true">💬</span>
                <h4>Paper-Grounded Chat</h4>
                <p>Ask natural-language questions and get answers grounded in the uploaded paper.</p>
              </m.article>
            </div>
          </section>

          <section className="feature-group extra-feature-group" aria-labelledby="extra-features-title">
            <div className="feature-group-heading">
              <h3 id="extra-features-title">Extra Features</h3>
              <p>Helpful tools for revisiting, sharing, and using your results.</p>
            </div>
            <div className="feature-grid extra-feature-grid">
              <m.article className="feature-card" {...featureCardMotionProps}>
                <span className="feature-icon" aria-hidden="true">🕘</span>
                <h4>Paper History</h4>
                <p>Keep up to five recent summaries on this browser and switch back to them later.</p>
              </m.article>
              <m.article className="feature-card" {...featureCardMotionProps}>
                <span className="feature-icon" aria-hidden="true">📑</span>
                <h4>Citations &amp; Export</h4>
                <p>Copy APA/IEEE citations or export summaries as Markdown, HTML, or print-ready PDF.</p>
              </m.article>
              <m.article className="feature-card" {...featureCardMotionProps}>
                <span className="feature-icon" aria-hidden="true">✨</span>
                <h4>Chat Shortcuts</h4>
                <p>Start with suggested questions or clear the conversation when you want a fresh start.</p>
              </m.article>
              <m.article className="feature-card" {...featureCardMotionProps}>
                <span className="feature-icon" aria-hidden="true">🔎</span>
                <h4>Research Gaps &amp; Claims</h4>
                <p>See tentative claims and open research questions identified in the paper.</p>
              </m.article>
            </div>
          </section>
        </m.section>

        <footer className="page-footer">
          <span>කොළකෑලි AI</span>
          <span aria-hidden="true">•</span>
          <span>Built with FastAPI, React &amp; Gemini API</span>
        </footer>
      </main>
    </div>
    </LazyMotion>
  );
}

export default App;
