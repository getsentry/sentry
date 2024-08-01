from __future__ import annotations

import functools
import logging
from collections.abc import Callable
from dataclasses import dataclass
from time import time
from typing import Any, ParamSpec, TypeVar

from django.conf import settings

from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis

P = ParamSpec("P")
R = TypeVar("R")

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

    def __init__(self, burst_limit: int, drip_rate: int, key: str | None = None) -> None:
        cluster_key = settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER
        self.client = redis.redis_clusters.get(cluster_key)
        self.burst_limit = burst_limit
        self.drip_rate = drip_rate
        self.default_key = key

    def _redis_key(self, key: str | None = None) -> str:
        key = key or self.default_key
        if not key:
            raise ValueError("Either key or default_key must be set")
        return f"{self.NAMESPACE}:{key}"

    def validate(self) -> None:
        try:
            self.client.ping()
            self.client.connection_pool.disconnect()
        except Exception as e:
            raise InvalidConfiguration(str(e))

    def use_and_get_info(
        self,
        key: str | None = None,
        timestamp: float | None = None,
        incr_by: int = 1,
    ) -> LeakyBucketLimitInfo:
        """
        Consumes a request from the bucket and returns the current state of the bucket.

        The state of the bucket changes if and only if the request is not limited.
        """

        try:
            incr_by = int(incr_by)
            # TODO: do we want to support float incr_by? Right now it would just work if we'd cast it to float instead.
            if incr_by <= 0:
                raise ValueError
        except ValueError:
            raise ValueError("incr_by must be an integer greater than 0")

        if timestamp is None:
            timestamp = time()

        redis_key = self._redis_key(key)
        try:
            bucket_size, drip_rate, last_drip, current_level, wait_time = leaky_bucket_info(
                [redis_key],
                [self.burst_limit, self.drip_rate, timestamp, incr_by],
                client=self.client,
            )
            last_drip, current_level, wait_time = (
                float(last_drip),
                float(current_level),
                float(wait_time),
            )
            return LeakyBucketLimitInfo(bucket_size, drip_rate, last_drip, current_level, wait_time)
        except Exception:
            logger.exception(
                "Could not determine leaky bucket limiter state", dict(redis_key=redis_key)
            )
        # fail open
        return LeakyBucketLimitInfo(self.burst_limit, self.drip_rate)

    def is_limited(
        self, key: str | None = None, timestamp: float | None = None, incr_by: int = 1
    ) -> bool:
        return bool(self.use_and_get_info(key, timestamp, incr_by).wait_time)

    def get_bucket_state(self, key: str | None = None) -> LeakyBucketLimitInfo:
        """
        Get the current state of the bucket without consuming any requests.
        """
        try:
            last_drip, current_level = map(
                lambda x: float(x or 0),
                self.client.hmget(
                    self._redis_key(key),
                    ["last_drip", "current_level"],
                ),
            )
        except Exception:
            logger.exception("Could not get bucket state", extra={"key": self._redis_key(key)})
            return LeakyBucketLimitInfo(self.burst_limit, self.drip_rate)

        return LeakyBucketLimitInfo(
            self.burst_limit,
            self.drip_rate,
            last_drip,
            current_level,
            max(0, (current_level - self.burst_limit) / self.drip_rate),
        )

    def decorator(
        self,
        key_override: str | None = None,
        limited_handler: Callable[[LeakyBucketLimitInfo, dict[str, Any]], R] | None = None,
        raise_exception: bool = False,
    ) -> Callable[[Callable[P, R]], Callable[P, R]]:
        """
        Decorator to limit the rate of requests

        key_override: a string that will be used as the key to identify the rate limit,
                      if not provided fully qualified function name will be used

        limited_handler: a callback function that will be called when the rate limit is exceeded,
                            it will receive the LeakyBucketLimitInfo instance as an argument,
                            as well as original args and kwargs in a dictionary
                        return value will be returned as the result of the decorated function

        raise_exception: if True, LeakyBucketRateLimiter.LimitExceeded will be raised when the rate limit is exceeded


        if both limited_callback and raise_exception are provided, limited_callback will take precedence
        if neither limited_callback nor raise_exception is provided, the decorated function will silently
        be ignored when the rate limit is exceeded


        Important limitation: the decorator does not allow passing incr_by, thus falls back to defualt value of 1

        usage:

            - basic usage:
            ```
            limiter = LeakyBucketRateLimiter(burst_limit=10, drip_rate=1)

            @limiter()
            def my_function():
                do_something()
            ```


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

        def decorator(func: Callable[P, R]) -> Callable[P, R]:
            @functools.wraps(func)
            def wrapper(*args: Any, **kwargs: Any) -> Any:
                try:
                    key = key_override or func.__qualname__
                    info = self.use_and_get_info(key)
                    if info.wait_time:
                        raise self.LimitExceeded(info)
                    return func(*args, **kwargs)
                except self.LimitExceeded as e:
                    if limited_handler:
                        return limited_handler(e.info, {"args": args, "kwargs": kwargs})
                    if raise_exception:
                        raise

            return wrapper

        return decorator

    __call__ = decorator
