import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 100MB' }, { status: 400 });
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
    const fs = require('fs');
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    await writeFile(filepath, buffer);

    // Transcribe with OpenAI Whisper
    const transcriptionStartTime = Date.now();
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filepath),
      model: 'whisper-1',
      response_format: 'json',
    });

    const transcriptionEndTime = Date.now();
    const transcriptionLatency = transcriptionEndTime - transcriptionStartTime;

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
      },
    });

  } catch (error) {
    console.error('Upload/transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio file' },
      { status: 500 }
    );
  }
}