from __future__ import annotations

import sys
from typing import Any, Callable

# Unbounded function cache.
# lru_cache(maxsize=None) has a fast path since it doesn't care about bounds.
# functools.cache is introduced in python 3.9, but is literally just what the shim is.
if sys.version_info >= (3, 9):
    from functools import cache
else:
    from functools import lru_cache as _lru_cache

    def cache(func: Callable[..., Any]) -> Any:
        return _lru_cache(maxsize=None)(func)


# Modified from pre-commit @ fb0ccf3546a9cb34ec3692e403270feb6d6033a2
@cache
def gitroot() -> str:
    from os.path import abspath
    from subprocess import CalledProcessError, run

    # Git 2.25 introduced a change to "rev-parse --show-toplevel" that exposed
    # underlying volumes for Windows drives mapped with SUBST.  We use
    # "rev-parse --show-cdup" to get the appropriate path, but must perform
    # an extra check to see if we are in the .git directory.
    try:
        proc = run(("git", "rev-parse", "--show-cdup"), check=True, capture_output=True)
        root = abspath(proc.stdout.decode().strip())
        proc = run(("git", "rev-parse", "--is-inside-git-dir"), check=True, capture_output=True)
        inside_git_dir = proc.stdout.decode().strip()
    except CalledProcessError:
        raise SystemExit(
            "git failed. Is it installed, and are you in a Git repository " "directory?",
        )
    if inside_git_dir != "false":
        raise SystemExit(
            "git toplevel unexpectedly empty! make sure you are not "
            "inside the `.git` directory of your repository.",
        )
    return root
