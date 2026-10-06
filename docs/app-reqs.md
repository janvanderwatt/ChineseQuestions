# App Requirements

## Feature Set
- Form-based Q&A interface for Chinese language learning
- 5 pre-defined inline question templates:
  1. Character meaning: "What does [char] mean in [sentence]?"
  2. Phrase alternative: "Why can't I use [phrase] instead of [phrase] in [sentence]?"
  3. Naturalness check: "Does [sentence] sound natural?"
  4. Tone rewrite: "How else can I say [sentence] to sound [tone]?" — tone is a free-text field with suggested values offered via dropdown (friendlier / more casual / more formal / angrier / respectful, plus a few extra). Typed values are not stored.
  5. Word substitution: "What other words can I use instead of [word] in this sentence [sentence]?"
- Each template has an inline **Ask** button (no separate heading per template)
- Templates 4 and 5 must preserve the single-row inline layout; the tone dropdown is sized to sit inline with the other controls
- Responses from AI (OpenRouter) in English, simple + practical
- Templates are prefilled with sample Chinese inputs for local testing
- API routing behavior:
  - If a local API key is saved, call OpenRouter directly from browser.
  - If no local API key is saved, call a server-side PHP gateway that injects API key and proxies result.
- On startup, if a locally stored API key exists without a saved date/time, erase it automatically.

## UI/UX
- Modern fonts with Simplified Chinese support
- Color: Medium-dark cyan accents, white background, black text
- Responsive, single-column layout (max-width 680px)
- Compact mobile behavior targeting one-line template rows where possible (max two lines when needed)
- Short inline inputs for words/phrases (`slot-input-short`, max 4.5rem) and wider inline inputs for sentences (`slot-input-long`, flex)
- Tone field (`slot-input-tone`) is a text input with a `<datalist>`, so suggestions appear as a dropdown but any adjective can be typed. Fixed width (`slot-input-tone-wrap`) keeps the row on one line; the value is never persisted.
- Each template row is a flex line: label spans + inputs + **Ask** button, all inline — no per-template headings
- Disclaimer at the top stating responses are AI-generated and may contain mistakes
- Config input field for OpenRouter API key
- Local API key save operation stores key + ISO date/time stamp.
- Config panel is collapsible and closed by default.
- Saving a local API key must first validate the key once; only valid keys are persisted.
- API key input field must stay empty on load (saved key is not re-populated into UI input).
- Config header shows top-right indicator when a local key is stored and verified.
- Debug panel (`<details>`) placed above the config section, hidden by default behind a disclosure
- Response panel should preserve line breaks from AI output for readable multi-line answers
- Response panel is repositioned under the template being asked; previous response is cleared/hidden

## Tech Stack
- Vanilla HTML/CSS/JS
- OpenRouter API for AI responses
- PHP gateway endpoint on server for key-safe proxy mode
- Local config (config.js)
- Desktop testing on Win 11
- Future: Deploy to web via SSH

## Output Structure
- Single page app, single column
- Inline template rows stacked vertically (no section headings)
- Response display area
- Active response appears directly below the submitted template (single shared response area moved per submit)
- Response body supports readable multi-line text formatting
- Collapsible debug area (`<details>`) for request/response inspection
- Settings/config area for API key (below debug)
