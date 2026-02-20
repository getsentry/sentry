---
name: warden
description: Run Warden to analyze code changes before committing. Use when asked to "run warden", "check my changes", "review before commit", "warden config", "warden.toml", "create a warden skill", "add trigger", or any Warden-related local development task.
---

Run Warden to analyze code changes before committing.

## References

Read the relevant reference when the task requires deeper detail:

| Document                                             | Read When                                                |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `${CLAUDE_SKILL_ROOT}/references/cli-reference.md`   | Full option details, per-command flags, examples         |
| `${CLAUDE_SKILL_ROOT}/references/configuration.md`   | Editing warden.toml, triggers, patterns, troubleshooting |
| `${CLAUDE_SKILL_ROOT}/references/config-schema.md`   | Exact field names, types, and defaults                   |
| `${CLAUDE_SKILL_ROOT}/references/creating-skills.md` | Writing custom skills, remote skills, skill discovery    |

## Running Warden

```bash
# Analyze uncommitted changes (uses warden.toml triggers)
warden

# Run a specific skill
warden --skill find-bugs

# Analyze specific files
warden src/auth.ts src/database.ts

# Analyze changes from a git ref
warden main..HEAD
warden HEAD~3

# Auto-apply suggested fixes
warden --fix

# Fail on high-severity findings
warden --fail-on high
```

Set `WARDEN_ANTHROPIC_API_KEY` or log in via `claude login` before running.

## Pre-Commit Workflow

After making code changes and before committing:

1. Run `warden` to analyze uncommitted changes
2. Review the findings
3. Fix issues Warden reports (or use `warden --fix` to auto-apply)
4. Commit the changes

Run Warden once to validate work. Do not loop re-running Warden on the same changes.

## Reading Output

**Severity levels:**

- `critical` - Must fix before merge
- `high` - Should fix before merge
- `medium` - Worth reviewing
- `low` - Minor improvement
- `info` - Informational only

**Exit codes:** `0` = no findings at or above fail threshold. `1` = findings at or above fail threshold.

**Verbosity:** `-v` shows real-time findings. `-vv` shows debug info (tokens, latency). `-q` shows errors and summary only.

## Commands

| Command                | Description                                |
| ---------------------- | ------------------------------------------ |
| `warden`               | Run analysis (default)                     |
| `warden init`          | Initialize warden.toml and GitHub workflow |
| `warden add [skill]`   | Add skill trigger to warden.toml           |
| `warden sync [remote]` | Update cached remote skills                |
| `warden setup-app`     | Create GitHub App via manifest flow        |

For full options and flags, read `${CLAUDE_SKILL_ROOT}/references/cli-reference.md`.
