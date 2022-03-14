from datetime import datetime, timedelta

from freezegun import freeze_time

from sentry.ratelimits.concurrent import DEFAULT_MAX_TTL_SECONDS, ConcurrentRateLimiter
from sentry.testutils import TestCase


class ConcurrentLimiterTest(TestCase):
    def setUp(self):
        self.backend = ConcurrentRateLimiter()

    def test_add_and_remove(self):
        limit = 8
        with freeze_time("2000-01-01"):
            for i in range(1, limit + 1):
                assert (
                    self.backend.start_request("foo", limit, f"request_id{i}").current_executions
                    == i
                )

            info = self.backend.start_request("foo", limit, "request_id_12")
            assert info.current_executions == limit
            assert info.limit_exceeded

            # limit exceeded
            assert self.backend.get_concurrent_requests("foo") == limit
            self.backend.finish_request("foo", "request_id1")
            assert self.backend.get_concurrent_requests("foo") == limit - 1

    def test_fails_open(self):
        class FakeClient:
            def __init__(self, real_client):
                self._client = real_client

            def __getattr__(self, name):
                return getattr(self._client, name)

            def pipeline(self):
                return self

            def execute(self):
                # TODO: When the script changes to lua,
                # make this fail differently
                raise Exception("OH NO")

        limiter = ConcurrentRateLimiter()
        limiter.client = FakeClient(limiter.client)
        limiter.start_request("key", 100, "some_uid")
        limiter.finish_request("key", "some_uid")

    def test_cleanup_stale(self):
        limit = 10
        num_stale = 5
        request_date = datetime(2000, 1, 1)
        with freeze_time(request_date):
            for i in range(1, num_stale + 1):
                assert (
                    self.backend.start_request("foo", limit, f"request_id{i}").current_executions
                    == i
                )
            assert self.backend.get_concurrent_requests("foo") == num_stale
        with freeze_time(request_date + timedelta(seconds=DEFAULT_MAX_TTL_SECONDS + 1)):
            # the old requests did not finish however they are past their TTL and therefore
            # are irrelevant
            assert (
                self.backend.start_request("foo", limit, "updated_request").current_executions == 1
            )
