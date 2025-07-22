import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { openaiClient, CostExceededError } from '@/lib/openai';
import { createJob } from '@/lib/queue';
import * as Sentry from '@sentry/nextjs';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  let file: File | null = null;
  
  try {
    const startTime = Date.now();
    
    const data = await request.formData();
    file = data.get('file') as unknown as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 100MB' }, { status: 400 });
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
            tokenPrefix: process.env.UPSTASH_QSTASH_TOKEN?.substring(0, 10) + '...'
          });

          const response = await fetch(qstashUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.UPSTASH_QSTASH_TOKEN}`,
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
              body: errorText
            });
            throw new Error(`QStash failed: ${response.status} ${errorText}`);
          }

          return NextResponse.json({ 
            queueId,
            message: 'File queued for processing. Use /api/queue-status?id=' + queueId + ' to check status.'
          }, { status: 202 });

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
      return NextResponse.json({ error: 'Invalid file type. Only MP3 and WAV files are allowed' }, { status: 400 });
    }

    // Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(process.cwd(), 'tmp', filename);
    
    // Ensure tmp directory exists
    const fs = await import('fs');
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    await writeFile(filepath, buffer);

    // Transcribe with enhanced OpenAI client
    const { response: transcription, metrics } = await openaiClient.transcription({
      file: fs.createReadStream(filepath),
      model: 'whisper-1',
      response_format: 'json',
    });

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
    console.error('Upload/transcription error:', error);
    
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

    return NextResponse.json(
      { error: 'Failed to process audio file' },
      { status: 500 }
    );
  }
}