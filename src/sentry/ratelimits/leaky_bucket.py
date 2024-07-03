from __future__ import annotations

import logging
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass
from time import time
from typing import ContextManager

from django.conf import settings

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis

logger = logging.getLogger(__name__)


leaky_bucket_info = redis.load_redis_script("ratelimits/leaky_bucket.lua")


@dataclass
class LeakyBucketLimitInfo:
    burst_limit: int  # maximum number of requests allowed in a burst
    drip_rate: int  # number of requests allowed per second
    last_drip: float | None = None  # unix timestamp of the last drip
    current_level: float | None = 0.0  # current level of the bucket
    wait_time: float | None = None  # seconds to wait until next request is allowed (if not None)


class LeakyBucketRateLimiter:
    NAMESPACE = "leaky_bucket_limiter"

    class LimitExceeded(Exception):
        pass

    def __init__(self, burst_limit: int, drip_rate: int) -> None:
        cluster_key = settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER
        self.client = redis.redis_clusters.get(cluster_key)
        self.burst_limit = burst_limit
        self.drip_rate = drip_rate

    def redis_key(self, key: str) -> str:
        return f"{self.NAMESPACE}:{key}"

    def validate(self) -> None:
        try:
            self.client.ping()
            self.client.connection_pool.disconnect()
        except Exception as e:
            raise InvalidConfiguration(str(e))

    def use_and_get_info(self, key: str, timestamp: float | None = None) -> LeakyBucketLimitInfo:
        if timestamp is None:
            timestamp = time()

        redis_key = self.redis_key(key)
        try:
            LeakyBucketLimitInfo(
                *leaky_bucket_info(
                    [redis_key],
                    [self.burst_limit, self.drip_rate, timestamp],
                    client=self.client,
                )
            )
        except Exception:
            logger.exception(
                "Could not determine leaky bucket limiter state", dict(redis_key=redis_key)
            )
        # fail open
        return LeakyBucketLimitInfo(self.burst_limit, self.drip_rate)

    def is_limited(self, key: str, timestamp: float | None = None) -> bool:
        return bool(self.use_and_get_info(key, timestamp).wait_time)

    def get_bucket_state(self, key: str) -> LeakyBucketLimitInfo:
        try:
            last_drip, current_level = map(
                lambda x: float(x) if x is not None else x,
                self.client.hmget(
                    self.redis_key(key),
                    ["last_drip", "current_level"],
                ),
            )
            assert current_level is not None
            assert last_drip is not None
        except Exception:
            logger.exception("Could not get bucket state", dict(key=self.redis_key))
            return LeakyBucketLimitInfo(self.burst_limit, self.drip_rate)

        return LeakyBucketLimitInfo(
            self.burst_limit,
            self.drip_rate,
            last_drip,
            current_level,
            max(0, (current_level - self.burst_limit) / self.drip_rate) or None,
        )

    def context(self, key: str) -> ContextManager[LeakyBucketLimitInfo | None]:
        """
        Context manager to limit the rate of requests to a given key

        usage:

        ```
        with limiter.context(key):
            value = do_something()

        ```
        or checking if limited:

        ```
        with limiter.context(key) as is_limited:
            if is_limited:
                return "rate limited"
            value = do_something()

        ```


        """

        @contextmanager
        def limit_context() -> Generator[LeakyBucketLimitInfo | None, None, None]:
            info = self.use_and_get_info(key)
            if not info.wait_time:
                try:
                    yield None
                finally:
                    pass
            else:
                yield info

        return limit_context()
