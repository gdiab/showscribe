import OpenAI from 'openai';
import * as Sentry from '@sentry/nextjs';

export class CostExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CostExceededError';
  }
}

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface CostMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
  latencyMs: number;
  model: string;
}

// GPT-4o pricing (as of 2024)
const MODEL_COSTS = {
  'gpt-4o': {
    input: 0.0025 / 1000,  // $0.0025 per 1K input tokens
    output: 0.01 / 1000,   // $0.01 per 1K output tokens
  },
  'whisper-1': {
    input: 0.006 / 60,     // $0.006 per minute
    output: 0,
  },
} as const;

class OpenAIClient {
  private client: OpenAI;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private redis: any = null;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Initialize Redis client if available
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.initRedis();
    }
  }

  private async initRedis() {
    try {
      const { Redis } = await import('@upstash/redis');
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
    } catch (error) {
      console.warn('Redis initialization failed:', error);
    }
  }

  private calculateCost(model: string, usage: TokenUsage): number {
    const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS];
    if (!costs) return 0;
    
    return (usage.prompt_tokens * costs.input) + (usage.completion_tokens * costs.output);
  }

  private async checkDailyCostLimit(additionalCost: number): Promise<void> {
    const dailyCostCap = parseFloat(process.env.DAILY_COST_CAP || '5');
    if (!this.redis) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const costKey = `cost:${today}`;
      const currentCost = parseFloat(await this.redis.get(costKey) || '0');
      
      if (currentCost + additionalCost > dailyCostCap) {
        throw new CostExceededError(
          `Daily cost limit exceeded. Current: $${currentCost.toFixed(4)}, Additional: $${additionalCost.toFixed(4)}, Limit: $${dailyCostCap}`
        );
      }
    } catch (error) {
      if (error instanceof CostExceededError) throw error;
      console.warn('Cost check failed:', error);
    }
  }

  private async recordDailyCost(cost: number): Promise<void> {
    if (!this.redis) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const costKey = `cost:${today}`;
      await this.redis.incrbyfloat(costKey, cost);
      await this.redis.expire(costKey, 86400 * 7); // Expire after 7 days
    } catch (error) {
      console.warn('Cost recording failed:', error);
    }
  }

  private logMetrics(metrics: CostMetrics): void {
    // Console log for production monitoring
    console.log('OpenAI API Call:', {
      model: metrics.model,
      promptTokens: metrics.promptTokens,
      completionTokens: metrics.completionTokens,
      totalTokens: metrics.totalTokens,
      costUSD: metrics.costUSD,
      latencyMs: metrics.latencyMs,
    });

    // Sentry breadcrumb for observability
    Sentry.addBreadcrumb({
      category: 'openai',
      message: `${metrics.model} API call`,
      level: 'info',
      data: {
        promptTokens: metrics.promptTokens,
        completionTokens: metrics.completionTokens,
        totalTokens: metrics.totalTokens,
        costUSD: metrics.costUSD,
        latencyMs: metrics.latencyMs,
      },
    });
  }

  async chatCompletion(params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming): Promise<{
    response: OpenAI.Chat.Completions.ChatCompletion;
    metrics: CostMetrics;
  }> {
    const startTime = Date.now();
    
    // Estimate cost before making the call
    const estimatedTokens = JSON.stringify(params.messages).length / 4; // Rough token estimation
    const estimatedCost = this.calculateCost(params.model, {
      prompt_tokens: estimatedTokens,
      completion_tokens: estimatedTokens * 0.3, // Estimate completion tokens
      total_tokens: estimatedTokens * 1.3,
    });
    
    await this.checkDailyCostLimit(estimatedCost);

    try {
      const response = await this.client.chat.completions.create(params);
      const endTime = Date.now();
      
      const usage = response.usage!;
      const actualCost = this.calculateCost(params.model, usage);
      
      const metrics: CostMetrics = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        costUSD: actualCost,
        latencyMs: endTime - startTime,
        model: params.model,
      };

      await this.recordDailyCost(actualCost);
      this.logMetrics(metrics);

      return { response, metrics };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'openai', model: params.model },
        extra: { estimatedCost, estimatedTokens },
      });
      throw error;
    }
  }

  async transcription(params: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    file: any;
    model: string;
    response_format?: string;
  }): Promise<{
    response: OpenAI.Audio.Transcriptions.Transcription;
    metrics: Omit<CostMetrics, 'promptTokens' | 'completionTokens' | 'totalTokens'>;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.audio.transcriptions.create(params as OpenAI.Audio.Transcriptions.TranscriptionCreateParamsNonStreaming);
      const endTime = Date.now();
      
      // Whisper pricing is per minute, but we'll estimate based on file size
      const estimatedCost = 0.006; // Base cost for transcription
      
      const metrics = {
        costUSD: estimatedCost,
        latencyMs: endTime - startTime,
        model: params.model,
      };

      await this.recordDailyCost(estimatedCost);
      
      console.log('OpenAI Transcription:', {
        model: metrics.model,
        costUSD: metrics.costUSD,
        latencyMs: metrics.latencyMs,
      });

      Sentry.addBreadcrumb({
        category: 'openai',
        message: `${metrics.model} transcription`,
        level: 'info',
        data: {
          costUSD: metrics.costUSD,
          latencyMs: metrics.latencyMs,
        },
      });

      return { response, metrics };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'openai', model: params.model },
      });
      throw error;
    }
  }
}

export const openaiClient = new OpenAIClient();