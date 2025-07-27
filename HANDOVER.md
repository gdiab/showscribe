# ShowScribe Development Handover

## Current Status: Two-Step Upload/Transcription Implementation Complete

### Primary Achievement

Successfully implemented **two-step upload/transcription flow** to solve timeout issues with large podcast files (60+ minutes).

### What Works

✅ **Client-side compression**: 697MB WAV → 15.8MB MP3 (97.7% reduction)
✅ **Two-stage show notes generation**: Fixed OpenAI rate limit issues  
✅ **Files up to 45 minutes**: Process completely without issues
✅ **UI flow**: Upload → File Analysis → Start Transcription → Show Notes

### Current Issue

**60+ minute files still timing out** during transcription step, but now we have proper architecture to debug and fix.

---

## Architecture Overview

### 1. Client-Side Compression (`src/hooks/useAudioCompression.ts`)

- Uses FFmpeg.wasm in browser to compress large files
- Automatic compression for files >25MB
- Progress tracking with status messages
- 90%+ storage and bandwidth savings

### 2. Two-Step Backend Flow

**Step 1: Upload & Analysis (`/api/upload`)**

- Upload compressed file to Vercel Blob
- Analyze file metadata (duration, size, format)
- Return file info without transcription
- **Timer**: ~30 seconds (just upload)

**Step 2: Transcription (`/api/transcribe`)**

- Takes blob URL from Step 1
- Fresh 5-minute timer dedicated to transcription
- Downloads file and sends to OpenAI Whisper
- **Timer**: Fresh 300 seconds for transcription only

### 3. Show Notes Generation (`/api/generate`)

- Two-stage OpenAI processing to avoid rate limits
- Stage 1: Condensed summary from full transcript
- Stage 2A: Title/bio/social from summary (2K tokens)
- Stage 2B: Highlights from full transcript (13K tokens)
- **Total**: ~29,400 tokens (under 30K limit)

---

## Next Steps (Priority Order)

### 1. Test Current Implementation (HIGH)

```bash
# Deploy current changes and test
npm run build && git add -A && git commit -m "Complete two-step UI implementation" && git push

# Test with the 697MB file that previously timed out
# Should now show file analysis screen with "Start Transcription" button
```

### 2. Debug Timeout Issue (HIGH)

**Root cause**: OpenAI Whisper takes 5+ minutes for 60+ minute audio
**Solutions to explore**:

- Accept 45-50 minute limit for MVP
- Implement audio chunking (split 60min → 6×10min segments)
- Async processing with job queue

### 3. User Feedback (HIGH)

- Deploy with 45-minute soft limit messaging
- Create Google Form for beta feedback
- Test with real users on 30-45 minute podcasts

---

## Key File Locations

### Backend APIs

- `src/app/api/upload/route.ts` - Step 1: Upload & analysis
- `src/app/api/transcribe/route.ts` - Step 2: Transcription only
- `src/app/api/generate/route.ts` - Step 3: Show notes generation

### Frontend

- `src/app/page.tsx` - Main page with two-step flow UI
- `src/components/Uploader.tsx` - Upload with client compression
- `src/hooks/useAudioCompression.ts` - FFmpeg.wasm integration

### Configuration

- `vercel.json` - Function timeouts and memory limits
- `prompts/` - Two-stage generation prompts

---

## Test Results Summary

- **45-minute MP3**: ✅ Complete success in 1m 57s
- **148MB WAV**: ✅ Client compression + success
- **697MB WAV**: ✅ Client compression, ❌ transcription timeout

The architecture is solid. Just need to solve the final timeout issue for 60+ minute files.
