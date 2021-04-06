import sys
import time
from cProfile import Profile
from functools import update_wrapper
from pstats import Stats


def profile_call(_func, *args, **kwargs):
    p = Profile()
    rv = []
    p.runcall(lambda: rv.append(_func(*args, **kwargs)))
    p.dump_stats(f"/tmp/sentry-{time.time()}-{_func.__name__}.prof")

    stats = Stats(p, stream=sys.stderr)
    stats.sort_stats("time", "calls")
    stats.print_stats()
    return rv[0]


def profile(func):
    def newfunc(*args, **kwargs):
        return profile_call(func, *args, **kwargs)

    return update_wrapper(newfunc, func)
