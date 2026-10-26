# Chinese Q&A

A tiny web app for asking AI about Chinese words, phrases, and sentences. Six question templates cover character meaning, phrase substitution, naturalness checks, tone-aware rewrites, and word-usage examples.

Built as a static site with an optional PHP gateway so you can share one server-side OpenRouter key instead of asking every visitor for their own.

---

## What it does

| Template | Purpose |
|----------|---------|
| **Q1** | "What does *X* mean in this sentence?" |
| **Q2** | "Can I use *A* instead of *B* here?" |
| **Q3** | "Does this sentence sound natural?" |
| **Q4** | "Rewrite this sentence in *tone* (respectful, casual, etc.)" |
| **Q5** | "Give me several natural sentences using *word* with explanations" |
| **Q6** | "How do I use *word* in a sentence? (auto-completes compounds)" |

Responses stream in, formatted as markdown. No database, no build step — just open `index.html` in a browser.

---

## Local development

```bash
# 1. Copy the config template
cp config.example.js config.js

# 2. (Optional) Put your OpenRouter key in config.js for direct mode,
#    or leave it empty and configure the server gateway instead.

# 3. Open index.html in a browser
#    - Double-click it, or
#    - Drag it into a browser window
```

**No local server required** — everything runs client-side. The PHP gateway is only used on a real host.

---

## Server deployment

The app runs on any web server with PHP 8.1+. The deploy script copies the static files + gateway to a remote host via SSH/SCP.

```bash
# Dry run first
python deploy.py --dry-run

# Deploy
python deploy.py --host lightcatorg-lightcatorg --remote-dir /home/lightcatorg/apps/chineseqa
```

**What gets deployed:**
- `index.html`
- `src/` (JS, CSS)
- `api/openrouter-gateway.php`
- `config.js` (omit with `--no-config`)

**Server-side setup (once):**
```bash
# On the server
cp api/gateway-config.example.php api/gateway-config.php
# Edit api/gateway-config.php:
#   - Set OPENROUTER_API_KEY (or use the OPENROUTER_API_KEY env var)
#   - Optional: Set SITE_PASSWORD_HASH for a shared site password
#   - Optional: Set SITE_PASSWORD_HINT for a custom gate message
#   - Optional: Adjust RATE_LIMIT_PER_MINUTE / RATE_LIMIT_PER_DAY
```

The gateway handles:
- **Rate limiting**: 3 req/min, 50 req/day per IP (configurable, rolling windows)
- **Optional shared password**: one bcrypt hash, stored in `localStorage` after first entry
- **Model fallbacks**: free-tier models by default, configurable

---

## Configuration

| File | Purpose |
|------|---------|
| `config.js` | Client-side: API base, model, fallback list, gateway URL |
| `api/gateway-config.php` | Server-side: OpenRouter key, rate limits, site password hash/hint |

Both have `.example` templates. Neither is committed (in `.gitignore`).

---

## Testing

```bash
node test-forms.js      # prompt generation
node test-templates.js  # Q4/Q5 handlers
node test-api-extract.js
node test-latex.js
```

---

## License

MIT