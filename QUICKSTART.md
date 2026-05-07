# Quick Start

## Setup

1. **Create config.js** from the template:
   ```bash
   cp config.example.js config.js
   ```

2. **Configure PHP gateway key on server** (recommended):
   - Copy `api/gateway-config.example.php` to `api/gateway-config.php`
   - Set `OPENROUTER_API_KEY` in that file (or set server env var `OPENROUTER_API_KEY`)
   - Keep `api/gateway-config.php` out of git (already in `.gitignore`)

3. **Add your OpenRouter API key** to `config.js`:
   - Get key from [openrouter.ai](https://openrouter.ai)
   - Keep `OPENROUTER_API_KEY` empty for server PHP gateway mode
   - Optional: Save a key in the app UI for direct browser mode

4. **Open in browser**:
   - Right-click `index.html` → Open with browser
   - Or drag `index.html` into browser window

## Usage

- **Q1**: Paste character + sentence context → AI explains meaning
- **Q2**: Paste alternative phrase + correct phrase + full sentence → AI explains why alt doesn't work
- **Q3**: Paste sentence → AI checks if natural sounding
- Responses preserve line breaks for clearer formatting
- Mobile layout is compacted so template rows stay mostly one-line (up to two lines if needed)
- The response box appears directly under the template you just asked and clears previous output
- If a local key is saved, app calls OpenRouter directly
- If no local key is saved, app calls configured PHP gateway endpoint
- Local key storage includes save timestamp; startup removes legacy key entries that have no timestamp
- Config section is collapsible and closed by default
- Entered local key is validated first; only valid keys are saved
- Saved key is not shown back in the input field; config header indicates stored/verified state

All responses in English, kept practical + concise.

## Deploy (SSH + SCP)

Use the deploy script to copy essential static files to your web server:

```bash
py .\deploy.py --dry-run
py .\deploy.py
```

Default deployment target uploads:
- `index.html`
- `src/`
- `api/` (includes `openrouter-gateway.php`)
- `config.js`

Optional flags:
- `--host <ssh-alias>`
- `--remote-dir <path>`
- `--project-dir <path>`
- `--no-config` (skip config.js)

## Testing Locally

Tested examples:
- Q1: 很 in "我的朋友很高"
- Q2: 段 vs 矮 in "我的朋友很矮"
- Q3: "我的朋友很矮" naturalness check
