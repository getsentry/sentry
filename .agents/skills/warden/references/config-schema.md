# warden.toml Configuration Schema

## Top-Level Structure

```toml
version = 1                    # Required, must be 1

[defaults]                     # Optional, inherited by all skills
[[skills]]                     # Required, array of skill configs
```

## Defaults Section

```toml
[defaults]
model = "claude-sonnet-4-20250514"    # Default model
maxTurns = 50                         # Max agentic turns per hunk
defaultBranch = "main"                # Base branch for comparisons
failOn = "high"                # Exit 1 if findings >= this severity
reportOn = "medium"            # Show findings >= this severity
maxFindings = 50               # Max findings to report (0 = unlimited)
reportOnSuccess = false        # Post report even with no findings
paths = ["src/**/*.ts"]        # Include only matching files
ignorePaths = ["*.test.ts"]    # Exclude matching files

[defaults.chunking]
enabled = true                 # Enable hunk-based chunking

[defaults.chunking.coalesce]
enabled = true                 # Merge nearby hunks
maxGapLines = 30               # Lines between hunks to merge
maxChunkSize = 8000            # Max chars per chunk

[[defaults.chunking.filePatterns]]
pattern = "*.config.*"         # Glob pattern
mode = "whole-file"            # per-hunk | whole-file | skip
```

## Skills Section

```toml
[[skills]]
name = "skill-name"            # Required, unique identifier
remote = "owner/repo@sha"      # Optional, fetch skill from GitHub repo
paths = ["src/**"]             # Include only matching files
ignorePaths = ["**/*.test.ts"] # Exclude matching files

# Optional overrides (inherit from defaults if not set)
model = "claude-opus-4-20250514"
maxTurns = 100
failOn = "critical"
reportOn = "high"
maxFindings = 20
reportOnSuccess = true

[[skills.triggers]]
type = "pull_request"          # Required: pull_request | local | schedule
actions = ["opened", "synchronize"]  # Required for pull_request

# Schedule-specific (only for type = "schedule")
[[skills.triggers]]
type = "schedule"

[skills.triggers.schedule]
issueTitle = "Daily Security Review"   # GitHub issue title for tracking
createFixPR = true                     # Create PR with fixes
fixBranchPrefix = "security-fix"       # Branch name prefix
```

**Trigger types:**

- `pull_request` - Triggers on PR events
- `local` - Local CLI only (will not run in CI)
- `schedule` - Cron schedule (GitHub Action only)

All skills run locally regardless of trigger type. Skills with no triggers run everywhere (wildcard). Use `type = "local"` for skills that should _only_ run locally.

**Actions (for pull_request):**

- `opened`, `synchronize`, `reopened`, `closed`

## Severity Values

Used in `failOn` and `reportOn`:

- `critical` - Most severe
- `high`
- `medium`
- `low`
- `info` - Least severe
- `off` - Disable threshold

## Built-in Skip Patterns

Always skipped (cannot be overridden):

- Package locks: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `Cargo.lock`, etc.
- Minified files: `**/*.min.js`, `**/*.min.css`
- Build artifacts: `dist/`, `build/`, `node_modules/`, `.next/`, `__pycache__/`
- Generated code: `*.generated.*`, `*.g.ts`, `__generated__/`

## Environment Variables

| Variable                   | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `WARDEN_ANTHROPIC_API_KEY` | Claude API key (required)                                  |
| `WARDEN_MODEL`             | Default model (lowest priority)                            |
| `WARDEN_STATE_DIR`         | Override cache location (default: `~/.local/warden`)       |
| `WARDEN_SKILL_CACHE_TTL`   | Cache TTL in seconds for unpinned remotes (default: 86400) |

## Model Precedence (highest to lowest)

1. Skill-level `model`
2. `[defaults]` `model`
3. CLI `--model` flag
4. `WARDEN_MODEL` env var
5. SDK default
