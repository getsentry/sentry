from time import time

from freezegun import freeze_time

from sentry.ratelimits.redis import RedisRateLimiter
from sentry.ratelimits.concurrent import ConcurrentRateLimiter
from sentry.testutils import TestCase


class RedisRateLimiterTest(TestCase):
    def setUp(self):
        self.backend = ConcurrentRateLimiter()

    def test_project_key(self):
        with freeze_time("2000-01-01"):
            assert not self.backend.is_limited("foo", 1, self.project)
            assert self.backend.is_limited("foo", 1, self.project)

    def test_simple_key(self):
        with freeze_time("2000-01-01"):
            assert not self.backend.is_limited("foo", 1)
            assert self.backend.is_limited("foo", 1)

    def test_correct_current_value(self):
        """Ensure that current_value get the correct value after the counter in incremented"""

        with freeze_time("2000-01-01"):
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
        with freeze_time("2000-01-01") as frozen_time:
            for _ in range(10):
                self.backend.is_limited("foo", 1, window=10)
            assert self.backend.current_value("foo", window=10) == 10

            frozen_time.tick(10)
            assert self.backend.current_value("foo", window=10) == 0

    def test_is_limited_with_value(self):
        with freeze_time("2000-01-01") as frozen_time:
            expected_reset_time = int(time() + 5)

            limited, value, reset_time = self.backend.is_limited_with_value("foo", 1, window=5)
            assert not limited
            assert value == 1
            assert reset_time == expected_reset_time

            limited, value, reset_time = self.backend.is_limited_with_value("foo", 1, window=5)
            assert limited
            assert value == 2
            assert reset_time == expected_reset_time

            frozen_time.tick(5)
            limited, value, reset_time = self.backend.is_limited_with_value("foo", 1, window=5)
            assert not limited
            assert value == 1
            assert reset_time == expected_reset_time + 5
