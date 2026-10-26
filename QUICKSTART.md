# Quick Start

## Setup

1. **Create config.js** from the template:
   ```bash
   cp config.example.js config.js
   ```

2. **Configure PHP gateway key on server** (recommended):
   - Copy `api/gateway-config.example.php` to `api/gateway-config.php`
   - Set `OPENROUTER_API_KEY` in that file (or set server env var `OPENROUTER_API_KEY`)
   - Optional: Set `SITE_PASSWORD_HASH` for a shared site password
   - Optional: Set `SITE_PASSWORD_HINT` for a custom gate message
   - Optional: Adjust `RATE_LIMIT_PER_MINUTE` / `RATE_LIMIT_PER_DAY`
   - Keep `api/gateway-config.php` out of git (already in `.gitignore`)

3. **Add your OpenRouter API key** to `config.js`:
   - Get key from [openrouter.ai](https://openrouter.ai)
   - Keep `OPENROUTER_API_KEY` empty for server PHP gateway mode
   - Optional: Save a key in the app UI for direct browser mode

4. **Open in browser**:
   - Right-click `index.html` → Open with browser
   - Or drag `index.html` into browser window

## Question Templates

| # | Template | Purpose |
|---|----------|---------|
| **Q1** | Character meaning | "What does *X* mean in this sentence?" |
| **Q2** | Phrase alternative | "Can I use *A* instead of *B* here?" |
| **Q3** | Naturalness check | "Does this sentence sound natural?" |
| **Q4** | Tone rewrite | "Rewrite in *tone* (respectful, casual, etc.)" |
| **Q5** | Word usage examples | "Give me several natural sentences using *word*" |
| **Q6** | Word usage guide | "How do I use *word*? (auto-completes compounds)" |

Responses stream in as markdown. The response box appears under the template you just asked and clears previous output.

## Features

- **Two modes**: Local key → direct OpenRouter calls; no key → server PHP gateway
- **Rate limiting**: 3 req/min, 50 req/day per IP (configurable, rolling windows)
- **Optional site password**: bcrypt hash in gateway config; entered once, stored in `localStorage`; "Lock site" button forgets it
- **Model fallbacks**: free-tier models by default (`gemma-4-26b`, `nemotron-3-super`)
- **Mobile-friendly**: compact layout, template rows stay mostly one-line
- **Config section**: collapsible, closed by default; key validated before save; saved key never shown back

## Deploy (SSH + SCP)

Use the deploy script to copy essential static files to your web server:

```bash
# Dry run first
python deploy.py --dry-run

# Deploy
python deploy.py --host lightcatorg-lightcatorg --remote-dir /home/lightcatorg/apps/chineseqa
```

**What gets deployed:**
- `index.html`
- `src/` (JS, CSS)
- `api/` (includes `openrouter-gateway.php`)
- `config.js` (omit with `--no-config`)

Optional flags:
- `--host <ssh-alias>`
- `--remote-dir <path>`
- `--project-dir <path>`
- `--no-config` (skip config.js)

## Testing Locally

```bash
node test-forms.js      # prompt generation (Q1–Q6)
node test-templates.js  # Q4/Q5 handlers
node test-api-extract.js
node test-latex.js
```

Tested examples:
- Q1: 很 in "我的朋友很高"
- Q2: 段 vs 矮 in "我的朋友很矮"
- Q3: "我的朋友很矮" naturalness check
- Q4: "我的朋友很矮" with tone "respectful"
- Q5: "矮" in "我的朋友很矮"
- Q6: "担心"