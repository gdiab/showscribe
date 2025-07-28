import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { openaiClient, CostExceededError, CostMetrics } from '@/lib/openai';
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

async function generateWithPrompt(
  prompt: string,
  transcript: string
): Promise<{ content: string; metrics: CostMetrics }> {
  const fullPrompt = `${prompt}\n\nTranscript:\n${transcript}`;

  const { response, metrics } = await openaiClient.chatCompletion({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert at creating engaging podcast show notes and social media content. When asked to return JSON, return only valid JSON without markdown formatting or code blocks.',
      },
      { role: 'user', content: fullPrompt },
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
  let transcript = '';

  try {
    const startTime = Date.now();
    let totalTokens = 0;

    const body: GenerateRequest = await request.json();
    transcript = body.transcript;

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    // Load prompt templates for two-stage generation
    const [condensedSummaryPrompt, lightweightSectionsPrompt, highlightsPrompt] = await Promise.all(
      [
        loadPrompt('condensed-summary.md'),
        loadPrompt('lightweight-sections.md'),
        loadPrompt('highlights.md'),
      ]
    );

    // STAGE 1: Generate condensed summary from full transcript
    console.log('Stage 1: Generating condensed summary...');
    const condensedSummaryResult = await generateWithPrompt(condensedSummaryPrompt, transcript);
    console.log(
      'Condensed summary result:',
      condensedSummaryResult.content.substring(0, 200) + '...'
    );

    // STAGE 2A: Generate lightweight sections from condensed summary
    console.log('Stage 2A: Generating lightweight sections from summary...');
    const lightweightSectionsResult = await generateWithPrompt(
      lightweightSectionsPrompt,
      condensedSummaryResult.content
    );

    // STAGE 2B: Generate highlights from full transcript
    console.log('Stage 2B: Generating highlights from full transcript...');
    const highlightsResult = await generateWithPrompt(highlightsPrompt, transcript);

    // Calculate total metrics from three calls
    const allMetrics = [
      condensedSummaryResult.metrics,
      lightweightSectionsResult.metrics,
      highlightsResult.metrics,
    ];

    totalTokens = allMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCost = allMetrics.reduce((sum, m) => sum + m.costUSD, 0);
    const maxLatency = Math.max(...allMetrics.map((m) => m.latencyMs));

    // Parse lightweight sections (expecting JSON object with title, guestBio, socialCaptions)
    let title = '';
    let guestBio = '';
    let socialCaptions = {
      twitter: '',
      linkedin: '',
      instagram: '',
    };

    try {
      // Clean up the content by removing markdown code blocks
      const cleanContent = lightweightSectionsResult.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsedSections = JSON.parse(cleanContent);
      title = parsedSections.title || '';
      guestBio = parsedSections.guestBio || '';
      socialCaptions = parsedSections.socialCaptions || socialCaptions;
    } catch (error) {
      console.error('Failed to parse lightweight sections:', error);
      console.log('Raw content:', lightweightSectionsResult.content);

      // Fallback: extract what we can from the raw content
      title = 'Generated Show Notes';
      guestBio = lightweightSectionsResult.content.substring(0, 200) + '...';
    }

    // Parse highlights (expecting JSON object with highlights property or JSON array)
    let highlights: string[] = [];
    try {
      // Clean up the highlights content by removing markdown code blocks
      const cleanHighlights = highlightsResult.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      console.log('Raw highlights content:', highlightsResult.content);
      console.log('Cleaned highlights content:', cleanHighlights);

      const parsed = JSON.parse(cleanHighlights);
      // Handle both object with highlights property and direct array
      highlights = parsed.highlights || parsed;
      console.log('Parsed highlights:', highlights);
    } catch (error) {
      console.error('Failed to parse highlights JSON:', error);
      console.log('Falling back to text parsing');

      // Fallback: split by bullet points or newlines
      highlights = highlightsResult.content
        .split('\n')
        .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map((line: string) => line.trim().replace(/^[-•]\s*/, ''));
    }

    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    // SLA monitoring - warn if exceeds 120 seconds
    const SLA_THRESHOLD_MS = 120000; // 120 seconds
    if (totalLatency > SLA_THRESHOLD_MS) {
      Sentry.captureMessage(
        `Generate API SLA exceeded: ${totalLatency}ms > ${SLA_THRESHOLD_MS}ms`,
        {
          level: 'warning',
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
      title: title.trim(),
      summary: condensedSummaryResult.content.trim(),
      highlights,
      guestBio: guestBio.trim(),
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
      Sentry.captureMessage(error.message, { level: 'warning' });
      return NextResponse.json(
        { error: 'Daily cost limit exceeded. Please try again tomorrow.' },
        { status: 429 }
      );
    }

    Sentry.captureException(error, {
      tags: { service: 'generate' },
      extra: { transcriptLength: transcript?.length },
    });

    return NextResponse.json({ error: 'Failed to generate show notes' }, { status: 500 });
  }
}
