# OrbStack Docker Socket Fix

When `devservices serve` or `sentry devserver` fails with "Make sure colima is running" for OrbStack users, the issue is in `src/sentry/runner/commands/devservices.py`.

## The Problem

The `check_docker_daemon_running()` function checks for a Docker socket at a hardcoded Colima path. When using OrbStack, that path doesn't exist, so it falls through to the error message telling the user to start Colima.

## The Fix Pattern

Replace the single hardcoded socket path with a function that checks multiple paths:

```python
import os
import sys

if sys.platform == "darwin":
    _DOCKER_SOCKET_PATHS = [
        os.path.expanduser("~/.colima/default/docker.sock"),
        os.path.expanduser("~/.orbstack/run/docker.sock"),
        "/var/run/docker.sock",
    ]
else:
    _DOCKER_SOCKET_PATHS = ["/var/run/docker.sock"]


def _find_docker_socket() -> str:
    for path in _DOCKER_SOCKET_PATHS:
        if os.path.exists(path):
            return path
    return ""
```

Then update `check_docker_daemon_running()` to use `_find_docker_socket()` and update the error message:

```python
def check_docker_daemon_running():
    socket_path = _find_docker_socket()
    if not socket_path:
        raise SystemExit(
            "Make sure your Docker runtime is running (Colima, OrbStack, or Docker Desktop)."
        )
    # ... rest of the check using socket_path
```

## Verify

After patching:

1. Remove any symlinks: `rm -f ~/.colima/default/docker.sock` (if it was a symlink to OrbStack)
2. Ensure OrbStack is running: `orbctl status`
3. Run: `.venv/bin/sentry devserver` — should detect OrbStack's socket automatically
