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
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`=== TRANSCRIPTION API START [${requestId}] ===`);
  let blobUrl: string | null = null;
  let filepath: string | null = null;

  try {
    const startTime = Date.now();
    console.log(`[${requestId}] Request started at: ${new Date(startTime).toISOString()}`);

    // Parse JSON body to get blob URL
    console.log(`[${requestId}] 1. Parsing transcription request`);
    const parseStartTime = Date.now();
    const { blobUrl: receivedBlobUrl }: TranscribeRequest = await request.json();
    console.log(`[${requestId}] JSON parsing took: ${Date.now() - parseStartTime}ms`);
    blobUrl = receivedBlobUrl;

    if (!blobUrl) {
      return NextResponse.json({ error: 'No blob URL provided' }, { status: 400 });
    }

    console.log(`[${requestId}] 2. Starting transcription for blob:`, blobUrl);

    // Download file from blob URL
    console.log(`[${requestId}] 3. Downloading file from blob storage`);
    const downloadStartTime = Date.now();
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      throw new Error(`Failed to download blob: ${blobResponse.status}`);
    }

    const blobBuffer = await blobResponse.arrayBuffer();
    const fileSize = blobBuffer.byteLength;
    const downloadTime = Date.now() - downloadStartTime;
    console.log(
      `[${requestId}] 4. Downloaded file, size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)}MB) in ${downloadTime}ms`
    );

    // Get filename from URL or generate one
    const urlParts = blobUrl.split('/');
    const originalFilename = urlParts[urlParts.length - 1] || 'audio-file';
    const filename = `transcribe-${Date.now()}-${originalFilename}`;
    filepath = path.join('/tmp', filename);
    console.log(`[${requestId}] 5. Temp file path:`, filepath);

    // Write to temporary file
    console.log(`[${requestId}] 6. Writing file to disk for transcription`);
    const writeStartTime = Date.now();
    await writeFile(filepath, Buffer.from(blobBuffer));
    const writeTime = Date.now() - writeStartTime;
    console.log(
      `[${requestId}] 7. File written to disk in ${writeTime}ms, ready for transcription`
    );

    // Start transcription with retry logic
    console.log(`[${requestId}] 8. Starting OpenAI Whisper transcription`);
    const transcriptionStartTime = Date.now();
    const preTranscriptionElapsed = transcriptionStartTime - startTime;
    console.log(`[${requestId}] Pre-transcription setup completed in ${preTranscriptionElapsed}ms`);

    const fs = await import('fs');
    let transcription, metrics;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      const attemptStartTime = Date.now();
      try {
        console.log(
          `[${requestId}] Transcription attempt ${retryCount + 1}/${maxRetries + 1} starting at ${new Date(attemptStartTime).toISOString()}`
        );

        const result = await openaiClient.transcription({
          file: fs.createReadStream(filepath),
          model: 'whisper-1',
          response_format: 'json',
        });

        const attemptEndTime = Date.now();
        const attemptDuration = attemptEndTime - attemptStartTime;
        console.log(
          `[${requestId}] Transcription attempt ${retryCount + 1} completed in ${attemptDuration}ms`
        );

        transcription = result.response;
        metrics = result.metrics;
        console.log(`[${requestId}] OpenAI API metrics:`, {
          costUSD: metrics.costUSD,
          promptTokens: metrics.promptTokens || 'N/A',
          completionTokens: metrics.completionTokens || 'N/A',
          totalTokens: metrics.totalTokens || 'N/A',
          latencyMs: metrics.latencyMs,
        });
        break;
      } catch (error) {
        retryCount++;
        const attemptEndTime = Date.now();
        const attemptDuration = attemptEndTime - attemptStartTime;
        console.log(
          `[${requestId}] Transcription attempt ${retryCount} failed after ${attemptDuration}ms:`,
          (error as Error).message
        );

        if (retryCount > maxRetries) {
          console.log(`[${requestId}] All retry attempts exhausted, throwing error`);
          throw error;
        }
        console.log(`[${requestId}] Waiting 5 seconds before retry attempt ${retryCount + 1}...`);
        // Wait 5 seconds before retry
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    const transcriptionEndTime = Date.now();
    const transcriptionLatency = transcriptionEndTime - transcriptionStartTime;

    if (!transcription || !metrics) {
      throw new Error('Transcription failed after all retry attempts');
    }

    console.log(`[${requestId}] 9. Transcription completed successfully`);
    console.log(`[${requestId}] Transcript length: ${transcription.text.length} characters`);
    console.log(`[${requestId}] Transcript preview: "${transcription.text.substring(0, 100)}..."`);

    // Clean up temporary file
    const cleanupStartTime = Date.now();
    fs.unlinkSync(filepath);
    filepath = null;
    console.log(`[${requestId}] Temporary file cleaned up`);

    // Clean up blob storage
    console.log(`[${requestId}] 10. Cleaning up blob storage`);
    try {
      await del(blobUrl);
      const cleanupTime = Date.now() - cleanupStartTime;
      console.log(`[${requestId}] 11. Blob cleaned up successfully in ${cleanupTime}ms`);
    } catch (blobError) {
      console.warn(`[${requestId}] Failed to clean up blob:`, blobError);
    }

    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    // Log comprehensive metrics
    console.log(`[${requestId}] === TRANSCRIPTION COMPLETED SUCCESSFULLY ===`);
    console.log(`[${requestId}] Performance metrics:`, {
      fileSize: `${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
      downloadTime: `${downloadTime}ms`,
      writeTime: `${writeTime}ms`,
      preTranscriptionSetup: `${preTranscriptionElapsed}ms`,
      transcriptionLatency: `${transcriptionLatency}ms`,
      totalLatency: `${totalLatency}ms`,
      transcriptionLength: `${transcription.text.length} characters`,
      costUSD: metrics.costUSD,
      efficiency: `${(transcription.text.length / (totalLatency / 1000)).toFixed(0)} chars/sec`,
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
    const errorTime = Date.now();
    console.error(
      `[${requestId}] === TRANSCRIPTION ERROR at ${new Date(errorTime).toISOString()} ===`
    );
    console.error(`[${requestId}] Error type:`, error?.constructor?.name);
    console.error(`[${requestId}] Error message:`, (error as Error)?.message);
    console.error(`[${requestId}] Error stack:`, (error as Error)?.stack);
    console.error(`[${requestId}] Time elapsed before error: ${errorTime - startTime}ms`);

    // Clean up temporary files on error
    if (filepath) {
      try {
        console.log(`[${requestId}] Cleaning up temporary file:`, filepath);
        const fs = await import('fs');
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          console.log(`[${requestId}] Temporary file cleaned up successfully`);
        }
      } catch (cleanupError) {
        console.warn(`[${requestId}] Failed to clean up temporary file:`, cleanupError);
      }
    }

    // Clean up blob on error
    if (blobUrl) {
      try {
        console.log(`[${requestId}] Cleaning up blob on error:`, blobUrl);
        await del(blobUrl);
        console.log(`[${requestId}] Blob cleaned up successfully`);
      } catch (blobError) {
        console.warn(`[${requestId}] Failed to clean up blob:`, blobError);
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
