import { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select a valid PDF file.');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://127.0.0.1:8000/analyze-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setAnalysis(response.data.analysis);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred during analysis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <div className="logo-container">
          <Sparkles className="sparkle-icon" />
          <h1>AI Research Assistant</h1>
        </div>
        <p>Upload your research paper and get instant insights using Gemini</p>
      </header>

      <main>
        <div className="upload-section">
          <div className={`drop-zone ${file ? 'has-file' : ''}`}>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange} 
              id="file-input"
            />
            <label htmlFor="file-input">
              {file ? (
                <div className="file-info">
                  <FileText size={48} />
                  <span>{file.name}</span>
                </div>
              ) : (
                <div className="upload-prompt">
                  <Upload size={48} />
                  <span>Click to upload or drag and drop PDF</span>
                </div>
              )}
            </label>
          </div>

          <button 
            onClick={handleUpload} 
            disabled={!file || loading}
            className="analyze-button"
          >
            {loading ? (
              <><Loader2 className="spinner" /> Analyzing...</>
            ) : (
              'Analyze Document'
            )}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {analysis && (
          <div className="results-section">
            <h2>Analysis Result</h2>
            <div className="analysis-content markdown-body">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
