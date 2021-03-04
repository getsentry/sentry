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
