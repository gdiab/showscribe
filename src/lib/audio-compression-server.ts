import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';

// Try to find FFmpeg in common system locations
function findFFmpegPath(): string | null {
  const possiblePaths = [
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
    'ffmpeg', // rely on PATH
  ];

  for (const ffmpegPath of possiblePaths) {
    try {
      if (ffmpegPath === 'ffmpeg') {
        // Check if ffmpeg is in PATH
        execSync('which ffmpeg', { stdio: 'ignore' });
        console.log('Found FFmpeg in system PATH');
        return ffmpegPath;
      } else {
        // Check if specific path exists
        const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-require-imports
        if (fs.existsSync(ffmpegPath)) {
          console.log('Found FFmpeg at:', ffmpegPath);
          return ffmpegPath;
        }
      }
    } catch {
      // Continue trying other paths
    }
  }

  console.warn('FFmpeg not found in any common locations');
  return null;
}

// Set FFmpeg path
const ffmpegPath = findFFmpegPath();
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.warn('FFmpeg not available - compression will be skipped');
}

interface CompressionResult {
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compresses audio files using FFmpeg to reduce file size for OpenAI Whisper processing
 * Uses different compression strategies based on input format
 */
export async function compressAudio(inputPath: string): Promise<CompressionResult> {
  const originalStats = await fs.stat(inputPath);
  const originalSize = originalStats.size;
  const inputExtension = path.extname(inputPath).toLowerCase();

  // Check if FFmpeg is available
  if (!ffmpegPath) {
    console.error('FFmpeg not available - cannot compress audio');
    throw new Error('Audio compression not available in this environment. FFmpeg is required.');
  }

  // Generate output path with .mp3 extension
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(path.dirname(inputPath), `${baseName}-compressed.mp3`);

  console.log(`Compressing audio: ${inputPath} -> ${outputPath}`);
  console.log(
    `Original size: ${(originalSize / 1024 / 1024).toFixed(2)}MB, format: ${inputExtension}`
  );

  // Different compression settings based on input format and size
  const isWav = inputExtension === '.wav';
  const sizeInMB = originalSize / (1024 * 1024);

  // More aggressive compression for very large files
  let bitrate: string;
  let frequency: number;

  if (sizeInMB > 100) {
    // Very large files: ultra aggressive compression
    bitrate = isWav ? '32k' : '64k';
    frequency = 16000; // Very low sample rate but still good for speech
  } else if (sizeInMB > 50) {
    // Large files: more aggressive compression
    bitrate = isWav ? '48k' : '80k';
    frequency = isWav ? 16000 : 22050;
  } else {
    // Normal compression
    bitrate = isWav ? '64k' : '96k';
    frequency = isWav ? 22050 : 44100;
  }

  console.log(
    `Compression settings: ${bitrate} bitrate, ${frequency}Hz frequency for ${sizeInMB.toFixed(1)}MB ${inputExtension} file`
  );

  return new Promise((resolve, reject) => {
    const ffmpegCommand = ffmpeg(inputPath)
      .audioCodec('mp3')
      .audioBitrate(bitrate)
      .audioChannels(1) // Mono - sufficient for transcription
      .audioFrequency(frequency)
      .format('mp3')
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('end', async () => {
        try {
          const compressedStats = await fs.stat(outputPath);
          const compressedSize = compressedStats.size;
          const compressionRatio = (1 - compressedSize / originalSize) * 100;

          console.log(`Compression complete: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
          console.log(`Compression ratio: ${compressionRatio.toFixed(1)}%`);

          resolve({
            outputPath,
            originalSize,
            compressedSize,
            compressionRatio,
          });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('FFmpeg compression error:', error);
        console.error('FFmpeg binary path was:', ffmpegPath);
        reject(error);
      });

    ffmpegCommand.save(outputPath);
  });
}

/**
 * Check if audio compression is available in this environment
 */
export function isCompressionAvailable(): boolean {
  return ffmpegPath !== null;
}

/**
 * Determines if a file should be compressed based on size and format
 * WAV files >10MB: Always compress (huge size reduction possible)
 * MP3 files >22MB: Light compression (already compressed format)
 */
export function shouldCompressFile(filepath: string, fileSize: number): boolean {
  const extension = path.extname(filepath).toLowerCase();
  const sizeInMB = fileSize / (1024 * 1024);

  // WAV files over 10MB - aggressive compression beneficial
  if (extension === '.wav' && sizeInMB > 10) {
    console.log(`WAV file ${sizeInMB.toFixed(1)}MB > 10MB threshold - will compress`);
    return true;
  }

  // MP3 files over 22MB - gentle compression to stay under limits
  if (extension === '.mp3' && sizeInMB > 22) {
    console.log(`MP3 file ${sizeInMB.toFixed(1)}MB > 22MB threshold - will compress`);
    return true;
  }

  console.log(`File ${sizeInMB.toFixed(1)}MB (${extension}) - no compression needed`);
  return false;
}
