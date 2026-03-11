---
name: setup-dev
description: Set up and manage the Sentry development environment using devenv. Handles fresh setup, updating existing environments, starting dev services, and troubleshooting. Use when asked to "set up sentry", "setup dev environment", "get sentry running", "start dev server", "devenv setup", "devservices not working", "sentry won't start", or any development environment issue.
---

# Set Up Sentry Development Environment

Walk the user through getting Sentry running locally. The full process from a bare machine takes **30-45 minutes** — most of that is downloading dependencies and Docker images. Set expectations clearly at each step.

**AL MCP**: If the `al` MCP server is available, use `al_search_docs` and `al_read_doc` for detailed troubleshooting. The AL docs cover devenv, devservices, and common issues in depth. The AL server is part of the [devinfra-mcp](https://github.com/getsentry/devinfra-mcp) project — see that repo for setup instructions if the server isn't configured yet. The SSE endpoint is configured in `.pi/mcp.json` (pi) or `.mcp.json` / `.cursor/mcp.json` (Claude Code / Cursor).

## Step 1: Detect Current State

Before doing anything, assess what's already installed. Run all of these:

```bash
# Check OS
uname -s && uname -m

# Check shell
echo $SHELL

# Check if devenv exists
which devenv 2>/dev/null || ls ~/.local/share/sentry-devenv/bin/devenv 2>/dev/null

# Check devenv version (outdated versions cause failures)
devenv --version 2>/dev/null || ~/.local/share/sentry-devenv/bin/devenv --version 2>/dev/null

# Check Docker runtime
docker context ls 2>/dev/null
docker info --format '{{.Name}}' 2>/dev/null

# Check OrbStack
which orbctl 2>/dev/null && orbctl status 2>/dev/null

# Check Colima
which colima 2>/dev/null && colima status 2>/dev/null

# Check direnv
which direnv 2>/dev/null

# Check if repo is already set up
ls .venv/bin/sentry 2>/dev/null && ls node_modules/.bin 2>/dev/null
```

Based on results, skip to the appropriate step. If everything is installed, jump to Step 6.

## Step 2: Install Prerequisites (macOS)

### Xcode Command Line Tools

```bash
xcode-select -p 2>/dev/null || xcode-select --install
```

If not installed, the user must complete the interactive install dialog (~10 min). Wait for it.

### Homebrew

```bash
which brew || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Docker Runtime — OrbStack or Colima

Ask the user which they prefer. Explain the tradeoffs:

| Runtime      | Pros                                                   | Cons                                                     |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------- |
| **Colima**   | Official Sentry recommendation, all scripts support it | Can have DNS issues on WiFi changes                      |
| **OrbStack** | Faster, lower resource usage, better UI                | Some Sentry scripts assume Colima — may need workarounds |

**If choosing OrbStack:**

```bash
brew install --cask orbstack
```

Then start OrbStack from Applications. Verify: `docker info`

**If choosing Colima:**
Colima gets installed by `devenv bootstrap` — no separate step needed.

**Important**: Do NOT run Docker Desktop alongside either runtime — it causes conflicts.

## Step 3: Install devenv

```bash
# For external (non-Sentry-employee) contributors:
# export SENTRY_EXTERNAL_CONTRIBUTOR=1

curl -fsSL https://raw.githubusercontent.com/getsentry/devenv/main/install-devenv.sh | bash
```

This installs to `~/.local/share/sentry-devenv/bin/devenv`.

### Shell Configuration

The user's shell MUST have devenv on PATH and direnv hooked in. Check and fix:

```bash
# Check if already configured
grep -q "sentry-devenv" ~/.zshrc 2>/dev/null || grep -q "sentry-devenv" ~/.bashrc 2>/dev/null
```

If not configured, add to the appropriate shell config (`~/.zshrc` for zsh, `~/.bashrc` for bash):

```bash
# devenv
export PATH="$HOME/.local/share/sentry-devenv/bin:$PATH"

# direnv
eval "$(direnv hook zsh)"   # or: eval "$(direnv hook bash)"
```

**Tell the user to restart their terminal** (or `source ~/.zshrc`) after this change.

### Verify devenv Version

Minimum version changes frequently. If devenv is already installed, check it's not outdated:

```bash
devenv --version
```

If the version is old (e.g., < 1.22), upgrade:

```bash
devenv update
```

If `devenv update` itself fails because the version is too old, reinstall:

```bash
curl -fsSL https://raw.githubusercontent.com/getsentry/devenv/main/install-devenv.sh | bash
```

## Step 4: Bootstrap (First Time Only)

For a completely fresh setup, run bootstrap first:

```bash
devenv bootstrap
```

This is interactive (~5 min) — it prompts for SSH keys, coderoot directory, etc. It installs Homebrew, Colima, Docker CLI, and direnv.

**After bootstrap completes, close and reopen the terminal.**

## Step 5: Sync the Environment

This is the longest step. Tell the user:

> **This will take 10-20 minutes** on first run. It installs Python, Node, all pip/npm dependencies, and runs database migrations. Subsequent syncs are much faster (2-5 min).

### If direnv hangs

The `.envrc` runs Docker checks. If the Docker runtime isn't running, direnv will hang. Symptoms:

```
direnv: ([...]/direnv export zsh) is taking a while to execute. Use CTRL-C to give up.
```

**Fix**: Start the Docker runtime first:

- OrbStack: Open OrbStack.app or `open -a OrbStack`
- Colima: `devenv colima start`

Then `direnv allow` again.

### Chicken-and-Egg Problem

direnv checks node version and sentry installation. On a fresh setup, these don't exist yet, so direnv will fail. This is normal. **Bypass direnv and run devenv sync directly:**

```bash
~/.local/share/sentry-devenv/bin/devenv sync
```

Or if devenv is on PATH:

```bash
devenv sync
```

After sync completes, `direnv allow` should succeed.

### If devenv sync fails

Common causes:

1. **Outdated devenv** — `devenv update` or reinstall
2. **Docker not running** — start OrbStack/Colima first
3. **Network issues** — retry; some downloads are large

Run `devenv doctor` for automated diagnosis.

## Step 6: Start Services

### First: Start Docker Images

```bash
devservices up
```

**⏱️ First run: 5-10 minutes.** It pulls many Docker images (PostgreSQL, Redis, Kafka, ClickHouse, Snuba, Relay, etc.). This is a one-time cost. Tell the user:

> This is downloading all the Docker images Sentry needs. It looks like a lot — that's normal. Subsequent starts take ~30 seconds.

**Subsequent runs: ~30 seconds.**

### OrbStack Socket Issue

If `devservices up` or `devservices serve` fails with:

```
Make sure colima is running. Run `devenv colima start`.
```

...but the user is using OrbStack, the `devservices.py` command is checking for the Colima socket only. Check `src/sentry/runner/commands/devservices.py`:

```bash
grep -n "colima\|docker.sock\|orbstack" src/sentry/runner/commands/devservices.py
```

The `_find_docker_socket()` function needs to check multiple socket paths. On macOS it should try, in order:

1. `~/.colima/default/docker.sock` (Colima)
2. `~/.orbstack/run/docker.sock` (OrbStack)
3. `/var/run/docker.sock` (Docker Desktop / default)

If only Colima is checked, patch it to support all runtimes. Read `${CLAUDE_SKILL_ROOT}/references/orbstack-fix.md` for the exact pattern.

### Then: Seed the Database

If this is a first-time setup, the database needs seeding:

```bash
.venv/bin/sentry upgrade --noinput
```

This runs all Django migrations AND creates default data (organizations, roles, projects). Without this, the dev server will 500 on every page.

**Do NOT just run `sentry django migrate`** — that only runs migrations without seeding the required default data.

### Create Superuser

```bash
.venv/bin/sentry createuser --superuser --email admin@sentry.io --password admin --no-input
```

## Step 7: Start the Dev Server

```bash
devservices serve
```

Or directly:

```bash
.venv/bin/sentry devserver
```

### What to Expect on Startup

**Kafka topic warnings are normal.** On first start, you'll see many lines like:

```
[WARNING] sentry.batching-kafka-consumer: Topic 'taskworker' or its partitions are not ready, retrying...
```

These settle down after 30-60 seconds as Kafka auto-creates topics. Don't panic.

### Access the Dev Server

- **URL**: http://dev.sentry.localhost:8000
- **Login**: admin@sentry.io / admin

### Required: Sentry Cookie Sync Extension

**Without this extension, the UI shows a blank white screen.** Install it:

https://chromewebstore.google.com/detail/sentry-cookie-sync/kchlmkcdfohlmobgojmipoppgpedhijh

This syncs auth cookies between sentry.io and dev.sentry.localhost. It's not optional.

## Day-to-Day Commands

After initial setup, the daily workflow is:

```bash
cd ~/Projects/sentry    # (or wherever the repo lives)
devservices up           # start background services (~30s)
devservices serve        # start dev server
# → http://dev.sentry.localhost:8000
```

After pulling new code:

```bash
devenv sync              # update dependencies + migrations (2-5 min)
```

## Troubleshooting Decision Tree

| Symptom                                         | Likely Cause                              | Fix                                                  |
| ----------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| direnv hangs                                    | Docker runtime not running                | Start OrbStack / Colima                              |
| `devenv sync` fails with version error          | Outdated devenv                           | `devenv update` or reinstall                         |
| `devservices up` says "colima not running"      | Using OrbStack, script only checks Colima | Patch `devservices.py` — see Step 6                  |
| Server 500s on every page                       | DB not seeded                             | `.venv/bin/sentry upgrade --noinput`                 |
| `relation "sentry_organization" does not exist` | Migrations not run                        | `.venv/bin/sentry upgrade --noinput`                 |
| White/blank screen in browser                   | Cookie Sync extension missing             | Install the Chrome extension                         |
| Kafka topic warnings on startup                 | Normal first-boot behavior                | Wait 30-60 seconds                                   |
| Port already in use                             | Stale containers                          | `docker rm -f $(docker ps -aq)` then retry           |
| Everything is broken                            | Nuclear option                            | `devservices purge && devenv sync && devservices up` |
| DNS failures in Docker                          | Colima DNS stale                          | `devenv doctor` or `devenv colima restart`           |

For deeper troubleshooting, use the AL MCP if available ([devinfra-mcp](https://github.com/getsentry/devinfra-mcp)):

```
al_search_docs(query="<symptom keywords>")
al_read_doc(path="devenv/troubleshooting.md", query="<specific issue>")
```
