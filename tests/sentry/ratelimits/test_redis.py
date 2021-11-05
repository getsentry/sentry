import time

from sentry.ratelimits.redis import RedisRateLimiter
from sentry.testutils import TestCase


class RedisRateLimiterTest(TestCase):
    def setUp(self):
        self.backend = RedisRateLimiter()

    def test_project_key(self):
        assert not self.backend.is_limited("foo", 1, self.project)
        assert self.backend.is_limited("foo", 1, self.project)

    def test_simple_key(self):
        assert not self.backend.is_limited("foo", 1)
        assert self.backend.is_limited("foo", 1)

    def test_correct_current_value(self):
        """Ensure that current_value get the correct value after the counter in incremented"""
        for _ in range(10):
            self.backend.is_limited("foo", 100)

        assert self.backend.current_value("foo") == 10
        self.backend.is_limited("foo", 100)
        assert self.backend.current_value("foo") == 11

    def test_current_value_new_key(self):
        """current_value should return 0 for a new key"""

        assert self.backend.current_value("new") == 0

    def test_current_value_expire(self):
        """Ensure that the count resets when the window expires"""
        for _ in range(10):
            self.backend.is_limited("foo", 1, window=1)

        time.sleep(1)
        assert self.backend.current_value("new") == 0

    def test_is_limited_with_value(self):
        limited, value = self.backend.is_limited_with_value("foo", 1)
        assert not limited
        assert value == 1
        limited, value = self.backend.is_limited_with_value("foo", 1)
        assert limited
        assert value == 2
