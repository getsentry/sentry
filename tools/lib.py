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


@cache
def gitroot() -> str:
    from os import getcwd
    from os.path import isdir, normpath

    gitroot, root = getcwd(), "/"
    while not isdir(f"{gitroot}/.git"):
        gitroot = normpath(f"{gitroot}/..")
        if gitroot == root:
            raise RuntimeError("failed to locate a git root directory")
    return gitroot
