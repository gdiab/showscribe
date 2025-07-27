import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { CostExceededError } from '@/lib/openai';
import * as Sentry from '@sentry/nextjs';

// Helper functions for file analysis
function estimateAudioDuration(fileSizeBytes: number, extension: string): number {
  // Rough estimates based on typical bitrates
  const sizeInMB = fileSizeBytes / (1024 * 1024);

  if (extension === '.mp3') {
    // MP3 typically 1MB per minute at standard quality
    return Math.round(sizeInMB);
  } else if (extension === '.wav') {
    // WAV typically 10MB per minute (uncompressed)
    return Math.round(sizeInMB / 10);
  } else {
    // Default estimate for other formats
    return Math.round(sizeInMB * 0.8);
  }
}

function estimateTranscriptionTime(durationMinutes: number): number {
  // Based on observed OpenAI Whisper performance
  // Roughly 2 seconds per minute of audio
  return Math.round(durationMinutes * 2);
}

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
      return NextResponse.json(
        {
          error: `File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB. Maximum: 25MB. Please compress the file before uploading.`,
        },
        { status: 400 }
      );
    }

    console.log('9. Analyzing file for transcription readiness');

    // Get file duration and other metadata
    const fileExtension = path.extname(filepath).toLowerCase();
    const estimatedDurationMinutes = estimateAudioDuration(fileSize, fileExtension);
    const estimatedTranscriptionTime = estimateTranscriptionTime(estimatedDurationMinutes);

    // Clean up temporary file (keep blob for transcription step)
    const fs = await import('fs');
    fs.unlinkSync(filepath);
    filepath = null;

    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    console.log('Upload and analysis completed:', {
      fileSize,
      estimatedDurationMinutes,
      estimatedTranscriptionTime,
      totalLatency,
      blobUrl,
    });

    return NextResponse.json({
      blobUrl: blobUrl,
      fileInfo: {
        size: fileSize,
        format: fileExtension,
        estimatedDurationMinutes,
        estimatedTranscriptionTimeSeconds: estimatedTranscriptionTime,
      },
      metadata: {
        uploadLatency: totalLatency,
        ready: true,
      },
    });
  } catch (error) {
    console.error('=== BLOB UPLOAD ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', (error as Error)?.message);
    console.error('Error stack:', (error as Error)?.stack);
    console.error('Full error object:', error);

    // Clean up temporary files on error
    if (filepath) {
      try {
        console.log('Cleaning up temporary files:', filepath);
        const fs = await import('fs');
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          console.log('Temporary file cleaned up successfully');
        }
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary files:', cleanupError);
      }
    }

    // Note: We don't clean up blob on error anymore since it may be needed for transcription
    // The blob will be cleaned up after successful transcription or can be cleaned up manually

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
