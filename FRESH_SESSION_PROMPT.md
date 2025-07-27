# Fresh Session Continuation Prompt

Use this exact prompt when starting a new Claude Code session:

---

**Continue ShowScribe development where we left off. I've been implementing a two-step upload/transcription flow to solve timeout issues with large podcast files.**

**Current Status:**

- ✅ Client-side compression working perfectly (697MB → 15.8MB, 97.7% reduction)
- ✅ Two-stage show notes generation implemented (fixes OpenAI rate limits)
- ✅ Two-step UI flow implemented (Upload → Analysis → Transcription → Show Notes)
- ❌ 60+ minute files still timing out during transcription step

**Immediate Next Steps:**

1. Deploy and test the completed two-step implementation
2. Test with the 697MB file that was timing out before
3. Debug the remaining transcription timeout issue for 60+ minute files

**Key Context:**

- We solved the original compression timeout by splitting upload from transcription
- Client-side FFmpeg compression eliminated server-side timeout issues
- The final blocker is OpenAI Whisper taking 5+ minutes for long audio
- 45-minute files work perfectly, 60+ minute files timeout at exactly 5 minutes

**What I need you to do:**
Read the HANDOVER.md file for full context, then help me deploy and test the current implementation. The two-step architecture should now allow 60+ minute files to at least reach the transcription step without timing out during upload/compression.

**Files to check:**

- `src/app/page.tsx` (two-step UI)
- `src/app/api/transcribe/route.ts` (new transcription endpoint)
- `src/app/api/upload/route.ts` (modified for analysis only)

Let's get this working for 60+ minute podcasts so I can start collecting user feedback.

---

**This prompt will get you back to exactly where we left off with full context.**
