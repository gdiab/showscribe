# ShowScribe Step 1 Technical Specification

## Overview
Enhanced ShowScribe with production-ready observability, rate limiting, cost controls, and deployment configuration.

## Core Features Implemented

### A. Enhanced Observability
- **Sentry Integration**: All configs use environment variables, added client replay
- **Custom Logging**: OpenAI API calls tracked with tokens, cost, latency via Sentry breadcrumbs
- **Daily Cost Tracking**: Redis-backed cost accumulation with `cost:YYYY-MM-DD` keys

### B. Rate Limiting
- **Edge Middleware**: 3 requests per 10 minutes per IP across all API routes
- **Smart Bypass**: Localhost and Vercel preview deployments exempt

### C. Large File Queuing
- **Queue Threshold**: Files >30MB queued via Upstash QStash
- **Worker Route**: `/api/worker/long-job` processes queued transcriptions
- **Status Polling**: `/api/queue-status?id=` for job monitoring
- **Fallback**: Immediate processing if QStash unavailable

### D. Cost Guardrails
- **OpenAI Wrapper** (`src/lib/openai.ts`): Pre-call cost estimation and daily limit enforcement
- **Daily Cap**: `DAILY_COST_CAP` environment variable (default: $5)
- **Error Handling**: `CostExceededError` returns HTTP 429

### E. SLA Monitoring
- **Performance Alerts**: Sentry warnings if `/api/generate` exceeds 120 seconds
- **Enhanced Metrics**: All API calls log tokens, cost, latency

### F. Deployment Configuration
- **Vercel Optimized**: Memory allocation (1024MB), maxDuration (60s)
- **Environment**: All secrets configured via Vercel environment variables

## Technical Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │ -> │  Rate Limiter   │ -> │   API Routes    │
│    (Client)     │    │  (Middleware)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                               │
                       ┌─────────────────┐    │
                       │  OpenAI Client  │ <--┘
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
# Sentry
SENTRY_DSN=https://...@...sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@...sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1

# OpenAI
OPENAI_API_KEY=sk-...

# Upstash (Cost Tracking & Queuing)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
UPSTASH_QSTASH_URL=https://qstash.upstash.io
UPSTASH_QSTASH_TOKEN=...

# Cost Control
DAILY_COST_CAP=5
```

## File Changes Summary

### New Files
- `src/lib/openai.ts` - Enhanced OpenAI wrapper with cost tracking
- `src/app/api/queue-status/route.ts` - Queue status API
- `src/app/api/worker/long-job/route.ts` - Background worker for large files
- `vercel.json` - Deployment configuration

### Modified Files
- `sentry.*.config.ts` - Environment variable configuration
- `middleware.ts` - Enhanced rate limiting with bypass logic
- `src/app/api/upload/route.ts` - Large file queuing and cost tracking
- `src/app/api/generate/route.ts` - SLA monitoring and enhanced logging
- `package.json` - Added @upstash/redis dependency

## Deployment Notes

### Vercel Setup
1. Set environment variables in Vercel dashboard
2. Deploy with `vercel --prod`
3. Functions auto-configured for 1024MB memory, 60s timeout

### AWS Alternative (Future)
- **Compute**: AWS Amplify or ECS for Next.js
- **Storage**: S3 for large file handling (replaces /tmp)
- **Cache**: ElastiCache for Redis
- **Queue**: SQS for background jobs
- **Monitoring**: CloudWatch for observability

## Success Criteria
- ✅ All API calls tracked in Sentry with cost/performance metrics
- ✅ Rate limiting prevents abuse while allowing development
- ✅ Large files (>30MB) processed via queue system
- ✅ Daily costs capped and tracked in Redis
- ✅ SLA violations trigger Sentry alerts
- ✅ Production deployment ready with proper resource allocation