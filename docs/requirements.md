# Background
- I am an English learner learning Chinese
- I often wonder, why is this character here? or, could I have used another phrase?

# Rough requirements
- Write an app with a few pre-defined question structures that the user can fill in
Examples:
  - What does character [ 很 ] mean in this sentence [ 我的朋友很高 ] ?
  - Why can't I use [ 段 ] instead of [ 矮 ] in this sentence [ 我的朋友很矮 ] ?
  - Does [ 我的朋友很矮 ] sound natural?
- Each template has an inline "Ask" button (no separate heading per template)
- On submit, pass a relevant query to an AI with some prompting to answer the user's question.
- Prompt the AI to explain in English with simple examples if possible. Don't be too verbose or theoretical.
- I like modern fonts that are Simplified Chinese-capable
- Use a medium-dark cyan schema for accents, but mostly white background with black text
- You'll need an API key for OpenRouter - make space for me to put it in the config

# Framework
- Pick a framework that will easily work as a web page
- I will integrate this with some other pages I have later, so keep this one simple
- I want to test on my PC, then eventually, deploy to a web site using built-in SSH config.

# Docs
- Keep a structured note of the plan, a checklist of stages and actions completed -> 'docs/stages-project.md'.
- Transform this document into a proper set of requirements, but don't go overboard -> 'docs/app-reqs.md'.

# Source Control
- Init a GIT repo, then commit when we are ready at various stages

# Testing
- You are on a Win 11 machine - do some checks yourself before letting me test
- Some packages are not on the path, look for them in C:
