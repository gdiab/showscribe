'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploaderProps {
  onUpload: (file: File) => void;
  onTranscriptSubmit: (transcript: string) => void;
  isProcessing: boolean;
}

export default function Uploader({ onUpload, onTranscriptSubmit, isProcessing }: UploaderProps) {
  const [transcript, setTranscript] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/x-wav': ['.wav'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: false,
    disabled: isProcessing,
  });

  const handleTranscriptSubmit = () => {
    if (transcript.trim()) {
      onTranscriptSubmit(transcript.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Tab Selection */}
      <div className="flex mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            activeTab === 'upload'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Upload Audio
        </button>
        <button
          onClick={() => setActiveTab('paste')}
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            activeTab === 'paste'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Paste Transcript
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center space-y-4">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div>
              <p className="text-xl font-medium text-gray-900 dark:text-white">
                {isDragActive ? 'Drop your audio file here' : 'Drop your audio file here'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                or <span className="text-blue-600 dark:text-blue-400">browse files</span>
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Supports MP3, WAV (max 100MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Paste Tab */}
      {activeTab === 'paste' && (
        <div className="space-y-4">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your podcast transcript here..."
            className="w-full h-48 p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
            disabled={isProcessing}
          />
          <button
            onClick={handleTranscriptSubmit}
            disabled={!transcript.trim() || isProcessing}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Generate Show Notes'}
          </button>
        </div>
      )}
    </div>
  );
}