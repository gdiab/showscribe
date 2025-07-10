'use client';

import { useState } from 'react';

interface OutputCardProps {
  title: string;
  content: string | string[];
  type?: 'text' | 'list' | 'social';
}

export default function OutputCard({ title, content, type = 'text' }: OutputCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    let textToCopy = '';
    
    if (type === 'list' && Array.isArray(content)) {
      textToCopy = content.map(item => `• ${item}`).join('\n');
    } else if (type === 'social' && typeof content === 'object') {
      const socialContent = content as { twitter: string; linkedin: string; instagram: string };
      textToCopy = `Twitter: ${socialContent.twitter}\n\nLinkedIn: ${socialContent.linkedin}\n\nInstagram: ${socialContent.instagram}`;
    } else {
      textToCopy = Array.isArray(content) ? content.join('\n') : content;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const renderContent = () => {
    if (type === 'list' && Array.isArray(content)) {
      return (
        <ul className="space-y-2">
          {content.map((item, index) => (
            <li key={index} className="flex items-start">
              <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    } else if (type === 'social' && typeof content === 'object') {
      const socialContent = content as { twitter: string; linkedin: string; instagram: string };
      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-1">Twitter</h4>
            <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">{socialContent.twitter}</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-1">LinkedIn</h4>
            <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">{socialContent.linkedin}</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-1">Instagram</h4>
            <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">{socialContent.instagram}</p>
          </div>
        </div>
      );
    } else {
      return <p className="whitespace-pre-wrap">{Array.isArray(content) ? content.join('\n') : content}</p>;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="text-gray-700 dark:text-gray-300">
        {renderContent()}
      </div>
    </div>
  );
}