import { CompressionFactory } from '@/services/compression/CompressionFactory';
import { FFmpegCompressionStrategy } from '@/services/compression/FFmpegCompressionStrategy';
import { WebAudioCompressionStrategy } from '@/services/compression/WebAudioCompressionStrategy';

// Mock FFmpeg
jest.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    load: jest.fn(),
    writeFile: jest.fn(),
    exec: jest.fn(),
    readFile: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    deleteFile: jest.fn(),
  })),
}));

jest.mock('@ffmpeg/util', () => ({
  toBlobURL: jest.fn().mockResolvedValue('mock-url'),
  fetchFile: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

describe('CompressionFactory', () => {
  beforeEach(() => {
    CompressionFactory.getInstance().reset();
    jest.clearAllMocks();
  });

  describe('getEnvironment', () => {
    it('should detect development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const env = CompressionFactory.getEnvironment();

      expect(env.isDevelopment).toBe(true);
      expect(env.isProduction).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it('should detect Vercel environment', () => {
      const originalVercel = process.env.VERCEL;
      process.env.VERCEL = '1';

      const env = CompressionFactory.getEnvironment();

      expect(env.isVercel).toBe(true);

      process.env.VERCEL = originalVercel;
    });
  });

  describe('shouldForceFFmpeg', () => {
    it('should return false when localStorage is not available', () => {
      // Mock window being undefined (server-side)
      const originalWindow = global.window;
      delete (global as any).window;

      const result = CompressionFactory.shouldForceFFmpeg();

      expect(result).toBe(false);

      global.window = originalWindow;
    });

    it('should return true when FORCE_FFMPEG is set in localStorage', () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValue('true');

      const result = CompressionFactory.shouldForceFFmpeg();

      expect(result).toBe(true);
      expect(window.localStorage.getItem).toHaveBeenCalledWith('FORCE_FFMPEG');
    });
  });

  describe('getCompressionStrategy', () => {
    it('should return the same strategy instance on subsequent calls', async () => {
      const factory = CompressionFactory.getInstance();

      const strategy1 = await factory.getCompressionStrategy();
      const strategy2 = await factory.getCompressionStrategy();

      expect(strategy1).toBe(strategy2);
    });

    it('should throw error when no strategies are available', async () => {
      // Mock both strategies as unavailable
      jest.spyOn(FFmpegCompressionStrategy.prototype, 'isAvailable').mockResolvedValue(false);
      jest.spyOn(WebAudioCompressionStrategy.prototype, 'isAvailable').mockResolvedValue(false);

      const factory = CompressionFactory.getInstance();

      await expect(factory.getCompressionStrategy()).rejects.toThrow(
        'No compression strategies available'
      );
    });
  });
});

describe('FFmpegCompressionStrategy', () => {
  let strategy: FFmpegCompressionStrategy;

  beforeEach(() => {
    strategy = new FFmpegCompressionStrategy();
    jest.clearAllMocks();
  });

  describe('getName', () => {
    it('should return correct name', () => {
      expect(strategy.getName()).toBe('FFmpeg WASM');
    });
  });

  describe('isAvailable', () => {
    it('should return false in server environment', async () => {
      const originalWindow = global.window;
      delete (global as any).window;

      const result = await strategy.isAvailable();

      expect(result).toBe(false);

      global.window = originalWindow;
    });

    it('should return false when SharedArrayBuffer is not available', async () => {
      const originalSharedArrayBuffer = window.SharedArrayBuffer;
      delete (window as any).SharedArrayBuffer;

      const result = await strategy.isAvailable();

      expect(result).toBe(false);

      window.SharedArrayBuffer = originalSharedArrayBuffer;
    });

    it('should return true when all requirements are met', async () => {
      const result = await strategy.isAvailable();

      expect(result).toBe(true);
    });
  });

  describe('compressAudio', () => {
    it('should compress audio file successfully', async () => {
      const mockFile = new File(['test'], 'test.wav', { type: 'audio/wav' });
      const progressCallback = jest.fn();

      await strategy.initialize();
      const result = await strategy.compressAudio(mockFile, progressCallback);

      expect(result).toEqual({
        compressedFile: expect.any(File),
        originalSize: mockFile.size,
        compressedSize: expect.any(Number),
        compressionRatio: expect.any(Number),
      });

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'complete',
          progress: 100,
          message: 'Compression complete!',
        })
      );
    });

    it('should use aggressive compression for large files', async () => {
      // Create a mock large file (100MB+)
      const largeFile = new File(['x'.repeat(100 * 1024 * 1024)], 'large.wav', {
        type: 'audio/wav',
      });

      await strategy.initialize();
      await strategy.compressAudio(largeFile);

      // Verify FFmpeg exec was called with aggressive settings
      const mockFFmpeg = require('@ffmpeg/ffmpeg').FFmpeg;
      const ffmpegInstance = mockFFmpeg.mock.results[0].value;

      expect(ffmpegInstance.exec).toHaveBeenCalledWith([
        '-i',
        expect.stringContaining('input.'),
        '-acodec',
        'mp3',
        '-ab',
        '32k', // Aggressive bitrate for large files
        '-ac',
        '1',
        '-ar',
        '16000', // Low frequency for large files
        '-f',
        'mp3',
        expect.stringContaining('output.'),
      ]);
    });

    it('should handle compression errors gracefully', async () => {
      const mockFile = new File(['test'], 'test.wav', { type: 'audio/wav' });
      const mockFFmpeg = require('@ffmpeg/ffmpeg').FFmpeg;
      const ffmpegInstance = mockFFmpeg.mock.results[0].value;

      // Mock FFmpeg exec to throw an error
      ffmpegInstance.exec.mockRejectedValue(new Error('FFmpeg error'));

      await strategy.initialize();

      await expect(strategy.compressAudio(mockFile)).rejects.toThrow(
        'Audio compression failed. Please try a different file or compress manually.'
      );
    });
  });
});

describe('WebAudioCompressionStrategy', () => {
  let strategy: WebAudioCompressionStrategy;

  beforeEach(() => {
    strategy = new WebAudioCompressionStrategy();
  });

  describe('getName', () => {
    it('should return correct name', () => {
      expect(strategy.getName()).toBe('Web Audio API (Fallback)');
    });
  });

  describe('isAvailable', () => {
    it('should return false in server environment', async () => {
      const originalWindow = global.window;
      delete (global as any).window;

      const result = await strategy.isAvailable();

      expect(result).toBe(false);

      global.window = originalWindow;
    });

    it('should return true when AudioContext is available', async () => {
      const result = await strategy.isAvailable();

      expect(result).toBe(true);
    });
  });

  describe('compressAudio', () => {
    it('should process audio file with fallback method', async () => {
      const mockFile = new File(['test content'], 'test.wav', { type: 'audio/wav' });
      const progressCallback = jest.fn();

      const result = await strategy.compressAudio(mockFile, progressCallback);

      expect(result).toEqual({
        compressedFile: expect.any(File),
        originalSize: mockFile.size,
        compressedSize: mockFile.size, // Fallback doesn't actually compress
        compressionRatio: 5, // Simulated minimal compression
      });

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'complete',
          progress: 100,
          message: 'Fallback processing complete!',
        })
      );
    });

    it('should handle file reading errors', async () => {
      const mockFile = {
        arrayBuffer: jest.fn().mockRejectedValue(new Error('File read error')),
        size: 1000,
        name: 'test.wav',
      } as any;

      await expect(strategy.compressAudio(mockFile)).rejects.toThrow(
        'Audio processing failed. Please try refreshing the page.'
      );
    });
  });
});
