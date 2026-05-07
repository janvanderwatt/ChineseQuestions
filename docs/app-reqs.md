# App Requirements

## Feature Set
- Form-based Q&A interface for Chinese language learning
- 3 pre-defined inline question templates:
  1. Character meaning: "What does [char] mean in [sentence]?"
  2. Phrase alternative: "Why can't I use [phrase] instead of [phrase] in [sentence]?"
  3. Naturalness check: "Does [sentence] sound natural?"
- Each template has an inline **Ask** button (no separate heading per template)
- Responses from AI (OpenRouter) in English, simple + practical
- Templates are prefilled with sample Chinese inputs for local testing

## UI/UX
- Modern fonts with Simplified Chinese support
- Color: Medium-dark cyan accents, white background, black text
- Responsive, single-column layout (max-width 680px)
- Short inline inputs for words/phrases (`slot-input-short`, max 4.5rem) and wider inline inputs for sentences (`slot-input-long`, flex)
- Each template row is a flex line: label spans + inputs + **Ask** button, all inline — no per-template headings
- Config input field for OpenRouter API key
- Debug panel (`<details>`) placed above the config section, hidden by default behind a disclosure

## Tech Stack
- Vanilla HTML/CSS/JS
- OpenRouter API for AI responses
- Local config (config.js)
- Desktop testing on Win 11
- Future: Deploy to web via SSH

## Output Structure
- Single page app, single column
- Inline template rows stacked vertically (no section headings)
- Response display area
- Collapsible debug area (`<details>`) for request/response inspection
- Settings/config area for API key (below debug)
