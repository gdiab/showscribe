'use client';

import {
  CompressionStrategy,
  CompressionResult,
  CompressionProgress,
  CompressionOptions,
} from './types';

export class FFmpegCompressionStrategy implements CompressionStrategy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ffmpeg: any = null;
  private initialized = false;

  getName(): string {
    return 'FFmpeg WASM';
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if we're in a browser environment with necessary APIs
      if (typeof window === 'undefined') return false;
      if (!window.SharedArrayBuffer) return false;

      // Only disable in development, enable in production/Vercel
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        console.log('FFmpeg disabled in development for local debugging');
        return false;
      }

      // Enable FFmpeg in production and Vercel environments
      console.log('FFmpeg enabled for production environment');
      return true;
    } catch (error) {
      console.warn('FFmpeg not available:', error);
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized && this.ffmpeg) return;

    try {
      // Dynamically import FFmpeg modules
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');

      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on('log', ({ message }: { message: string }) => {
        console.log('FFmpeg:', message);
      });

      // Load FFmpeg core from CDN
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize FFmpeg:', error);
      throw new Error('Failed to load FFmpeg compression engine');
    }
  }

  async compressAudio(
    file: File,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    if (!this.ffmpeg || !this.initialized) {
      onProgress?.({ phase: 'loading', progress: 0, message: 'Loading compression engine...' });
      await this.initialize();
    }

    if (!this.ffmpeg) {
      throw new Error('FFmpeg failed to initialize');
    }

    const originalSize = file.size;
    const inputName = 'input.' + file.name.split('.').pop();
    const outputName = 'output.mp3';

    try {
      // Set up progress tracking
      this.ffmpeg.on('progress', ({ progress: prog }: { progress: number }) => {
        onProgress?.({
          phase: 'processing',
          progress: 10 + prog * 80, // Reserve 10% for setup, 10% for finalization
          message: 'Compressing audio...',
        });
      });

      onProgress?.({ phase: 'processing', progress: 0, message: 'Preparing audio file...' });

      // Write input file
      const { fetchFile } = await import('@ffmpeg/util');
      await this.ffmpeg.writeFile(inputName, await fetchFile(file));

      onProgress?.({ phase: 'processing', progress: 10, message: 'Compressing audio...' });

      // Determine compression settings based on file size
      const options = this.getCompressionOptions(originalSize);

      console.log(
        `Compressing ${(originalSize / 1024 / 1024).toFixed(1)}MB file with ${options.bitrate} bitrate, ${options.frequency}Hz`
      );

      // Run FFmpeg compression
      await this.ffmpeg.exec([
        '-i',
        inputName,
        '-acodec',
        'mp3',
        '-ab',
        options.bitrate!,
        '-ac',
        options.mono ? '1' : '2',
        '-ar',
        options.frequency!.toString(),
        '-f',
        'mp3',
        outputName,
      ]);

      onProgress?.({ phase: 'processing', progress: 90, message: 'Finalizing...' });

      // Read compressed file
      const compressedData = await this.ffmpeg.readFile(outputName);
      const compressedBlob = new Blob([compressedData], { type: 'audio/mp3' });
      const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.mp3'), {
        type: 'audio/mp3',
      });

      const compressedSize = compressedFile.size;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

      // Clean up
      await this.ffmpeg.deleteFile(inputName);
      await this.ffmpeg.deleteFile(outputName);

      onProgress?.({ phase: 'complete', progress: 100, message: 'Compression complete!' });

      console.log(
        `FFmpeg compression successful: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio.toFixed(1)}% reduction)`
      );

      return {
        compressedFile,
        originalSize,
        compressedSize,
        compressionRatio,
      };
    } catch (error) {
      console.error('FFmpeg compression failed:', error);
      throw new Error(
        'Audio compression failed. Please try a different file or compress manually.'
      );
    }
  }

  private getCompressionOptions(originalSize: number): Required<CompressionOptions> {
    const sizeInMB = originalSize / (1024 * 1024);

    if (sizeInMB > 100) {
      // Very large files: ultra aggressive compression
      return { bitrate: '32k', frequency: 16000, mono: true };
    } else if (sizeInMB > 50) {
      // Large files: aggressive compression
      return { bitrate: '48k', frequency: 22050, mono: true };
    } else {
      // Normal compression
      return { bitrate: '64k', frequency: 44100, mono: true };
    }
  }
}
