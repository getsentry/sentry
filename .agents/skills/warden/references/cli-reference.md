# CLI Reference

## Usage

```
warden [command] [targets...] [options]
```

Analyze code for security issues and code quality.

## Commands

| Command         | Description                                         |
| --------------- | --------------------------------------------------- |
| `(default)`     | Run analysis on targets or using warden.toml skills |
| `init`          | Initialize warden.toml and GitHub workflow          |
| `add [skill]`   | Add a skill to warden.toml                          |
| `sync [remote]` | Update cached remote skills to latest               |
| `setup-app`     | Create a GitHub App for Warden via manifest flow    |

## Targets

| Target      | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| `<files>`   | Analyze specific files (e.g., `src/auth.ts`)                   |
| `<glob>`    | Analyze files matching pattern (e.g., `"src/**/*.ts"`)         |
| `<git-ref>` | Analyze changes from git ref (e.g., `HEAD~3`, `main..feature`) |
| `(none)`    | Analyze uncommitted changes using warden.toml skills           |

Ambiguous targets (no path separator, no extension) are resolved by checking if a file exists at the path. Use `--git` to force git ref interpretation.

## Options

| Option                   | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `--skill <name>`         | Run only this skill (default: run all built-in skills) |
| `--config <path>`        | Path to warden.toml (default: `./warden.toml`)         |
| `-m, --model <model>`    | Model to use (fallback when not set in config)         |
| `--json`                 | Output results as JSON                                 |
| `-o, --output <path>`    | Write full run output to a JSONL file                  |
| `--fail-on <severity>`   | Exit with code 1 if findings >= severity               |
| `--report-on <severity>` | Only show findings >= severity in output               |
| `--fix`                  | Automatically apply all suggested fixes                |
| `--parallel <n>`         | Max concurrent skill executions (default: 4)           |
| `--git`                  | Force ambiguous targets to be treated as git refs      |
| `--offline`              | Use cached remote skills without network access        |
| `-q, --quiet`            | Errors and final summary only                          |
| `-v, --verbose`          | Show real-time findings and hunk details               |
| `-vv`                    | Show debug info (token counts, latencies)              |
| `--debug`                | Enable debug output (equivalent to `-vv`)              |
| `--log`                  | Use log output (no animations, timestamped)            |
| `--color / --no-color`   | Override color detection                               |
| `-h, --help`             | Show help message                                      |
| `-V, --version`          | Show version number                                    |

## Per-Command Options

**Init:**
| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite existing files |

**Add:**
| Option | Description |
|--------|-------------|
| `--list` | List available skills |
| `--remote <ref>` | Remote repository (`owner/repo`, URL, or with `@sha`) |
| `--force` | Bypass skill cache and fetch latest |

**Sync:**
| Option | Description |
|--------|-------------|
| `--remote <ref>` | Specific remote to sync (default: all) |

**Setup-app:**
| Option | Description |
|--------|-------------|
| `--org <name>` | Create under organization (default: personal) |
| `--port <number>` | Local server port (default: 3000) |
| `--timeout <sec>` | Callback timeout in seconds (default: 300) |
| `--name <string>` | Custom app name (default: Warden) |
| `--no-open` | Print URL instead of opening browser |

## Severity Levels

Used in `--fail-on` and `--report-on`:

| Level      | Meaning                 |
| ---------- | ----------------------- |
| `critical` | Must fix before merge   |
| `high`     | Should fix before merge |
| `medium`   | Worth reviewing         |
| `low`      | Minor improvement       |
| `info`     | Informational only      |
| `off`      | Disable the threshold   |

## Exit Codes

| Code | Meaning                                       |
| ---- | --------------------------------------------- |
| `0`  | No findings at or above `--fail-on` threshold |
| `1`  | Findings at or above `--fail-on` threshold    |

## Examples

```bash
# Initialize
warden init

# Interactive skill selection
warden add
warden add security-review
warden add --list

# Remote skills
warden add --remote getsentry/skills --skill security-review
warden add --remote https://github.com/getsentry/skills --skill security-review
warden add --remote getsentry/skills@abc123 --skill security-review

# Run analysis
warden                                  # Skills from warden.toml
warden src/auth.ts                      # Specific file
warden src/auth.ts --skill security-review
warden "src/**/*.ts"                    # Glob pattern
warden HEAD~3                           # Git changes
warden HEAD~3 --skill security-review
warden main..HEAD                       # Branch diff

# Output control
warden --json
warden --fail-on high
warden -o results.jsonl

# Fix mode
warden --fix

# Cached skills only
warden --offline
warden sync                             # Update all unpinned remote skills

# GitHub App setup
warden setup-app
warden setup-app --org myorg
```
