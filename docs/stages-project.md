# Project Stages & Checklist

## Stage 1: Setup ✓
- [x] Init git repo
- [x] Create docs (app-reqs.md, stages-project.md)
- [x] Scaffold HTML/JS/CSS structure

## Stage 2: Core Form ✓
- [x] Create HTML template with 3 question form options
- [x] Build form component in JS (state + UI)
- [x] Add CSS styling (cyan accent, white bg)
- [x] Convert templates to compact inline sentence layout
- [x] Test form on Win 11 locally

## Stage 3: API Integration ✓
- [x] Create config.js template (API key input)
- [x] Build OpenRouter API wrapper
- [x] Connect form submit → API call
- [x] Parse & display response
- [x] Handle errors gracefully
- [x] Add temporary debug tooling for request/response inspection

## Stage 4: Polish & Testing ✓
- [x] Test all 3 templates on Win 11
- [x] Verify Chinese font rendering
- [x] Check color scheme
- [x] Manual local testing complete
- [x] Remove per-template h2 headings
- [x] Move Ask button inline into each template-line row
- [x] Rename Submit → Ask
- [x] Collapse two-column layout to single column (max 680px)
- [x] Move debug `<details>` above config section
- [x] Update Template 3 wording to "Does ... sound natural?"
- [x] Improve response formatting (preserve AI line breaks)
- [x] Reduce mobile vertical space in form layout
- [x] Compact mobile template rows toward one-line layout (max two lines)
- [x] Move single response area below active template and clear previous output on submit
- [x] Remove browser default API key and add PHP gateway fallback when no local key exists
- [x] Store local API key with timestamp and erase legacy key records missing timestamp on startup
- [x] Implement `api/openrouter-gateway.php` server endpoint and gateway config template
- [x] Make config section collapsible by default
- [x] Validate local key before save and show stored/verified indicator in config header

## Stage 5: Source Control ✓
- [x] Stage 1-4 commits
- [x] Verify clean git status

## Stage 7: Tone Rewrite + Word Substitution ✓
- [x] Add Q4 template: "How else can I say [sentence] to sound [tone]?" with tone dropdown
- [x] Add Q5 template: "What other words can I use instead of [word] in this sentence [sentence]?"
- [x] Style the dropdown inline to match the slot inputs
- [x] Register Q4/Q5 in the source→button map so the response attaches to the right row
- [x] Update app-reqs.md and requirements notes

## Stage 8: Free Model + Hardening ✓
- [x] Default to a free OpenRouter model instead of paid gpt-4.1-mini
- [x] Retry on the next model for rate limits, upstream errors and empty replies
- [x] Stop rendering model reasoning as the answer
- [x] Resolve conflicting CSS specificity (error border, mobile input sizing)
- [x] Normalize LaTeX symbols to Unicode in rendered answers
- [x] Add AI disclaimer above the templates

## Stage 6: Deployment Ready ✓
- [x] Document SSH integration points
- [x] Prepare for web deployment
- [x] Verify deploy script end-to-end (`py .\deploy.py`)

## Future Hardening Notes
- [ ] Add gateway request size limits
- [ ] Add requestBody allowlist validation in PHP gateway
- [ ] Add gateway origin/shared-secret check
- [ ] Add simple per-IP rate limiting for gateway endpoint
- [ ] Verify Q4/Q5 template rows still fit one line on narrow mobile screens
