from time import time
from unittest import TestCase

from freezegun import freeze_time

from sentry.ratelimits import above_rate_limit_check
from sentry.types.ratelimit import RateLimit, RateLimitMeta, RateLimitType


class RatelimitMiddlewareTest(TestCase):
    def test_above_rate_limit_check(self):
        with freeze_time("2000-01-01"):
            expected_reset_time = int(time() + 100)
            return_val = above_rate_limit_check("foo", RateLimit(10, 100), "request_uid")
            assert return_val == RateLimitMeta(
                rate_limit_type=RateLimitType.NOT_LIMITED,
                current=1,
                limit=10,
                window=100,
                reset_time=expected_reset_time,
                remaining=9,
                concurrent_limit=None,
                concurrent_requests=None,
            )
            for i in range(10):
                return_val = above_rate_limit_check("foo", RateLimit(10, 100), f"request_uid{i}")
            assert return_val == RateLimitMeta(
                rate_limit_type=RateLimitType.FIXED_WINDOW,
                current=11,
                limit=10,
                window=100,
                reset_time=expected_reset_time,
                remaining=0,
                concurrent_limit=None,
                concurrent_requests=None,
            )
