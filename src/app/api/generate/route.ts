import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateRequest {
  transcript: string;
}

interface ShowNotesResponse {
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

async function loadPrompt(filename: string): Promise<string> {
  const promptPath = path.join(process.cwd(), 'prompts', filename);
  return await readFile(promptPath, 'utf-8');
}

async function generateWithPrompt(prompt: string, transcript: string): Promise<{ content: string; tokens: number }> {
  const fullPrompt = `${prompt}\n\nTranscript:\n${transcript}`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { 
        role: 'system', 
        content: 'You are an expert at creating engaging podcast show notes and social media content. When asked to return JSON, return only valid JSON without markdown formatting or code blocks.' 
      },
      { role: 'user', content: fullPrompt }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return {
    content: response.choices[0].message.content || '',
    tokens: response.usage?.total_tokens || 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    let totalTokens = 0;
    
    const body: GenerateRequest = await request.json();
    const { transcript } = body;
    
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    // Load prompt templates
    const [titlePrompt, summaryPrompt, highlightsPrompt, guestBioPrompt, socialCaptionsPrompt] = await Promise.all([
      loadPrompt('title.md'),
      loadPrompt('summary.md'),
      loadPrompt('highlights.md'),
      loadPrompt('guest-bio.md'),
      loadPrompt('social-captions.md'),
    ]);

    // Generate all sections
    const [titleResult, summaryResult, highlightsResult, guestBioResult, socialCaptionsResult] = await Promise.all([
      generateWithPrompt(titlePrompt, transcript),
      generateWithPrompt(summaryPrompt, transcript),
      generateWithPrompt(highlightsPrompt, transcript),
      generateWithPrompt(guestBioPrompt, transcript),
      generateWithPrompt(socialCaptionsPrompt, transcript),
    ]);

    totalTokens = titleResult.tokens + summaryResult.tokens + highlightsResult.tokens + 
                  guestBioResult.tokens + socialCaptionsResult.tokens;

    // Parse highlights (expecting JSON array)
    let highlights: string[] = [];
    try {
      highlights = JSON.parse(highlightsResult.content);
    } catch {
      // Fallback: split by bullet points or newlines
      highlights = highlightsResult.content.split('\n')
        .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map((line: string) => line.trim().replace(/^[-•]\s*/, ''));
    }

    // Parse social captions (expecting JSON object)
    let socialCaptions = {
      twitter: '',
      linkedin: '',
      instagram: '',
    };

    try {
      // Clean up the content by removing markdown code blocks
      const cleanContent = socialCaptionsResult.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      socialCaptions = JSON.parse(cleanContent);
    } catch (error) {
      console.error('Failed to parse social captions:', error);
      console.log('Raw content:', socialCaptionsResult.content);
      
      // Fallback: use the raw content for all platforms
      socialCaptions = {
        twitter: socialCaptionsResult.content,
        linkedin: socialCaptionsResult.content,
        instagram: socialCaptionsResult.content,
      };
    }

    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    // Estimate cost (approximate rates for GPT-4o)
    const inputTokenRate = 0.0025 / 1000; // $0.0025 per 1K input tokens
    const outputTokenRate = 0.01 / 1000; // $0.01 per 1K output tokens
    const estimatedCost = (totalTokens * inputTokenRate) + (totalTokens * 0.2 * outputTokenRate);

    // Log metrics
    console.log(`Show notes generation completed:`, {
      totalLatency,
      totalTokens,
      estimatedCost,
      transcriptLength: transcript.length,
    });

    const response: ShowNotesResponse = {
      title: titleResult.content.trim(),
      summary: summaryResult.content.trim(),
      highlights,
      guestBio: guestBioResult.content.trim(),
      socialCaptions,
      metadata: {
        totalLatency,
        totalTokens,
        cost: estimatedCost,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate show notes' },
      { status: 500 }
    );
  }
}