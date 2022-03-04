from freezegun import freeze_time

from sentry.ratelimits.concurrent import ConcurrentRateLimiter
from sentry.testutils import TestCase


class ConcurrentLimiterTest(TestCase):
    def setUp(self):
        self.backend = ConcurrentRateLimiter()

    def test_add_and_remove(self):
        limit = 8
        with freeze_time("2000-01-01"):
            for i in range(1, limit + 1):
                assert self.backend.start_request("foo", limit, f"request_id{i}") == i
            assert self.backend.start_request("foo", limit, "request_id_12") == limit

            for i in range(10):
                # limit exceeded
                assert self.backend.get_concurrent_requests("foo") == 8
            self.backend.finish_request("foo", "request_id1")
            assert self.backend.get_concurrent_requests("foo") == 7
