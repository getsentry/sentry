from __future__ import annotations

import os
import subprocess
import sys

from devenv.lib import proc

tags: set[str] = {"sentry"}
name = "sentry environment is synced"

reporoot = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _problems() -> list[str]:
    problems = []

    if not os.access(f"{reporoot}/.venv/bin/sentry", os.X_OK):
        problems.append("sentry isn't installed in .venv")
    if not os.access(f"{reporoot}/.venv/bin/prek", os.X_OK):
        problems.append("prek isn't installed in .venv")

    if os.path.exists(f"{reporoot}/agents.toml"):
        lock = f"{reporoot}/agents.lock"
        skills = f"{reporoot}/.agents/skills"
        locked = os.path.isfile(lock) and os.path.getsize(lock) > 0
        installed = os.path.isdir(skills) and bool(os.listdir(skills))
        if not (locked and installed):
            problems.append("agent skills aren't installed")

    if os.environ.get("SENTRY_DEVENV_SKIP_FRONTEND") != "1":
        with open(f"{reporoot}/.node-version") as f:
            expected = f"v{f.read().strip()}"
        node = f"{reporoot}/.devenv/bin/node"
        if not os.access(node, os.X_OK):
            problems.append("node isn't installed in .devenv/bin")
        else:
            actual = subprocess.run((node, "--version"), capture_output=True, text=True).stdout
            if actual.strip() != expected:
                problems.append(f"node is {actual.strip() or 'broken'}, expected {expected}")
        if not os.path.isdir(f"{reporoot}/node_modules"):
            problems.append("pnpm packages aren't installed")

    return problems


def check() -> tuple[bool, str]:
    problems = _problems()
    if problems:
        return False, "; ".join(problems)
    return True, ""


def fix() -> tuple[bool, str]:
    try:
        proc.run((sys.executable, "-P", "-m", "devenv", "sync"), cwd=reporoot)
    except RuntimeError as e:
        return False, f"devenv sync failed: {e}"
    return check()
