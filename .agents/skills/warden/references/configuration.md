# Configuration (warden.toml)

See [config-schema.md](config-schema.md) for the complete schema reference.

## Minimal Example

```toml
version = 1

[defaults]
model = "claude-sonnet-4-20250514"

[[skills]]
name = "find-bugs"
paths = ["src/**/*.ts"]

[[skills.triggers]]
type = "pull_request"
actions = ["opened", "synchronize"]
```

## Skill Configuration

Skills define what to analyze and when. Each skill requires a name. Triggers are optional — skills with no triggers run everywhere (PR, local, schedule). All skills run locally regardless of trigger type.

```toml
[[skills]]
name = "security-review"
paths = ["src/auth/**", "src/payments/**"]
failOn = "critical"
reportOn = "high"
maxFindings = 20

[[skills.triggers]]
type = "pull_request"
actions = ["opened", "synchronize"]
```

**Trigger types:** `pull_request`, `local` (local-only), `schedule` (CI-only)

**Actions (pull_request):** `opened`, `synchronize`, `reopened`, `closed`

## Common Patterns

**Strict security on critical files:**

```toml
[[skills]]
name = "security-review"
model = "claude-opus-4-20250514"
maxTurns = 100
paths = ["src/auth/**", "src/payments/**"]
failOn = "critical"

[[skills.triggers]]
type = "pull_request"
actions = ["opened", "synchronize"]
```

**Skip test files:**

```toml
[[skills]]
name = "find-bugs"
paths = ["src/**/*.ts"]
ignorePaths = ["**/*.test.ts", "**/*.spec.ts"]
```

**Whole-file analysis for configs:**

```toml
[defaults.chunking.filePatterns]
pattern = "*.config.*"
mode = "whole-file"
```

## Model Precedence

From highest to lowest priority:

1. Skill-level `model`
2. `[defaults]` `model`
3. CLI `--model` flag
4. `WARDEN_MODEL` env var
5. SDK default

## Environment Variables

| Variable                   | Purpose                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `WARDEN_ANTHROPIC_API_KEY` | Claude API key (required unless using Claude Code subscription) |
| `WARDEN_MODEL`             | Default model (lowest priority)                                 |
| `WARDEN_STATE_DIR`         | Override cache location (default: `~/.local/warden`)            |
| `WARDEN_SKILL_CACHE_TTL`   | Cache TTL in seconds for unpinned remotes (default: 86400)      |

## Troubleshooting

**No findings reported:**

- Check `--report-on` threshold (default shows all)
- Verify skill matches file types in `paths`
- Use `-v` to see which files are being analyzed

**Files being skipped:**

- Built-in skip patterns: lock files, minified, `node_modules/`, `dist/`
- Check `ignorePaths` in config
- Use `-vv` to see skip reasons

**Token/cost issues:**

- Reduce `maxTurns` (default: 50)
- Use chunking settings to control chunk size
- Filter to relevant files with `paths`
