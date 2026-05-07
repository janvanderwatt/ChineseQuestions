# App Requirements

## Feature Set
- Form-based Q&A interface for Chinese language learning
- 3 pre-defined question templates:
  1. Character meaning: "What does [char] mean in [sentence]?"
  2. Phrase alternative: "Why can't I use [phrase] instead of [phrase] in [sentence]?"
  3. Naturalness check: "Is this sentence natural? [sentence]"
- Each template has SUBMIT button
- Responses from AI (OpenRouter) in English, simple + practical

## UI/UX
- Modern fonts with Simplified Chinese support
- Color: Medium-dark cyan accents, white background, black text
- Responsive, clean layout
- Config input field for OpenRouter API key

## Tech Stack
- Vanilla HTML/CSS/JS
- OpenRouter API for AI responses
- Local config (config.js)
- Desktop testing on Win 11
- Future: Deploy to web via SSH

## Output Structure
- Single page app
- Form component(s) with template selection
- Response display area
- Settings/config area for API key
