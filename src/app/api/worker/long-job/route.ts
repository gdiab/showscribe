import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/queue';
import { openaiClient } from '@/lib/openai';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import * as Sentry from '@sentry/nextjs';

export async function POST(request: NextRequest) {
  let queueId: string | undefined;
  let filepath: string | undefined;

  try {
    const body = await request.json();
    queueId = body.queueId;
    const fileBuffer = Buffer.from(body.fileData, 'base64');
    const filename = body.filename;

    if (!queueId) {
      return NextResponse.json({ error: 'Queue ID required' }, { status: 400 });
    }

    updateJobStatus(queueId, 'processing');

    // Save file temporarily
    filepath = path.join(process.cwd(), 'tmp', `${queueId}-${filename}`);
    await writeFile(filepath, fileBuffer);

    // Create file stream for OpenAI
    const fs = await import('fs');
    const fileStream = fs.createReadStream(filepath);

    // Transcribe with enhanced OpenAI client
    const { response: transcription, metrics } = await openaiClient.transcription({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'json',
    });

    // Clean up file
    await unlink(filepath);
    filepath = undefined;

    // Update job with result
    updateJobStatus(queueId, 'completed', {
      transcript: transcription.text,
      metadata: {
        transcriptionLatency: metrics.latencyMs,
        transcriptionLength: transcription.text.length,
        cost: metrics.costUSD,
      },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Worker error:', error);
    
    // Clean up file if it exists
    if (filepath) {
      try {
        await unlink(filepath);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    if (queueId) {
      updateJobStatus(queueId, 'failed', undefined, error instanceof Error ? error.message : 'Unknown error');
    }

    Sentry.captureException(error, {
      tags: { service: 'worker', job: 'long-job' },
      extra: { queueId },
    });

    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}