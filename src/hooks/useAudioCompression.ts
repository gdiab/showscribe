'use client';

import { useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

interface CompressionProgress {
  phase: 'loading' | 'processing' | 'complete';
  progress: number;
  message: string;
}

export function useAudioCompression() {
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState<CompressionProgress | null>(null);
  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null);

  const loadFFmpeg = useCallback(async () => {
    const ffmpegInstance = new FFmpeg();

    ffmpegInstance.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });

    ffmpegInstance.on('progress', ({ progress: prog }) => {
      setProgress((prev) => (prev ? { ...prev, progress: prog * 100 } : null));
    });

    setProgress({ phase: 'loading', progress: 0, message: 'Loading compression engine...' });

    try {
      // Load FFmpeg core
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setFFmpeg(ffmpegInstance);
      return ffmpegInstance;
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error('Failed to load compression engine. Please try refreshing the page.');
    }
  }, []);

  const compressAudio = useCallback(
    async (file: File): Promise<CompressionResult> => {
      setIsCompressing(true);

      try {
        // Load FFmpeg if not already loaded
        let ffmpegInstance = ffmpeg;
        if (!ffmpegInstance) {
          ffmpegInstance = await loadFFmpeg();
        }

        if (!ffmpegInstance) {
          throw new Error('FFmpeg failed to load');
        }

        const originalSize = file.size;
        const inputName = 'input.' + file.name.split('.').pop();
        const outputName = 'output.mp3';

        setProgress({ phase: 'processing', progress: 0, message: 'Preparing audio file...' });

        // Write input file
        await ffmpegInstance.writeFile(inputName, await fetchFile(file));

        setProgress({ phase: 'processing', progress: 10, message: 'Compressing audio...' });

        // Determine compression settings based on file size
        const sizeInMB = originalSize / (1024 * 1024);
        let bitrate: string;
        let frequency: number;

        if (sizeInMB > 100) {
          // Very large files: ultra aggressive compression
          bitrate = '32k';
          frequency = 16000;
        } else if (sizeInMB > 50) {
          // Large files: aggressive compression
          bitrate = '48k';
          frequency = 22050;
        } else {
          // Normal compression
          bitrate = '64k';
          frequency = 44100;
        }

        console.log(
          `Compressing ${sizeInMB.toFixed(1)}MB file with ${bitrate} bitrate, ${frequency}Hz`
        );

        // Run FFmpeg compression
        await ffmpegInstance.exec([
          '-i',
          inputName,
          '-acodec',
          'mp3',
          '-ab',
          bitrate,
          '-ac',
          '1', // mono
          '-ar',
          frequency.toString(),
          '-f',
          'mp3',
          outputName,
        ]);

        setProgress({ phase: 'processing', progress: 90, message: 'Finalizing...' });

        // Read compressed file
        const compressedData = await ffmpegInstance.readFile(outputName);
        const compressedBlob = new Blob([compressedData], { type: 'audio/mp3' });
        const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.mp3'), {
          type: 'audio/mp3',
        });

        const compressedSize = compressedFile.size;
        const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

        // Clean up
        await ffmpegInstance.deleteFile(inputName);
        await ffmpegInstance.deleteFile(outputName);

        setProgress({ phase: 'complete', progress: 100, message: 'Compression complete!' });

        console.log(
          `Compression successful: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio.toFixed(1)}% reduction)`
        );

        return {
          compressedFile,
          originalSize,
          compressedSize,
          compressionRatio,
        };
      } catch (error) {
        console.error('Compression failed:', error);
        throw new Error(
          'Audio compression failed. Please try a different file or compress manually.'
        );
      } finally {
        setIsCompressing(false);
        setTimeout(() => setProgress(null), 2000);
      }
    },
    [ffmpeg, loadFFmpeg]
  );

  const shouldCompress = useCallback((file: File): boolean => {
    const maxSize = 25 * 1024 * 1024; // 25MB
    return file.size > maxSize;
  }, []);

  return {
    compressAudio,
    shouldCompress,
    isCompressing,
    progress,
  };
}
