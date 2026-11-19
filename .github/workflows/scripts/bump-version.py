#!/usr/bin/env python3
"""Bump a Python dependency with tools.bump_version and open a pull request.

Reads PACKAGE, VERSION (`latest` asks PyPI for the newest release),
PR_OPTIONS, SENDER, and SENDER_ID from the environment. PR_OPTIONS holds extra
`gh pr create` arguments: only its first line is read, split on spaces and
tabs, with no quote or glob processing, so it is never run as shell source.
Exits without a pull request when the bump changes nothing.
"""

from __future__ import annotations

import os
import re
import shlex
import subprocess
import sys


def pr_option_args(pr_options: str) -> list[str]:
    first_line = pr_options.split("\n", 1)[0]
    return [arg for arg in re.split(r"[ \t]+", first_line) if arg]


def latest_version(package: str) -> str:
    """Return what `curl -sL URL | jq -r .info.version` prints, exiting like pipefail."""
    url = f"https://pypi.org/pypi/{package}/json"
    print(
        f"+ {shlex.join(('curl', '-sL', url))} | jq -r .info.version", file=sys.stderr, flush=True
    )
    curl = subprocess.run(["curl", "-sL", url], stdout=subprocess.PIPE)
    jq = subprocess.run(["jq", "-r", ".info.version"], input=curl.stdout, stdout=subprocess.PIPE)
    for returncode in (jq.returncode, curl.returncode):
        if returncode != 0:
            sys.exit(returncode)
    return jq.stdout.decode().rstrip("\n")


def run(*args: str, check: bool = True) -> int:
    """Run a command, and exit with its status when it fails and check is set."""
    print(f"+ {shlex.join(args)}", file=sys.stderr, flush=True)
    returncode = subprocess.run(args).returncode
    if check and returncode != 0:
        sys.exit(returncode)
    return returncode


def main() -> None:
    package = os.environ["PACKAGE"]
    version = os.environ["VERSION"]
    sender = os.environ["SENDER"]
    sender_id = os.environ["SENDER_ID"]

    if version == "latest":
        version = latest_version(package)

    run("git", "checkout", "-b", f"bot/bump-version/{package}/{version}")
    run("python3", "-S", "-m", "tools.bump_version", package, version)

    if run("git", "diff", "--exit-code", check=False) == 0:
        return

    run(
        "git",
        "-c",
        "user.name=getsentry-bot",
        "-c",
        "user.email=10587625+getsentry-bot@users.noreply.github.com",
        "commit",
        "--all",
        "--message",
        f"ref: bump {package} to {version}",
        "--message",
        f"Co-Authored-By: {sender} <{sender_id}+{sender}@users.noreply.github.com>",
    )
    run("git", "push", "origin", "HEAD", "--quiet")
    run("gh", "pr", "create", "--fill", *pr_option_args(os.environ.get("PR_OPTIONS", "")))


if __name__ == "__main__":
    main()
