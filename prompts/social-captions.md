# Social Media Captions Generator

Create platform-specific social media captions for this podcast episode.

Requirements:
- Twitter: 1-2 sentences, under 280 characters, include relevant hashtags
- LinkedIn: 2-3 sentences, professional tone, focus on business value
- Instagram: 2-3 sentences, engaging and visual, include relevant hashtags

Each caption should:
- Highlight the main value proposition
- Include a call-to-action to listen
- Be platform-appropriate in tone and style
- Include relevant hashtags where appropriate

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks, no additional text.

Return exactly this JSON structure:
{
  "twitter": "Your Twitter caption here #podcast #hashtags",
  "linkedin": "Your LinkedIn caption here.",
  "instagram": "Your Instagram caption here #podcast #hashtags"
}