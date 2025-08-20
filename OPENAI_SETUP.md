# OpenAI API Key Setup for AI Avatar Generation

## Option 1: Environment Variable (Recommended)
Add to your shell profile (`.bashrc`, `.zshrc`, etc.):
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

Then restart your terminal or run:
```bash
source ~/.zshrc  # or ~/.bashrc
```

## Option 2: Sentry Options
Add to your Sentry configuration:
```python
SENTRY_OPTIONS["llm.provider.options"] = {
    "openai": {
        "options": {
            "api_key": "sk-your-api-key-here"
        }
    }
}
```

## Option 3: Environment Variable for Sentry Options
```bash
export SENTRY_OPTIONS='{"llm.provider.options": {"openai": {"options": {"api_key": "sk-your-api-key-here"}}}}'
```

## Verify Setup
The backend will log configuration attempts, so check your devserver logs for:
- "Checking OpenAI configuration"
- "Found API key in SENTRY_OPTIONS"
- Any configuration errors
