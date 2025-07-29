/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useAudioCompression } from '@/hooks/useAudioCompression';
import { CompressionFactory } from '@/services/compression/CompressionFactory';

// Mock the compression services
const mockStrategy = {
  getName: jest.fn().mockReturnValue('Mock Strategy'),
  isAvailable: jest.fn().mockResolvedValue(true),
  initialize: jest.fn().mockResolvedValue(undefined),
  compressAudio: jest.fn(),
};

jest.mock('@/services/compression/CompressionFactory', () => ({
  CompressionFactory: {
    getInstance: jest.fn().mockReturnValue({
      getCompressionStrategy: jest.fn().mockResolvedValue(mockStrategy),
    }),
    getEnvironment: jest.fn().mockReturnValue({
      isVercel: false,
      isProduction: false,
      isDevelopment: true,
    }),
  },
}));

describe('useAudioCompression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useAudioCompression());

    expect(result.current.isCompressing).toBe(false);
    expect(result.current.progress).toBe(null);
    expect(result.current.error).toBe(null);
  });

  describe('shouldCompress', () => {
    it('should return false for files smaller than 25MB', () => {
      const { result } = renderHook(() => useAudioCompression());
      const smallFile = new File(['test'], 'small.wav', { type: 'audio/wav' });
      Object.defineProperty(smallFile, 'size', { value: 10 * 1024 * 1024 }); // 10MB

      const shouldCompress = result.current.shouldCompress(smallFile);

      expect(shouldCompress).toBe(false);
    });

    it('should return true for files larger than 25MB', () => {
      const { result } = renderHook(() => useAudioCompression());
      const largeFile = new File(['test'], 'large.wav', { type: 'audio/wav' });
      Object.defineProperty(largeFile, 'size', { value: 30 * 1024 * 1024 }); // 30MB

      const shouldCompress = result.current.shouldCompress(largeFile);

      expect(shouldCompress).toBe(true);
    });
  });

  describe('compressAudio', () => {
    it('should compress audio successfully', async () => {
      mockStrategy.compressAudio.mockImplementation((file, onProgress) => {
        onProgress?.({ phase: 'loading', progress: 0, message: 'Starting...' });
        onProgress?.({ phase: 'processing', progress: 50, message: 'Processing...' });
        onProgress?.({ phase: 'complete', progress: 100, message: 'Complete!' });

        return Promise.resolve({
          compressedFile: new File(['compressed'], 'compressed.mp3', { type: 'audio/mp3' }),
          originalSize: 1000,
          compressedSize: 500,
          compressionRatio: 50,
        });
      });

      const { result } = renderHook(() => useAudioCompression());
      const testFile = new File(['test'], 'test.wav', { type: 'audio/wav' });

      let compressionResult;
      await act(async () => {
        compressionResult = await result.current.compressAudio(testFile);
      });

      expect(compressionResult).toEqual({
        compressedFile: expect.any(File),
        originalSize: 1000,
        compressedSize: 500,
        compressionRatio: 50,
      });

      expect(result.current.isCompressing).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle compression errors', async () => {
      mockStrategy.compressAudio.mockRejectedValue(new Error('Compression failed'));

      const { result } = renderHook(() => useAudioCompression());
      const testFile = new File(['test'], 'test.wav', { type: 'audio/wav' });

      await act(async () => {
        await expect(result.current.compressAudio(testFile)).rejects.toThrow('Compression failed');
      });

      expect(result.current.isCompressing).toBe(false);
      expect(result.current.error).toBe('Compression failed');
    });

    it('should update compression state during processing', async () => {
      let progressCallback: ((progress: any) => void) | undefined;

      mockStrategy.compressAudio.mockImplementation((file, onProgress) => {
        progressCallback = onProgress;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              compressedFile: new File(['compressed'], 'compressed.mp3', { type: 'audio/mp3' }),
              originalSize: 1000,
              compressedSize: 500,
              compressionRatio: 50,
            });
          }, 100);
        });
      });

      const { result } = renderHook(() => useAudioCompression());
      const testFile = new File(['test'], 'test.wav', { type: 'audio/wav' });

      act(() => {
        result.current.compressAudio(testFile);
      });

      // Should be compressing immediately
      expect(result.current.isCompressing).toBe(true);

      // Simulate progress updates
      act(() => {
        progressCallback?.({ phase: 'loading', progress: 10, message: 'Loading...' });
      });

      expect(result.current.progress).toEqual({
        phase: 'loading',
        progress: 10,
        message: 'Loading...',
      });

      act(() => {
        progressCallback?.({ phase: 'processing', progress: 50, message: 'Processing...' });
      });

      expect(result.current.progress).toEqual({
        phase: 'processing',
        progress: 50,
        message: 'Processing...',
      });
    });

    it('should handle strategy initialization failure', async () => {
      const mockFactory = CompressionFactory.getInstance() as any;
      mockFactory.getCompressionStrategy.mockRejectedValue(new Error('Strategy init failed'));

      const { result } = renderHook(() => useAudioCompression());
      const testFile = new File(['test'], 'test.wav', { type: 'audio/wav' });

      await act(async () => {
        await expect(result.current.compressAudio(testFile)).rejects.toThrow(
          'Failed to initialize compression. Please try refreshing the page.'
        );
      });

      expect(result.current.error).toBe(
        'Failed to initialize compression. Please try refreshing the page.'
      );
    });
  });

  describe('getStrategyInfo', () => {
    it('should return strategy information', async () => {
      const { result } = renderHook(() => useAudioCompression());

      // Initialize strategy first
      const testFile = new File(['test'], 'test.wav', { type: 'audio/wav' });
      mockStrategy.compressAudio.mockResolvedValue({
        compressedFile: new File(['compressed'], 'compressed.mp3', { type: 'audio/mp3' }),
        originalSize: 1000,
        compressedSize: 500,
        compressionRatio: 50,
      });

      await act(async () => {
        await result.current.compressAudio(testFile);
      });

      const strategyInfo = result.current.getStrategyInfo();

      expect(strategyInfo).toEqual({
        strategyName: 'Mock Strategy',
        isReady: true,
        environment: {
          isVercel: false,
          isProduction: false,
          isDevelopment: true,
        },
      });
    });

    it('should return not initialized when no strategy is loaded', () => {
      const { result } = renderHook(() => useAudioCompression());

      const strategyInfo = result.current.getStrategyInfo();

      expect(strategyInfo).toEqual({
        strategyName: 'Not initialized',
        isReady: false,
        environment: {
          isVercel: false,
          isProduction: false,
          isDevelopment: true,
        },
      });
    });
  });
});
