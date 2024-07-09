from __future__ import annotations

import logging
from collections.abc import Callable, Generator
from contextlib import contextmanager
from dataclasses import dataclass
from time import time
from typing import Any, ContextManager

from django.conf import settings

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis

logger = logging.getLogger(__name__)


leaky_bucket_info = redis.load_redis_script("ratelimits/leaky_bucket.lua")


@dataclass
class LeakyBucketLimitInfo:
    burst_limit: int  # maximum number of requests allowed in a burst
    drip_rate: int  # number of requests allowed per second
    last_drip: float = 0  # unix timestamp of the last drip
    current_level: float = 0  # current level of the bucket
    wait_time: float = 0  # seconds to wait until next request is allowed


class LeakyBucketRateLimiter:
    NAMESPACE = "leaky_bucket_limiter"

    class LimitExceeded(Exception):
        def __init__(self, info: LeakyBucketLimitInfo) -> None:
            self.info = info

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
            bucket_size, drip_rate, last_drip, current_level, wait_time = leaky_bucket_info(
                [redis_key],
                [self.burst_limit, self.drip_rate, timestamp],
                client=self.client,
            )
            last_drip = float(last_drip)
            current_level = float(current_level)
            wait_time = float(wait_time)
            info = LeakyBucketLimitInfo(bucket_size, drip_rate, last_drip, current_level, wait_time)
            # print(f"{timestamp=} {info=}")
            return info
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
                lambda x: float(x or 0),
                self.client.hmget(
                    self.redis_key(key),
                    ["last_drip", "current_level"],
                ),
            )
        except Exception:
            logger.exception("Could not get bucket state", dict(key=self.redis_key))
            return LeakyBucketLimitInfo(self.burst_limit, self.drip_rate)

        return LeakyBucketLimitInfo(
            self.burst_limit,
            self.drip_rate,
            last_drip,
            current_level,
            max(0, (current_level - self.burst_limit) / self.drip_rate),
        )

    def context(self, key: str) -> ContextManager[LeakyBucketLimitInfo]:
        """
        Context manager to limit the rate of requests to a given key

        Usage:

            - basic usage:
            ```
            limiter = LeakyBucketRateLimiter(burst_limit=10, drip_rate=1)

            try:
                with limiter.context(key):
                    value = do_something()
            except LeakyBucketRateLimiter.LimitExceeded as e:
                print(f"Rate limited, needs to wait for {e.wait_time} seconds")

            ```

            - checking info even if not limited:
            ```
            try:
                with limiter.context(key) as limiter_info:
                    value = do_something()
            except LeakyBucketRateLimiter.LimitExceeded as e:
                limiter_info = e.info
            ```z
        """

        @contextmanager
        def limit_context() -> Generator[LeakyBucketLimitInfo, None, None]:
            info = self.use_and_get_info(key)
            if info.wait_time:
                raise self.LimitExceeded(info)

            yield info

        return limit_context()

    def __call__(
        self,
        key: str,
        limited_handler: Callable[[LeakyBucketLimitInfo, dict[str, Any]], Any] | None = None,
        raise_exception: bool = False,
    ) -> Callable[[Any], Any]:
        """
        Decorator to limit the rate of requests on a given key

        limited_handler: a callback function that will be called when the rate limit is exceeded,
                            it will receive the LeakyBucketLimitInfo instance as an argument,
                            as well as original args and kwargs in a dictionary
                        return value will be returned as the result of the decorated function

        raise_exception: if True, LeakyBucketRateLimiter.LimitExceeded will be raised when the rate limit is exceeded


        if both limited_callback and raise_exception are provided, limited_callback will take precedence
        if neither limited_callback nor raise_exception is provided, the decorated function will silently
        be ignored when the rate limit is exceeded



        usage:

            - basic usage:
            ```
            limiter = LeakyBucketRateLimiter(burst_limit=10, drip_rate=1)

            @limiter(key)
            def my_function():
                do_something()
            ```

            - raising an exception when limited:
            ```
            try:
                @limiter(key, raise_exception=True)
                def my_function():
                    do_something()
            except LeakyBucketRateLimiter.LimitExceeded as e:
                print("Rate limited, needs to wait for {e.wait_time} seconds")
            ```

            - providing a handler function:
            ```
            def my_limited_handler(info, context):
                print(f"Rate limited, needs to wait for {info.wait_time} seconds")
                print(f"Original args: {context['args']}")
                print(f"Original kwargs: {context['kwargs']}")
                return None

            @limiter(key, limited_handler=my_limited_handler)
            def my_function():
                rv = do_something()
            ```

        """

        def decorator(func):
            def wrapper(*args, **kwargs):
                try:
                    with self.context(key):
                        return func(*args, **kwargs)
                except self.LimitExceeded as e:
                    if limited_handler:
                        return limited_handler(e.info, {"args": args, "kwargs": kwargs})
                    if raise_exception:
                        raise

            return wrapper

        return decorator
