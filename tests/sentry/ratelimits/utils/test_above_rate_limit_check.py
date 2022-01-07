from time import time
from unittest import TestCase

from freezegun import freeze_time

from sentry.ratelimits import above_rate_limit_check
from sentry.types.ratelimit import RateLimit, RateLimitMeta


class RatelimitMiddlewareTest(TestCase):
    def test_above_rate_limit_check(self):
        with freeze_time("2000-01-01"):
            expected_reset_time = int(time() + 100)
            return_val = above_rate_limit_check("foo", RateLimit(10, 100))
            assert return_val == RateLimitMeta(
                is_limited=False, current=1, limit=10, window=100, reset_time=expected_reset_time
            )
