'use client';

import { useState } from 'react';
import Image from 'next/image';
import Uploader from '@/components/Uploader';
import Spinner from '@/components/Spinner';
import OutputCard from '@/components/OutputCard';
import DownloadButton from '@/components/DownloadButton';
import ThemeToggle from '@/components/ThemeToggle';

interface FileInfo {
  size: number;
  format: string;
  estimatedDurationMinutes: number;
  estimatedTranscriptionTimeSeconds: number;
}

interface UploadResult {
  blobUrl: string;
  fileInfo: FileInfo;
  metadata: {
    uploadLatency: number;
    ready: boolean;
  };
}

interface ShowNotesResult {
  title: string;
  summary: string;
  highlights: string[];
  guestBio: string;
  socialCaptions: {
    twitter: string;
    linkedin: string;
    instagram: string;
  };
  metadata: {
    totalLatency: number;
    totalTokens: number;
    cost: number;
  };
}

export default function Home() {
  const [step, setStep] = useState<'upload' | 'transcribe' | 'generate' | 'complete'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [result, setResult] = useState<ShowNotesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (blobUrl: string) => {
    setIsProcessing(true);
    setError(null);
    setStep('upload');

    try {
      // Step 1: Upload and analyze file
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blobUrl }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const uploadResult: UploadResult = await uploadResponse.json();
      setUploadResult(uploadResult);
      setStep('transcribe');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranscriptSubmit = async (transcript: string) => {
    setIsProcessing(true);
    setError(null);
    setStep('generate');

    try {
      await generateShowNotes(transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTranscription = async () => {
    if (!uploadResult) return;

    setIsProcessing(true);
    setError(null);
    setStep('transcribe');

    try {
      // Step 2: Transcribe the uploaded file
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blobUrl: uploadResult.blobUrl }),
      });

      if (!transcribeResponse.ok) {
        // Handle timeout errors (504) and other non-JSON responses
        if (transcribeResponse.status === 504) {
          throw new Error(
            'Transcription timed out. Large files may take longer to process. Please try again or use a smaller file.'
          );
        }

        try {
          const errorData = await transcribeResponse.json();
          throw new Error(errorData.error || 'Transcription failed');
        } catch {
          // If we can't parse the error response, show a generic message
          throw new Error(`Transcription failed (${transcribeResponse.status}). Please try again.`);
        }
      }

      const { transcript } = await transcribeResponse.json();
      setStep('generate');

      // Step 3: Generate show notes
      await generateShowNotes(transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateShowNotes = async (transcript: string) => {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      // Handle timeout errors and other non-JSON responses
      if (response.status === 504) {
        throw new Error('Show notes generation timed out. Please try again.');
      }

      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      } catch {
        // If we can't parse the error response, show a generic message
        throw new Error(`Generation failed (${response.status}). Please try again.`);
      }
    }

    const showNotes = await response.json();
    setResult(showNotes);
    setStep('complete');
  };

  const resetToStart = () => {
    setStep('upload');
    setIsProcessing(false);
    setUploadResult(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <Image
              src="/logos/icononly_transparent_nobuffer.png"
              alt="ShowScribe Icon"
              width={64}
              height={64}
              className="h-16 w-auto"
            />
            <Image
              src="/logos/textonly_nobuffer.png"
              alt="ShowScribe"
              width={300}
              height={48}
              className="h-8 w-auto"
            />
          </div>
          <ThemeToggle />
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="text-center mb-8">
              <Uploader
                onUpload={handleFileUpload}
                onTranscriptSubmit={handleTranscriptSubmit}
                isProcessing={isProcessing}
              />
            </div>
          )}

          {/* Step 2: File Analysis & Transcription */}
          {step === 'transcribe' && uploadResult && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  File Ready for Transcription
                </h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">File Size:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {(uploadResult.fileInfo.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Format:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {uploadResult.fileInfo.format.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      Ready for transcription
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleStartTranscription}
                  disabled={isProcessing}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Transcribing...' : 'Start Transcription'}
                </button>
              </div>
            </div>
          )}

          {/* Processing Spinner */}
          {isProcessing && <Spinner />}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
              <p className="text-red-700 dark:text-red-400">{error}</p>
              <div className="mt-3 flex gap-4">
                {uploadResult && (
                  <button
                    onClick={handleStartTranscription}
                    disabled={isProcessing}
                    className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Retrying...' : 'Retry Transcription'}
                  </button>
                )}
                <button
                  onClick={resetToStart}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Full-width Episode Title Header */}
              <OutputCard title="Episode Title" content={result.title} />

              {/* Two-column layout for remaining content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <OutputCard title="Summary" content={result.summary} />
                <OutputCard title="Key Highlights" content={result.highlights} type="list" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <OutputCard title="Guest Bio" content={result.guestBio} />
                <OutputCard
                  title="Social Media Captions"
                  content={result.socialCaptions}
                  type="social"
                />
              </div>

              <DownloadButton
                title={result.title}
                summary={result.summary}
                highlights={result.highlights}
                guestBio={result.guestBio}
                socialCaptions={result.socialCaptions}
              />

              <div className="text-center mt-8">
                <button
                  onClick={resetToStart}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Generate New Show Notes
                </button>
              </div>

              {/* Metadata */}
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                Generated in {(result.metadata.totalLatency / 1000).toFixed(1)}s •
                {result.metadata.totalTokens} tokens • ~${result.metadata.cost.toFixed(4)}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-16 py-8 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              How was your experience with ShowScribe?
            </p>
            <a
              href="https://forms.gle/akuLqADKgLxYhJmU7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Share Feedback</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
