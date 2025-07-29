'use client';

import { useState, useCallback } from 'react';
import { CompressionFactory } from '@/services/compression';
import type {
  CompressionResult,
  CompressionProgress,
  CompressionStrategy,
} from '@/services/compression';

export function useAudioCompression() {
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState<CompressionProgress | null>(null);
  const [strategy, setStrategy] = useState<CompressionStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize compression strategy on first use
  const initializeStrategy = useCallback(async () => {
    if (strategy) return strategy;

    try {
      const factory = CompressionFactory.getInstance();
      const selectedStrategy = await factory.getCompressionStrategy();
      await selectedStrategy.initialize();
      setStrategy(selectedStrategy);
      setError(null);
      return selectedStrategy;
    } catch (err) {
      const errorMessage = 'Failed to initialize compression. Please try refreshing the page.';
      setError(errorMessage);
      console.error('Strategy initialization failed:', err);
      throw new Error(errorMessage);
    }
  }, [strategy]);

  const compressAudio = useCallback(
    async (file: File): Promise<CompressionResult> => {
      setIsCompressing(true);
      setError(null);

      try {
        // Get the compression strategy
        const compressionStrategy = await initializeStrategy();

        // Use the strategy to compress the audio
        const result = await compressionStrategy.compressAudio(file, (progressUpdate) => {
          setProgress(progressUpdate);
        });

        return result;
      } catch (error) {
        console.error('Compression failed:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Audio compression failed. Please try a different file or compress manually.';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsCompressing(false);
        setTimeout(() => setProgress(null), 2000);
      }
    },
    [initializeStrategy]
  );

  const shouldCompress = useCallback((file: File): boolean => {
    const maxSize = 25 * 1024 * 1024; // 25MB
    return file.size > maxSize;
  }, []);

  // Get strategy info for debugging
  const getStrategyInfo = useCallback(() => {
    return {
      strategyName: strategy?.getName() || 'Not initialized',
      isReady: !!strategy,
      environment: CompressionFactory.getEnvironment(),
    };
  }, [strategy]);

  return {
    compressAudio,
    shouldCompress,
    isCompressing,
    progress,
    error,
    getStrategyInfo,
  };
}
