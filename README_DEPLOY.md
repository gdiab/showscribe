# ShowScribe Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- OpenAI API key

### Setup
```bash
# Clone and install dependencies
git clone <repo-url>
cd showscribe
npm install

# Configure environment
cp env.sample .env.local
# Edit .env.local with your API keys

# Start development server
npm run dev
```

Visit `http://localhost:3000`

### Required Environment Variables
- `OPENAI_API_KEY` - Required for audio transcription and text generation
- `SENTRY_DSN` - Optional for error monitoring (free tier available)
- `UPSTASH_REDIS_REST_URL/TOKEN` - Optional for cost tracking (free tier available)
- `UPSTASH_QSTASH_URL/TOKEN` - Optional for large file queuing (free tier available)
- `DAILY_COST_CAP` - Optional cost limit (default: $5)

## Vercel Deployment

### 1. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 2. Configure Environment Variables
In Vercel dashboard, add these environment variables:

**Required:**
- `OPENAI_API_KEY`: Your OpenAI API key

**Recommended:**
- `SENTRY_DSN`: Your Sentry project DSN
- `NEXT_PUBLIC_SENTRY_DSN`: Same as SENTRY_DSN
- `SENTRY_TRACES_SAMPLE_RATE`: `0.1`

**Optional (Free Tier):**
- `UPSTASH_REDIS_REST_URL`: Redis URL for cost tracking
- `UPSTASH_REDIS_REST_TOKEN`: Redis token
- `UPSTASH_QSTASH_URL`: `https://qstash.upstash.io`
- `UPSTASH_QSTASH_TOKEN`: QStash token for large file queuing
- `DAILY_COST_CAP`: Daily OpenAI cost limit in USD (default: `5`)

### 3. Verification
- Upload a small audio file - should work immediately
- Upload >30MB file - gets queued (requires QStash)
- Check Sentry for error monitoring
- Monitor costs in console logs

## Features
- **Rate Limiting**: 3 requests per 10 minutes per IP
- **Cost Tracking**: Daily OpenAI spend monitoring
- **Large File Queue**: Files >30MB processed asynchronously
- **SLA Monitoring**: Alerts for requests >120 seconds
- **Error Tracking**: Comprehensive Sentry integration

## Support
- Localhost and Vercel previews bypass rate limiting
- Queue system gracefully falls back if QStash unavailable
- All features work with free tiers of external services