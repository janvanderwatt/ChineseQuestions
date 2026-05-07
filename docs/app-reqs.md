# App Requirements

## Feature Set
- Form-based Q&A interface for Chinese language learning
- 3 pre-defined inline question templates:
  1. Character meaning: "What does [char] mean in [sentence]?"
  2. Phrase alternative: "Why can't I use [phrase] instead of [phrase] in [sentence]?"
  3. Naturalness check: "Is [sentence] natural?"
- Each template has SUBMIT button
- Responses from AI (OpenRouter) in English, simple + practical
- Templates are prefilled with sample Chinese inputs for local testing

## UI/UX
- Modern fonts with Simplified Chinese support
- Color: Medium-dark cyan accents, white background, black text
- Responsive, clean layout
- Short inline inputs for words/phrases and wider inline inputs for sentence text
- Config input field for OpenRouter API key
- Debug panel retained for development, hidden by default behind a disclosure

## Tech Stack
- Vanilla HTML/CSS/JS
- OpenRouter API for AI responses
- Local config (config.js)
- Desktop testing on Win 11
- Future: Deploy to web via SSH

## Output Structure
- Single page app
- Inline template components stacked vertically
- Response display area
- Settings/config area for API key
- Collapsible debug area for request/response inspection
