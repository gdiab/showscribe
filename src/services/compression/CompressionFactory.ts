'use client';

import { CompressionStrategy } from './types';
import { FFmpegCompressionStrategy } from './FFmpegCompressionStrategy';
import { WebAudioCompressionStrategy } from './WebAudioCompressionStrategy';

export class CompressionFactory {
  private static instance: CompressionFactory;
  private currentStrategy: CompressionStrategy | null = null;

  private constructor() {}

  static getInstance(): CompressionFactory {
    if (!CompressionFactory.instance) {
      CompressionFactory.instance = new CompressionFactory();
    }
    return CompressionFactory.instance;
  }

  /**
   * Get the appropriate compression strategy based on environment
   */
  async getCompressionStrategy(): Promise<CompressionStrategy> {
    if (this.currentStrategy) {
      return this.currentStrategy;
    }

    const strategies = await this.getAvailableStrategies();

    if (strategies.length === 0) {
      throw new Error('No compression strategies available');
    }

    // Select the best available strategy
    this.currentStrategy = strategies[0];
    console.log(`Selected compression strategy: ${this.currentStrategy.getName()}`);

    return this.currentStrategy;
  }

  /**
   * Get all available compression strategies in order of preference
   */
  private async getAvailableStrategies(): Promise<CompressionStrategy[]> {
    const strategies = [new FFmpegCompressionStrategy(), new WebAudioCompressionStrategy()];

    const availableStrategies: CompressionStrategy[] = [];

    for (const strategy of strategies) {
      try {
        const isAvailable = await strategy.isAvailable();
        if (isAvailable) {
          availableStrategies.push(strategy);
          console.log(`✓ ${strategy.getName()} is available`);
        } else {
          console.log(`✗ ${strategy.getName()} is not available`);
        }
      } catch (error) {
        console.warn(`Strategy ${strategy.getName()} check failed:`, error);
      }
    }

    return availableStrategies;
  }

  /**
   * Check environment variables and force a specific strategy if needed
   */
  static shouldForceFFmpeg(): boolean {
    if (typeof window === 'undefined') return false;

    // Check for force flag in localStorage (for testing)
    try {
      return localStorage.getItem('FORCE_FFMPEG') === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Detect the current environment
   */
  static getEnvironment(): {
    isVercel: boolean;
    isProduction: boolean;
    isDevelopment: boolean;
    vercelEnv?: string;
  } {
    const isVercel = !!(process.env.VERCEL || process.env.VERCEL_URL || process.env.VERCEL_ENV);

    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const vercelEnv = process.env.VERCEL_ENV;

    return {
      isVercel,
      isProduction,
      isDevelopment,
      vercelEnv,
    };
  }

  /**
   * Reset the strategy selection (useful for testing)
   */
  reset(): void {
    this.currentStrategy = null;
  }
}
