from __future__ import annotations

import logging
from dataclasses import dataclass
from time import time

from django.conf import settings

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis

logger = logging.getLogger(__name__)


ErrorLimit = float("inf")
DEFAULT_MAX_TTL_SECONDS = 30


@dataclass
class ConcurrentLimitInfo:
    limit: int
    current_executions: int
    limit_exceeded: bool


class ConcurrentRateLimiter:
    def __init__(self, max_tll_seconds: int = DEFAULT_MAX_TTL_SECONDS) -> None:
        cluster_key = getattr(settings, "SENTRY_RATE_LIMIT_REDIS_CLUSTER", "default")
        self.client = redis.redis_clusters.get(cluster_key)
        self.max_ttl_seconds = max_tll_seconds

    def validate(self) -> None:
        try:
            self.client.ping()
        except Exception as e:
            raise InvalidConfiguration(str(e))

    def namespaced_key(self, key: str) -> str:
        return f"concurrent_limit:{key}"

    def start_request(self, key: str, limit: int, request_uid: str) -> ConcurrentLimitInfo:
        redis_key = self.namespaced_key(key)
        try:
            cur_time = time()
            p = self.client.pipeline()
            p.zremrangebyscore(redis_key, "-inf", cur_time - self.max_ttl_seconds)

            # TODO: do this using a redis lua script to keep things atomic
            p.zcard(redis_key)
            currently_executing_calls = p.execute()[1]

            if currently_executing_calls >= limit:
                return ConcurrentLimitInfo(limit, currently_executing_calls, True)
            else:
                p = self.client.pipeline()
                p.zadd(redis_key, {request_uid: cur_time})
                p.zcard(redis_key)
                current_executions = p.execute()[1]
                return ConcurrentLimitInfo(limit, current_executions, False)
        except Exception:
            logger.exception(
                "Could not start request", dict(key=redis_key, limit=limit, request_uid=request_uid)
            )
            return ConcurrentLimitInfo(limit, -1, False)

    def get_concurrent_requests(self, key: str) -> int:
        redis_key = self.namespaced_key(key)
        # this can fail loudly as it is only meant for observability
        return self.client.zcard(redis_key)

    def finish_request(self, key: str, request_uid: str) -> None:
        try:
            self.client.zrem(self.namespaced_key(key), request_uid)
        except Exception:
            logger.exception("Could not finish request", dict(key=key, request_uid=request_uid))
