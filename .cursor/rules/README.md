# Cursor Rules Configuration

This directory contains `.mdc` (Markdown with Cursor directives) files that configure context-aware loading of AGENTS.md files in Cursor's AI assistant.

## How It Works

When you edit a file, Cursor automatically loads the relevant AGENTS.md based on glob patterns:

| File Type      | Loaded Guide       | Glob Pattern                            |
| -------------- | ------------------ | --------------------------------------- |
| Backend Python | `src/AGENTS.md`    | `src/**/*.py` (excluding tests)         |
| Test files     | `tests/AGENTS.md`  | `tests/**/*.py`, `src/**/tests/**/*.py` |
| Frontend       | `static/AGENTS.md` | `static/**/*.{ts,tsx,js,jsx,css,scss}`  |
| All files      | `AGENTS.md`        | Always loaded                           |

## Files

- **`general.mdc`** - Always loads root `AGENTS.md` for general Sentry context
- **`backend.mdc`** - Loads backend patterns for Python files in `src/`
- **`tests.mdc`** - Loads testing patterns for test files
- **`frontend.mdc`** - Loads frontend patterns for TypeScript/JavaScript/CSS files

## Benefits

- **Token efficient**: Only relevant context is loaded
- **Better AI responses**: Targeted guidance for the current task
- **Maintainable**: Content lives in AGENTS.md files, rules just reference them

## Adding New Rules

To add a new context-specific rule:

1. Create a new `.mdc` file in this directory
2. Add YAML frontmatter with `globs:` or `alwaysApply:`
3. Reference the appropriate AGENTS.md file with `@file:`

Example:

```markdown
---
globs:
  - 'migrations/**/*.py'
---

@file:migrations/AGENTS.md
```

## Documentation

For more information, see:

- [Cursor Context Rules Documentation](https://docs.cursor.com/en/context/rules)
- Root `AGENTS.md` - "Context-Aware Loading" section
