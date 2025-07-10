import { readFile } from 'fs/promises';
import path from 'path';

const API_BASE = process.env.NODE_ENV === 'test' 
  ? 'http://localhost:3000' 
  : 'http://localhost:3000';

describe('ShowScribe API', () => {
  let sampleTranscript: string;

  beforeAll(async () => {
    const transcriptPath = path.join(process.cwd(), 'samples', 'sample_transcript.txt');
    sampleTranscript = await readFile(transcriptPath, 'utf-8');
  });

  describe('/api/generate', () => {
    it('should generate show notes from transcript', async () => {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: sampleTranscript }),
      });

      expect(response.ok).toBe(true);
      
      const result = await response.json();

      // Check that all required fields are present and non-empty
      expect(result.title).toBeTruthy();
      expect(typeof result.title).toBe('string');
      expect(result.title.length).toBeGreaterThan(0);

      expect(result.summary).toBeTruthy();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);

      expect(result.highlights).toBeTruthy();
      expect(Array.isArray(result.highlights)).toBe(true);
      expect(result.highlights.length).toBeGreaterThan(0);

      expect(result.guestBio).toBeTruthy();
      expect(typeof result.guestBio).toBe('string');

      expect(result.socialCaptions).toBeTruthy();
      expect(result.socialCaptions.twitter).toBeTruthy();
      expect(result.socialCaptions.linkedin).toBeTruthy();
      expect(result.socialCaptions.instagram).toBeTruthy();

      expect(result.metadata).toBeTruthy();
      expect(typeof result.metadata.totalLatency).toBe('number');
      expect(typeof result.metadata.totalTokens).toBe('number');
      expect(typeof result.metadata.cost).toBe('number');
    }, 60000); // 60 second timeout for API calls

    it('should return error for empty transcript', async () => {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: '' }),
      });

      expect(response.status).toBe(400);
      
      const result = await response.json();
      expect(result.error).toBeTruthy();
    });

    it('should return error for missing transcript', async () => {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      
      const result = await response.json();
      expect(result.error).toBeTruthy();
    });
  });
});