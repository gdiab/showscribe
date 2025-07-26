# Lightweight Sections Generation

Based on the podcast summary provided, generate the following sections: episode title, guest biography, and social media captions.

## Output Format

Return your response as a JSON object with this exact structure:

```json
{
  "title": "Engaging episode title here",
  "guestBio": "Guest biography paragraph here",
  "socialCaptions": {
    "twitter": "Twitter post here (max 280 chars)",
    "linkedin": "LinkedIn post here (professional tone)",
    "instagram": "Instagram caption here (engaging, visual)"
  }
}
```

## Section Requirements:

### Title

- Create an engaging, clickable episode title
- 5-12 words maximum
- Include the main topic or key insight
- Avoid generic phrases like "Episode #" or "Interview with"
- Make it compelling and specific

### Guest Bio

- 2-3 sentences about the guest
- Include their name, title/role, and expertise
- Mention relevant achievements or background
- Focus on what makes them qualified to discuss the topic
- If no clear guest, write about the main speaker/host

### Social Captions

**Twitter:**

- Maximum 280 characters
- Include key insight or teaser
- Use relevant hashtags (2-3 max)
- Include call-to-action if appropriate

**LinkedIn:**

- Professional tone, 2-3 sentences
- Focus on business insights or professional development
- Include question to engage audience
- No hashtags needed

**Instagram:**

- Engaging, conversational tone
- 1-2 sentences with emoji use
- Visual/storytelling approach
- Include relevant hashtags (3-5)

## Important Notes:

- Return ONLY the JSON object, no additional text
- Ensure all quotes are properly escaped in JSON
- Keep content engaging and valuable
- Focus on the main themes from the summary provided

Generate the lightweight sections based on this podcast summary:
