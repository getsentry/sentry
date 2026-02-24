---
name: agents-md
description: This skill should be used when the user asks to "create AGENTS.md", "update AGENTS.md", "maintain agent docs", "set up CLAUDE.md", or needs to keep agent instructions concise. Guides discovery of local skills and enforces minimal documentation style.
---

# Maintaining AGENTS.md

AGENTS.md is the canonical agent-facing documentation. Keep it minimal—agents are capable and don't need hand-holding.

## File Setup

1. Create `AGENTS.md` at project root
2. Create symlink: `ln -s AGENTS.md CLAUDE.md`

## Before Writing

Discover local skills to reference:

```bash
find .claude/skills -name "SKILL.md" 2>/dev/null
ls plugins/*/skills/*/SKILL.md 2>/dev/null
```

Read each skill's frontmatter to understand when to reference it.

## Writing Rules

- **Headers + bullets** - No paragraphs
- **Code blocks** - For commands and templates
- **Reference, don't duplicate** - Point to skills: "Use `db-migrate` skill. See `.claude/skills/db-migrate/SKILL.md`"
- **No filler** - No intros, conclusions, or pleasantries
- **Trust capabilities** - Omit obvious context
- **Skill updates** - ALWAYS use `/skill-creator` when creating or updating skills

## Required Sections

### Package Manager
Which tool and key commands only:
```markdown
## Package Manager
Use **pnpm**: `pnpm install`, `pnpm dev`, `pnpm test`
```

### Commit Attribution
Always include this section. Agents should use their own identity:
```markdown
## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: (the agent model's name and attribution byline)
```
Example: `Co-Authored-By: Claude Sonnet 4 <noreply@example.com>`
```

### Key Conventions
Project-specific patterns agents must follow. Keep brief.

### Local Skills
Reference each discovered skill:
```markdown
## Database
Use `db-migrate` skill for schema changes. See `.claude/skills/db-migrate/SKILL.md`

## Testing
Use `write-tests` skill. See `.claude/skills/write-tests/SKILL.md`
```

## Optional Sections

Add only if truly needed:
- API route patterns (show template, not explanation)
- CLI commands (table format)
- File naming conventions

## Anti-Patterns

Omit these:
- "Welcome to..." or "This document explains..."
- "You should..." or "Remember to..."
- Content duplicated from skills (reference instead)
- Obvious instructions ("run tests", "write clean code")
- Explanations of why (just say what)
- Long prose paragraphs

## Example Structure

```markdown
# Agent Instructions

## Package Manager
Use **pnpm**: `pnpm install`, `pnpm dev`

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: (the agent model's name and attribution byline)
```

## API Routes
[Template code block]

## Database
Use `db-migrate` skill. See `.claude/skills/db-migrate/SKILL.md`

## Testing
Use `write-tests` skill. See `.claude/skills/write-tests/SKILL.md`

## CLI
| Command | Description |
|---------|-------------|
| `pnpm cli sync` | Sync data |
```
