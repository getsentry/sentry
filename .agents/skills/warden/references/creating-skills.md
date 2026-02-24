# Creating Skills

Skills are markdown files that tell Warden what to look for. They follow the [agentskills.io](https://agentskills.io) specification.

## Skill Discovery

Warden searches these directories in order (first match wins):

```
.agents/skills/{name}/SKILL.md   # Primary (recommended)
.claude/skills/{name}/SKILL.md   # Backup (Claude Code convention)
```

## SKILL.md Format

```markdown
---
name: my-skill
description: What this skill analyzes
allowed-tools: Read Grep Glob
---

[Analysis instructions for the agent]

## What to Look For

- Specific issue type 1
- Specific issue type 2

## Output Format

Report findings with severity, location, and suggested fix.
```

## Available Tools

`Read`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Bash`, `Write`, `Edit`

Most review skills only need `Read`, `Grep`, and `Glob` for exploring context.

## Writing Checklist

- One skill, one concern ("security review" not "code quality")
- Clear criteria for what counts as an issue and at what severity
- Actionable findings that include how to fix
- Examples of good and bad code where helpful

## Remote Skills

Skills can be fetched from GitHub repositories:

```bash
# Add a remote skill
warden add --remote getsentry/skills --skill security-review

# Add with version pinning (recommended for reproducibility)
warden add --remote getsentry/skills@abc123 --skill security-review

# List skills in a remote repo
warden add --remote getsentry/skills --list

# Update all unpinned remote skills
warden sync

# Update specific repo
warden sync getsentry/skills

# Run with cached skills only (no network)
warden --offline
```

**Remote skill in warden.toml:**

```toml
[[skills]]
name = "security-review"
remote = "getsentry/skills@abc123"

[[skills.triggers]]
type = "pull_request"
actions = ["opened", "synchronize"]
```

**Cache location:** `~/.local/warden/skills/` (override with `WARDEN_STATE_DIR`)

**Cache TTL:** 24 hours for unpinned refs (override with `WARDEN_SKILL_CACHE_TTL` in seconds)
