"""Deprecated compatibility import; use sentry.testutils.pytest.workers."""

from sentry.testutils.pytest.workers import get_redis_db as get_redis_db

__all__ = ["get_redis_db"]
