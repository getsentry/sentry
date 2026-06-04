from __future__ import annotations

import resource
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from sentry.utils import metrics


def get_rss_usage() -> int:
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss


@contextmanager
def track_memory_usage(metric: str, **kwargs: Any) -> Generator[None]:
    before = get_rss_usage()
    try:
        yield
    finally:
        metrics.distribution(metric, get_rss_usage() - before, unit="byte", **kwargs)
