from __future__ import annotations

from functools import cache


# Simplified from pre-commit @ fb0ccf3546a9cb34ec3692e403270feb6d6033a2
@cache
def gitroot() -> str:
    from os.path import abspath
    from subprocess import CalledProcessError, run

    try:
        proc = run(("git", "rev-parse", "--show-cdup"), check=True, capture_output=True)
        root = abspath(proc.stdout.decode().strip())
    except CalledProcessError:
        raise SystemExit(
            "git failed. Is it installed, and are you in a Git repository " "directory?",
        )
    return root
