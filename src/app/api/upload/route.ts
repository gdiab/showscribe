import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { openaiClient, CostExceededError } from '@/lib/openai';
import { createJob } from '@/lib/queue';
import * as Sentry from '@sentry/nextjs';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  console.log('=== UPLOAD API START ===');
  let file: File | null = null;
  let filepath: string | null = null;

  try {
    console.log('1. Starting upload processing');
    const startTime = Date.now();

    console.log('2. Parsing form data');
    const data = await request.formData();
    file = data.get('file') as unknown as File;
    console.log(
      '3. Got file:',
      file ? { name: file.name, size: file.size, type: file.type } : 'null'
    );

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file size (25MB limit - OpenAI Whisper constraint)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 25MB' }, { status: 400 });
    }

    // Check for large files (>20MB) - queue them
    const queueThreshold = 20 * 1024 * 1024; // 20MB

    if (file.size > queueThreshold) {
      // Generate queue ID and queue the job
      const queueId = crypto.randomUUID();
      createJob(queueId);

      // Convert file to base64 for queuing
      const bytes = await file.arrayBuffer();
      const fileData = Buffer.from(bytes).toString('base64');

      // Queue job using QStash if available, otherwise process immediately
      if (process.env.UPSTASH_QSTASH_URL && process.env.UPSTASH_QSTASH_TOKEN) {
        try {
          const qstashUrl = `${process.env.UPSTASH_QSTASH_URL}/v2/publish/${encodeURIComponent(process.env.VERCEL_URL || 'http://localhost:3000')}/api/worker/long-job`;

          console.log('QStash request:', {
            url: qstashUrl,
            hasToken: !!process.env.UPSTASH_QSTASH_TOKEN,
            tokenPrefix: process.env.UPSTASH_QSTASH_TOKEN?.substring(0, 10) + '...',
          });

          const response = await fetch(qstashUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.UPSTASH_QSTASH_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              queueId,
              fileData,
              filename: file.name,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('QStash error:', {
              status: response.status,
              statusText: response.statusText,
              body: errorText,
            });
            throw new Error(`QStash failed: ${response.status} ${errorText}`);
          }

          return NextResponse.json(
            {
              queueId,
              message:
                'File queued for processing. Use /api/queue-status?id=' +
                queueId +
                ' to check status.',
            },
            { status: 202 }
          );
        } catch (queueError) {
          console.warn('QStash queuing failed, processing immediately:', queueError);
          // Fall through to immediate processing
        }
      }

      // If queuing fails or isn't configured, process immediately
      console.log('Processing large file immediately (QStash not available)');
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only MP3 and WAV files are allowed' },
        { status: 400 }
      );
    }

    console.log('4. Saving file temporarily');
    // Save file temporarily (use /tmp for Vercel compatibility)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${Date.now()}-${file.name}`;
    filepath = path.join('/tmp', filename);
    console.log('5. File path:', filepath);

    // Import fs module
    const fs = await import('fs');

    console.log('6. Writing file to disk');
    await writeFile(filepath, buffer);
    console.log('7. File written successfully');

    console.log('8. Starting OpenAI transcription');
    // Transcribe with enhanced OpenAI client
    const { response: transcription, metrics } = await openaiClient.transcription({
      file: fs.createReadStream(filepath),
      model: 'whisper-1',
      response_format: 'json',
    });
    console.log('9. Transcription completed, length:', transcription.text.length);

    const transcriptionLatency = metrics.latencyMs;

    // Clean up temporary file
    fs.unlinkSync(filepath);

    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    // Log metrics
    console.log(`Transcription completed:`, {
      fileSize: file.size,
      transcriptionLatency,
      totalLatency,
      transcriptionLength: transcription.text.length,
    });

    return NextResponse.json({
      transcript: transcription.text,
      metadata: {
        fileSize: file.size,
        transcriptionLatency,
        totalLatency,
        transcriptionLength: transcription.text.length,
        cost: metrics.costUSD,
      },
    });
  } catch (error) {
    console.error('=== UPLOAD ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', (error as Error)?.message);
    console.error('Error stack:', (error as Error)?.stack);
    console.error('Full error object:', error);

    // Clean up temporary file on error
    if (filepath) {
      try {
        console.log('Cleaning up temporary file:', filepath);
        const fs = await import('fs');
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          console.log('Temporary file cleaned up successfully');
        }
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary file:', cleanupError);
      }
    }

    if (error instanceof CostExceededError) {
      Sentry.captureMessage(error.message, { level: 'warning' });
      return NextResponse.json(
        { error: 'Daily cost limit exceeded. Please try again tomorrow.' },
        { status: 429 }
      );
    }

    Sentry.captureException(error, {
      tags: { service: 'upload', fileSize: file?.size },
    });

    return NextResponse.json({ error: 'Failed to process audio file' }, { status: 500 });
  }
}
