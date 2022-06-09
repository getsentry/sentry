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
