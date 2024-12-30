import resource
from contextlib import contextmanager

from sentry.utils import metrics


def get_rss_usage():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss


@contextmanager
def track_memory_usage(metric, **kwargs):
    before = get_rss_usage()
    try:
        yield
    finally:
        metrics.distribution(metric, get_rss_usage() - before, unit="byte", **kwargs)
