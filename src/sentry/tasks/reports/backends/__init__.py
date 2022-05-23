from .base import ReportBackend
from .dummy import DummyReportBackend
from .redis import RedisReportBackend

__all__ = (
    "DummyReportBackend",
    "RedisReportBackend",
    "ReportBackend",
    "backend",
)

from sentry.utils import redis

backend = RedisReportBackend(redis.clusters.get("default"), 60 * 60 * 3)
