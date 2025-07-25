import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { openaiClient, CostExceededError } from '@/lib/openai';
import * as Sentry from '@sentry/nextjs';
import { del } from '@vercel/blob';

export async function POST(request: NextRequest) {
  console.log('=== BLOB UPLOAD API START ===');
  let blobUrl: string | null = null;
  let filepath: string | null = null;

  try {
    console.log('1. Starting blob processing');
    const startTime = Date.now();

    // Parse JSON body to get blob URL
    console.log('2. Parsing JSON body');
    const { blobUrl: receivedBlobUrl } = await request.json();
    blobUrl = receivedBlobUrl;

    if (!blobUrl) {
      return NextResponse.json({ error: 'No blob URL provided' }, { status: 400 });
    }

    console.log('3. Got blob URL:', blobUrl);

    // Download file from blob URL
    console.log('4. Downloading file from blob');
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      throw new Error(`Failed to download blob: ${blobResponse.status}`);
    }

    const blobBuffer = await blobResponse.arrayBuffer();
    const fileSize = blobBuffer.byteLength;
    console.log('5. Downloaded file, size:', fileSize);

    // Get filename from URL or generate one
    const urlParts = blobUrl.split('/');
    const originalFilename = urlParts[urlParts.length - 1] || 'audio-file';
    const filename = `${Date.now()}-${originalFilename}`;
    filepath = path.join('/tmp', filename);
    console.log('6. File path:', filepath);

    // Write to temporary file
    console.log('7. Writing file to disk');
    await writeFile(filepath, Buffer.from(blobBuffer));
    console.log('8. File written successfully');

    // Validate file size (25MB limit - OpenAI Whisper constraint)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (fileSize > maxSize) {
      // TODO: Add server-side compression here
      return NextResponse.json({ error: 'File too large. Maximum size is 25MB' }, { status: 400 });
    }

    console.log('9. Starting OpenAI transcription');
    // Import fs module for createReadStream
    const fs = await import('fs');

    // Transcribe with enhanced OpenAI client
    const { response: transcription, metrics } = await openaiClient.transcription({
      file: fs.createReadStream(filepath),
      model: 'whisper-1',
      response_format: 'json',
    });
    console.log('10. Transcription completed, length:', transcription.text.length);

    const transcriptionLatency = metrics.latencyMs;

    // Clean up temporary file
    fs.unlinkSync(filepath);
    filepath = null;

    // Clean up blob
    console.log('11. Cleaning up blob');
    try {
      await del(blobUrl);
      console.log('12. Blob cleaned up successfully');
    } catch (blobError) {
      console.warn('Failed to clean up blob:', blobError);
    }

    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    // Log metrics
    console.log(`Transcription completed:`, {
      fileSize,
      transcriptionLatency,
      totalLatency,
      transcriptionLength: transcription.text.length,
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
    console.error('=== BLOB UPLOAD ERROR ===');
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
      tags: { service: 'blob-upload', blobUrl },
    });

    return NextResponse.json({ error: 'Failed to process audio file' }, { status: 500 });
  }
}
