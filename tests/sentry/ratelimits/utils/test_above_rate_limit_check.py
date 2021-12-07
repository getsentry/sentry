from unittest import TestCase

from sentry.ratelimits import above_rate_limit_check
from sentry.types.ratelimit import RateLimit


class RatelimitMiddlewareTest(TestCase):
    def test_above_rate_limit_check(self):
        return_val = above_rate_limit_check("foo", RateLimit(10, 100))
        assert return_val == dict(is_limited=False, current=1, limit=10, window=100)
