export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface CompressionProgress {
  phase: 'loading' | 'processing' | 'complete';
  progress: number;
  message: string;
}

export interface CompressionStrategy {
  /**
   * Compress an audio file
   */
  compressAudio(
    file: File,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult>;

  /**
   * Check if this strategy is available in the current environment
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the name of this compression strategy
   */
  getName(): string;

  /**
   * Initialize the compression strategy (if needed)
   */
  initialize(): Promise<void>;
}

export interface CompressionOptions {
  bitrate?: string;
  frequency?: number;
  mono?: boolean;
}
