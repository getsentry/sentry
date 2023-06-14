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

rate_limit_info = redis.load_script("ratelimits/api_limiter.lua")


@dataclass
class ConcurrentLimitInfo:
    limit: int
    current_executions: int
    limit_exceeded: bool


class ConcurrentRateLimiter:
    def __init__(self, max_tll_seconds: int = DEFAULT_MAX_TTL_SECONDS) -> None:
        cluster_key = settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER
        self.client = redis.redis_clusters.get(cluster_key)
        self.max_ttl_seconds = max_tll_seconds

    def validate(self) -> None:
        try:
            self.client.ping()
            self.client.connection_pool.disconnect()
        except Exception as e:
            raise InvalidConfiguration(str(e))

    def namespaced_key(self, key: str) -> str:
        return f"concurrent_limit:{key}"

    def start_request(self, key: str, limit: int, request_uid: str) -> ConcurrentLimitInfo:
        redis_key = self.namespaced_key(key)
        current_executions, request_allowed, cleaned_up_requests = (-1, True, 0)
        try:
            current_executions, request_allowed, cleaned_up_requests = rate_limit_info(
                self.client, [redis_key], [limit, request_uid, time(), self.max_ttl_seconds]
            )
        except Exception:
            logger.exception(
                "Could not start request", dict(key=redis_key, limit=limit, request_uid=request_uid)
            )
            return ConcurrentLimitInfo(limit, -1, False)
        if cleaned_up_requests != 0:
            logger.info(
                "Cleaned up concurrent executions: %s",
                cleaned_up_requests,
                extra={
                    "cleaned_up_requests": cleaned_up_requests,
                    "key": key,
                    "limit": limit,
                    "request_uid": request_uid,
                },
            )
        return ConcurrentLimitInfo(limit, int(current_executions), not bool(request_allowed))

    def get_concurrent_requests(self, key: str) -> int:
        redis_key = self.namespaced_key(key)
        # this can fail loudly as it is only meant for observability
        num_elements = self.client.zcard(redis_key)
        return int(num_elements) if num_elements is not None else -1

    def finish_request(self, key: str, request_uid: str) -> None:
        try:
            self.client.zrem(self.namespaced_key(key), request_uid)
        except Exception:
            logger.exception("Could not finish request", dict(key=key, request_uid=request_uid))
