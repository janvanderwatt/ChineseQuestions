# Quick Start

## Setup

1. **Create config.js** from the template:
   ```bash
   cp config.example.js config.js
   ```

2. **Add your OpenRouter API key** to `config.js`:
   - Get key from [openrouter.ai](https://openrouter.ai)
   - Replace `your-key-here` with your actual key

3. **Open in browser**:
   - Right-click `index.html` → Open with browser
   - Or drag `index.html` into browser window

## Usage

- **Q1**: Paste character + sentence context → AI explains meaning
- **Q2**: Paste alternative phrase + correct phrase + full sentence → AI explains why alt doesn't work
- **Q3**: Paste sentence → AI checks if natural sounding

All responses in English, kept practical + concise.

## Testing Locally

Tested examples:
- Q1: 很 in "我的朋友很高"
- Q2: 段 vs 矮 in "我的朋友很矮"
- Q3: "我的朋友很矮" naturalness check
