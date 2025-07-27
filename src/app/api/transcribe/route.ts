import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { openaiClient, CostExceededError } from '@/lib/openai';
import * as Sentry from '@sentry/nextjs';
import { del } from '@vercel/blob';

interface TranscribeRequest {
  blobUrl: string;
}

export async function POST(request: NextRequest) {
  console.log('=== TRANSCRIPTION API START ===');
  let blobUrl: string | null = null;
  let filepath: string | null = null;

  try {
    const startTime = Date.now();

    // Parse JSON body to get blob URL
    console.log('1. Parsing transcription request');
    const { blobUrl: receivedBlobUrl }: TranscribeRequest = await request.json();
    blobUrl = receivedBlobUrl;

    if (!blobUrl) {
      return NextResponse.json({ error: 'No blob URL provided' }, { status: 400 });
    }

    console.log('2. Starting transcription for blob:', blobUrl);

    // Download file from blob URL
    console.log('3. Downloading file from blob storage');
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      throw new Error(`Failed to download blob: ${blobResponse.status}`);
    }

    const blobBuffer = await blobResponse.arrayBuffer();
    const fileSize = blobBuffer.byteLength;
    console.log('4. Downloaded file, size:', fileSize);

    // Get filename from URL or generate one
    const urlParts = blobUrl.split('/');
    const originalFilename = urlParts[urlParts.length - 1] || 'audio-file';
    const filename = `transcribe-${Date.now()}-${originalFilename}`;
    filepath = path.join('/tmp', filename);
    console.log('5. Temp file path:', filepath);

    // Write to temporary file
    console.log('6. Writing file to disk for transcription');
    await writeFile(filepath, Buffer.from(blobBuffer));
    console.log('7. File ready for transcription');

    // Start transcription (fresh timer starts here)
    console.log('8. Starting OpenAI Whisper transcription');
    const transcriptionStartTime = Date.now();

    const fs = await import('fs');
    const { response: transcription, metrics } = await openaiClient.transcription({
      file: fs.createReadStream(filepath),
      model: 'whisper-1',
      response_format: 'json',
    });

    const transcriptionEndTime = Date.now();
    const transcriptionLatency = transcriptionEndTime - transcriptionStartTime;

    console.log('9. Transcription completed, length:', transcription.text.length);

    // Clean up temporary file
    fs.unlinkSync(filepath);
    filepath = null;

    // Clean up blob storage
    console.log('10. Cleaning up blob storage');
    try {
      await del(blobUrl);
      console.log('11. Blob cleaned up successfully');
    } catch (blobError) {
      console.warn('Failed to clean up blob:', blobError);
    }

    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    // Log comprehensive metrics
    console.log('Transcription completed:', {
      fileSize,
      transcriptionLatency,
      totalLatency,
      transcriptionLength: transcription.text.length,
      cost: metrics.costUSD,
    });

    return NextResponse.json({
      transcript: transcription.text,
      metadata: {
        fileSize,
        transcriptionLatency,
        totalLatency,
        transcriptionLength: transcription.text.length,
        cost: metrics.costUSD,
      },
    });
  } catch (error) {
    console.error('=== TRANSCRIPTION ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', (error as Error)?.message);
    console.error('Error stack:', (error as Error)?.stack);

    // Clean up temporary files on error
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

    // Clean up blob on error
    if (blobUrl) {
      try {
        console.log('Cleaning up blob on error:', blobUrl);
        await del(blobUrl);
        console.log('Blob cleaned up successfully');
      } catch (blobError) {
        console.warn('Failed to clean up blob:', blobError);
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
      tags: { service: 'transcription', blobUrl },
    });

    return NextResponse.json({ error: 'Failed to transcribe audio file' }, { status: 500 });
  }
}
