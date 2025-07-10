# ShowScribe

ShowScribe is an AI-powered podcast show notes generator that helps podcasters create professional show notes, summaries, and social media content from their episodes.

## Features

- **Audio Upload**: Support for MP3 and WAV files up to 100MB
- **Transcript Input**: Paste existing transcripts directly
- **AI Generation**: Creates comprehensive show notes including:
  - Episode titles
  - SEO-optimized summaries
  - Key highlights
  - Guest bios
  - Social media captions (Twitter, LinkedIn, Instagram)
- **Export Options**: Download all content as a markdown file
- **Rate Limiting**: Built-in protection against abuse
- **Dark Mode**: Responsive design with theme toggle

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: TailwindCSS
- **AI**: OpenAI GPT-4o and Whisper
- **File Handling**: Built-in Next.js API routes
- **Testing**: Jest

## Getting Started

### Prerequisites

- Node.js 18+ 
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd showscribe
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Add your OpenAI API key to `.env.local`:
```
OPENAI_API_KEY=your_openai_api_key_here
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Upload Audio
1. Drag and drop an audio file (MP3/WAV, max 100MB) or click to browse
2. Wait for transcription and generation to complete
3. Review and copy the generated content

### Paste Transcript
1. Switch to the "Paste Transcript" tab
2. Paste your existing transcript
3. Click "Generate Show Notes"

### Export
Click the "Download .md" button to export all content as a markdown file.

## Testing

Run the test suite:
```bash
npm test
```

The tests validate that the API generates all required sections with non-empty content.

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set the `OPENAI_API_KEY` environment variable in Vercel dashboard
3. Deploy

### Other Platforms

Ensure you set the following environment variables:
- `OPENAI_API_KEY`

## API Endpoints

### POST /api/upload
Uploads audio file and returns transcript.

**Request**: FormData with 'file' field
**Response**: 
```json
{
  "transcript": "string",
  "metadata": {
    "fileSize": "number",
    "transcriptionLatency": "number",
    "totalLatency": "number",
    "transcriptionLength": "number"
  }
}
```

### POST /api/generate
Generates show notes from transcript.

**Request**:
```json
{
  "transcript": "string"
}
```

**Response**:
```json
{
  "title": "string",
  "summary": "string", 
  "highlights": ["string"],
  "guestBio": "string",
  "socialCaptions": {
    "twitter": "string",
    "linkedin": "string",
    "instagram": "string"
  },
  "metadata": {
    "totalLatency": "number",
    "totalTokens": "number",
    "cost": "number"
  }
}
```

## Rate Limiting

API endpoints are rate-limited to 3 requests per 10 minutes per IP address.

## Cost Estimation

The app provides cost estimates based on OpenAI's current pricing. Typical costs:
- Transcription: ~$0.006 per minute of audio
- Generation: ~$0.01-0.05 per episode depending on length

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For questions or feedback, please [create an issue](https://github.com/your-repo/showscribe/issues) or use the feedback form in the app.
