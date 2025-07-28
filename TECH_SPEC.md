# ShowScribe Technical Specification

## Overview

ShowScribe is a Next.js application for podcast transcript processing with AI-powered show notes generation. Features client-side audio compression, enhanced observability, rate limiting, cost controls, and optimized deployment configuration.

## Core Features Implemented

### A. Audio Processing Pipeline

- **Client-Side Compression**: FFmpeg.js in browser for files >25MB using `useAudioCompression` hook
- **Blob Storage**: Vercel Blob storage for temporary file handling via `/api/blob-upload`
- **Two-Stage Flow**: Upload → Transcription → Show Notes Generation
- **Format Support**: MP3, WAV, and other common audio formats

### B. Enhanced Observability

- **Sentry Integration**: Full error tracking and performance monitoring with client replay
- **OpenAI Metrics**: Token usage, cost tracking, and latency monitoring via enhanced wrapper
- **Daily Cost Tracking**: Redis-backed cost accumulation with automatic expiration

### C. Rate Limiting & Security

- **Middleware Protection**: 3 requests per 10 minutes per IP across all API routes
- **Smart Bypass**: Localhost and Vercel preview deployments exempt
- **File Size Limits**: 25MB OpenAI Whisper constraint enforced

### D. Cost Controls

- **Enhanced OpenAI Client** (`src/lib/openai.ts`): Pre-call cost estimation and daily limit enforcement
- **Model Pricing**: GPT-4o and Whisper-1 cost calculations
- **Daily Cap**: `DAILY_COST_CAP` environment variable (default: $5)
- **Error Handling**: `CostExceededError` returns HTTP 429

### E. Background Processing

- **In-Memory Queue**: Simple job status tracking for long-running transcriptions
- **Worker Routes**: `/api/worker/long-job` for background processing
- **Status Polling**: `/api/queue-status` for job monitoring

### F. Deployment Configuration

- **Vercel Optimized**: Function-specific memory (512MB-1024MB) and timeout settings
- **Regional Deployment**: US East (iad1) for optimal OpenAI API latency
- **Environment Variables**: Secure configuration via Vercel dashboard

## Technical Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │ -> │  Rate Limiter   │ -> │   API Routes    │
│  (Client-side   │    │  (Middleware)   │    │ (/api/*)        │
│   FFmpeg.js)    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                                               │
        │              ┌─────────────────┐             │
        └───────────────> Vercel Blob     │             │
                       │   Storage       │             │
                       └─────────────────┘             │
                                                       │
                       ┌─────────────────┐             │
                       │  OpenAI Client  │ <-----------┘
                       │   (Enhanced)    │
                       └─────────────────┘
                               │
        ┌─────────────────────────────────────────┐
        │                                         │
        v                                         v
┌─────────────────┐                     ┌─────────────────┐
│ Upstash Redis   │                     │     Sentry      │
│ (Cost Tracking) │                     │ (Observability) │
└─────────────────┘                     └─────────────────┘
```

## Environment Variables Required

```bash
# Sentry (Observability)
SENTRY_DSN=https://...@...sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@...sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1

# OpenAI API
OPENAI_API_KEY=sk-...

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Upstash Redis (Cost Tracking - Optional)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Cost Control
DAILY_COST_CAP=5
```

## Current File Structure

### Core API Routes

- `src/app/api/blob-upload/route.ts` - Handles blob storage uploads with file analysis
- `src/app/api/transcribe/route.ts` - OpenAI Whisper transcription processing
- `src/app/api/generate/route.ts` - GPT-4o show notes generation
- `src/app/api/queue-status/route.ts` - Job status tracking for background tasks
- `src/app/api/worker/long-job/route.ts` - Background worker for queued jobs

### Core Libraries

- `src/lib/openai.ts` - Enhanced OpenAI client with cost tracking and Sentry integration
- `src/lib/queue.ts` - In-memory job queue for background processing
- `src/hooks/useAudioCompression.ts` - Client-side FFmpeg.js audio compression

### UI Components

- `src/components/Uploader.tsx` - Drag-and-drop file upload with compression
- `src/components/OutputCard.tsx` - Display generated show notes
- `src/components/DownloadButton.tsx` - Export functionality

### Configuration

- `middleware.ts` - Rate limiting (3 req/10min per IP)
- `vercel.json` - Function-specific memory and timeout settings
- `next.config.ts` - Sentry integration configuration

## Deployment Architecture

### Vercel Functions Configuration

```json
{
  "upload/transcribe": { "memory": 1024, "maxDuration": 300 },
  "generate": { "memory": 1024, "maxDuration": 60 },
  "queue-status": { "memory": 512, "maxDuration": 30 }
}
```

### Regional Deployment

- **Region**: US East (iad1) for optimal OpenAI API latency
- **CDN**: Global edge caching for static assets
- **Blob Storage**: Vercel's global blob storage network

## Production Workflow

1. **File Upload**: Client compresses large files (>25MB) using FFmpeg.js
2. **Blob Storage**: Files uploaded to Vercel Blob with metadata analysis
3. **Transcription**: OpenAI Whisper processes audio with cost tracking
4. **Show Notes**: GPT-4o generates structured show notes
5. **Background Jobs**: Long-running tasks queued with status polling
6. **Observability**: All operations tracked in Sentry with metrics

## Success Criteria

- ✅ Client-side audio compression for large files (FFmpeg.js)
- ✅ Enhanced OpenAI wrapper with cost tracking and daily limits
- ✅ Rate limiting with smart bypasses for development
- ✅ Comprehensive error tracking and performance monitoring
- ✅ Two-stage upload/transcription flow to prevent timeouts
- ✅ Production-ready deployment with optimized function configurations
