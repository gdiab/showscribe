'use client';

import { useState } from 'react';
import Uploader from '@/components/Uploader';
import Spinner from '@/components/Spinner';
import OutputCard from '@/components/OutputCard';
import DownloadButton from '@/components/DownloadButton';
import ThemeToggle from '@/components/ThemeToggle';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ShowNotesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Upload and transcribe
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const { transcript } = await uploadResponse.json();

      // Generate show notes
      await generateShowNotes(transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranscriptSubmit = async (transcript: string) => {
    setIsProcessing(true);
    setError(null);

    try {
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
      const errorData = await response.json();
      throw new Error(errorData.error || 'Generation failed');
    }

    const showNotes = await response.json();
    setResult(showNotes);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              ShowScribe
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              AI-powered podcast show notes generator
            </p>
          </div>
          <ThemeToggle />
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto">
          {!result && !isProcessing && (
            <div className="text-center mb-8">
              <Uploader
                onUpload={handleFileUpload}
                onTranscriptSubmit={handleTranscriptSubmit}
                isProcessing={isProcessing}
              />
            </div>
          )}

          {isProcessing && <Spinner />}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
              <p className="text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setResult(null);
                }}
                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <OutputCard title="Episode Title" content={result.title} />
                <OutputCard title="Summary" content={result.summary} />
                <OutputCard title="Key Highlights" content={result.highlights} type="list" />
                <OutputCard title="Guest Bio" content={result.guestBio} />
              </div>
              
              <OutputCard 
                title="Social Media Captions" 
                content={result.socialCaptions} 
                type="social" 
              />

              <DownloadButton
                title={result.title}
                summary={result.summary}
                highlights={result.highlights}
                guestBio={result.guestBio}
                socialCaptions={result.socialCaptions}
              />

              <div className="text-center mt-8">
                <button
                  onClick={() => setResult(null)}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Generate New Show Notes
                </button>
              </div>

              {/* Metadata */}
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                Generated in {(result.metadata.totalLatency / 1000).toFixed(1)}s • 
                {result.metadata.totalTokens} tokens • 
                ~${result.metadata.cost.toFixed(4)}
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
              href="https://forms.google.com/create"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Share Feedback</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
