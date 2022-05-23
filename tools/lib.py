# Unbounded function cache.
# lru_cache(maxsize=None) has a fast path since it doesn't care about bounds.
# functools.cache is introduced in python 3.9, but is literally just what the shim is.
try:
    from functools import cache
except ImportError:
    from functools import lru_cache as _lru_cache

    def cache(func):
        return _lru_cache(maxsize=None)(func)


@cache
def gitroot():
    from os import getcwd
    from os.path import isdir, normpath

    gitroot, root = getcwd(), "/"
    while not isdir(f"{gitroot}/.git"):
        gitroot = normpath(f"{gitroot}/..")
        if gitroot == root:
            raise RuntimeError("failed to locate a git root directory")
    return gitroot
