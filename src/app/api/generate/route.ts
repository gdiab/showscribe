import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { openaiClient, CostExceededError } from '@/lib/openai';
import * as Sentry from '@sentry/nextjs';

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

async function generateWithPrompt(prompt: string, transcript: string): Promise<{ content: string; metrics: any }> {
  const fullPrompt = `${prompt}\n\nTranscript:\n${transcript}`;
  
  const { response, metrics } = await openaiClient.chatCompletion({
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
    metrics,
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

    // Generate all sections with enhanced monitoring
    const [titleResult, summaryResult, highlightsResult, guestBioResult, socialCaptionsResult] = await Promise.all([
      generateWithPrompt(titlePrompt, transcript),
      generateWithPrompt(summaryPrompt, transcript),
      generateWithPrompt(highlightsPrompt, transcript),
      generateWithPrompt(guestBioPrompt, transcript),
      generateWithPrompt(socialCaptionsPrompt, transcript),
    ]);

    // Calculate total metrics
    const allMetrics = [titleResult.metrics, summaryResult.metrics, highlightsResult.metrics, 
                       guestBioResult.metrics, socialCaptionsResult.metrics];
    
    totalTokens = allMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCost = allMetrics.reduce((sum, m) => sum + m.costUSD, 0);
    const maxLatency = Math.max(...allMetrics.map(m => m.latencyMs));

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

    // SLA monitoring - warn if exceeds 120 seconds
    const SLA_THRESHOLD_MS = 120000; // 120 seconds
    if (totalLatency > SLA_THRESHOLD_MS) {
      Sentry.captureMessage(
        `Generate API SLA exceeded: ${totalLatency}ms > ${SLA_THRESHOLD_MS}ms`,
        'warning',
        {
          tags: { service: 'generate', sla: 'exceeded' },
          extra: {
            totalLatency,
            totalTokens,
            transcriptLength: transcript.length,
          },
        }
      );
    }

    // Enhanced logging with all metrics
    console.log(`Show notes generation completed:`, {
      totalLatency,
      totalTokens,
      totalCost,
      maxLatency,
      transcriptLength: transcript.length,
      slaExceeded: totalLatency > SLA_THRESHOLD_MS,
    });

    // Log to Sentry as breadcrumb
    Sentry.addBreadcrumb({
      category: 'generate',
      message: 'Show notes generation completed',
      level: 'info',
      data: {
        totalLatency,
        totalTokens,
        totalCost,
        transcriptLength: transcript.length,
        slaExceeded: totalLatency > SLA_THRESHOLD_MS,
      },
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
        cost: totalCost,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Generation error:', error);
    
    if (error instanceof CostExceededError) {
      Sentry.captureMessage(error.message, 'warning');
      return NextResponse.json(
        { error: 'Daily cost limit exceeded. Please try again tomorrow.' },
        { status: 429 }
      );
    }

    Sentry.captureException(error, {
      tags: { service: 'generate' },
      extra: { transcriptLength: transcript?.length },
    });

    return NextResponse.json(
      { error: 'Failed to generate show notes' },
      { status: 500 }
    );
  }
}