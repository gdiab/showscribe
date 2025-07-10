'use client';

interface DownloadButtonProps {
  title: string;
  summary: string;
  highlights: string[];
  guestBio: string;
  socialCaptions: {
    twitter: string;
    linkedin: string;
    instagram: string;
  };
}

export default function DownloadButton({ 
  title, 
  summary, 
  highlights, 
  guestBio, 
  socialCaptions 
}: DownloadButtonProps) {
  const generateMarkdown = () => {
    const markdown = `# ${title}

## Summary
${summary}

## Key Highlights
${highlights.map(highlight => `• ${highlight}`).join('\n')}

## Guest Bio
${guestBio}

## Social Media Captions

### Twitter
${socialCaptions.twitter}

### LinkedIn
${socialCaptions.linkedin}

### Instagram
${socialCaptions.instagram}

---
*Generated with ShowScribe*`;

    return markdown;
  };

  const downloadMarkdown = () => {
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-show-notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex justify-center mt-8">
      <button
        onClick={downloadMarkdown}
        className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span>Download .md</span>
      </button>
    </div>
  );
}