Set up and manage the Sentry development environment using devenv.

## Step 1: Check if devenv is installed

Check if devenv is available:

```bash
which devenv || ls ~/.local/share/sentry-devenv/bin/devenv 2>/dev/null
```

If devenv is NOT found, tell the user to install it:

### Installing devenv

For external contributors (non-Sentry employees), first set:

```bash
export SENTRY_EXTERNAL_CONTRIBUTOR=1
```

Then install devenv:

```bash
curl -fsSL https://raw.githubusercontent.com/getsentry/devenv/main/install-devenv.sh | bash
```

This installs to `~/.local/share/sentry-devenv/bin/devenv`. Add to PATH or use full path.

After installation, continue with Step 2.

---

## Step 2: Determine setup state

Ask the user: Is this a fresh setup or are you updating an existing environment?

### Fresh Setup (first time)

Run bootstrap for initial machine setup:

```bash
devenv bootstrap
```

This guides through the complete initial configuration.

### Existing Environment (updating)

Run sync to update dependencies and migrations:

```bash
devenv sync
```

If prompted, run:

```bash
direnv allow
```

---

## Step 3: Start development services

After bootstrap/sync completes:

```bash
# Start background services (postgres, redis, etc.)
devservices up

# Start the development server
devservices serve
```

Access at: http://dev.getsentry.net:8000

Default login: admin@sentry.io / admin

---

## Troubleshooting

If something isn't working, run:

```bash
devenv doctor
```

This diagnoses and resolves common environment issues.

### Common Issues

1. **"direnv: error .envrc is blocked"** - Run `direnv allow`
2. **Docker not running** - Start Docker Desktop or docker daemon
3. **Port conflicts** - Check for processes on ports 5432, 6379, 8000
4. **Stale environment** - Run `devenv sync` after pulling latest changes
