from __future__ import annotations

import logging
from time import time

from django.conf import settings

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis

logger = logging.getLogger(__name__)


ErrorLimit = float("inf")


class ConcurrentRateLimiter:
    def __init__(self, max_tll_seconds: int = 30) -> None:
        cluster_key = getattr(settings, "SENTRY_RATE_LIMIT_REDIS_CLUSTER", "default")
        self.client = redis.redis_clusters.get(cluster_key)
        self.max_ttl_seconds = max_tll_seconds

    def validate(self) -> None:
        try:
            self.client.ping()
        except Exception as e:
            raise InvalidConfiguration(str(e))

    # TODO: maybe pass in the request object? But maybe we don't want to tie this to requests
    def start_request(self, key: str, limit: int, request_uid: str) -> int:
        # TODO: This should fail open
        cur_time = time()
        p = self.client.pipeline()
        p.zremrangebyscore(key, "-inf", cur_time - self.max_ttl_seconds)

        # TODO: do this using a redis lua script to keep things atomic
        p.zcard(key)
        currently_executing_calls = p.execute()[1]

        if currently_executing_calls >= limit:
            return limit
        else:
            p = self.client.pipeline()
            p.zadd(key, {request_uid: cur_time})
            p.zcard(key)
            return p.execute()[1]

    def get_concurrent_requests(self, key: str):
        return self.client.zcard(key)

    def finish_request(self, key: str, request_uid: str) -> None:
        self.client.zrem(key, request_uid)
