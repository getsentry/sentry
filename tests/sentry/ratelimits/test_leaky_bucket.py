from unittest import mock

import pytest

from sentry.exceptions import InvalidConfiguration
from sentry.ratelimits.leaky_bucket import LeakyBucketRateLimiter
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class LeakyBucketRateLimiterTest(TestCase):
    def setUp(self):
        self.limiter = LeakyBucketRateLimiter(burst_limit=5, drip_rate=2)

    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog):
        self._caplog = caplog

    def test_basic(self):
        with freeze_time("2077-09-13"):
            # burst limit is 5, so we should be able to get 5 requests in
            for _ in range(5):
                assert not self.limiter.is_limited("foo")
            # after 5 requests, we should be limited
            assert self.limiter.is_limited("foo")

            # subsequent requests should still be limited
            for _ in range(3):
                assert self.limiter.is_limited("foo")

    def test_drip_rate(self):
        with freeze_time("2077-09-13") as time_traveler:
            # exhaust the burst limit
            for _ in range(5):
                self.limiter.is_limited("foo")

            for i in range(1, 11):
                time_traveler.shift(0.1)
                if i % 5:  # at 10 reqs/sec, every 5th request should be allowed
                    assert self.limiter.is_limited("foo")
                else:
                    assert not self.limiter.is_limited("foo")

    def test_context_manager(self):
        with freeze_time("2077-09-13"):
            with self.limiter.context("foo") as info:
                assert info.current_level == 0.0
                assert info.wait_time == 0.0

            # exhaust the burst limit
            for _ in range(5):
                self.limiter.is_limited("foo")

            try:
                with self.limiter.context("foo") as info:
                    assert False, "This should not be executed"
            except self.limiter.LimitExceeded as e:
                info = e.info
                assert info.current_level == 5
                assert info.wait_time != 0

    def test_decorator(self):
        @self.limiter("foo")
        def foo() -> None:
            assert False, "This should not be executed when limited"

        with freeze_time("2077-09-13"):
            for _ in range(5):
                with pytest.raises(AssertionError):
                    foo()

            assert foo() is None

        @self.limiter("bar", raise_exception=True)
        def bar() -> None:
            assert False, "This should not be executed when limited"

        with freeze_time("2077-09-13"):
            for _ in range(5):
                with pytest.raises(AssertionError):
                    bar()

            with pytest.raises(self.limiter.LimitExceeded):
                bar()

        last_info = []

        def callback(info, context):
            last_info.append(info)
            return info

        @self.limiter("baz", limited_handler=callback)
        def baz() -> bool:
            return True

        with freeze_time("2077-09-13"):
            for i in range(5):
                assert baz() is True
                assert len(last_info) == 0

            info = baz()
            assert info
            assert len(last_info) == 1
            assert last_info[0] == info
            assert info.wait_time > 0
            assert info.current_level == 5

    def test_get_bucket_state(self):
        with freeze_time("2077-09-13"):

            info = self.limiter.get_bucket_state("foo")
            assert info.current_level == 0.0
            assert info.wait_time == 0.0

            for i in range(1, 6):
                self.limiter.is_limited("foo")
                info = self.limiter.get_bucket_state("foo")
                assert info.current_level == i

    def test_redis_failures(self):
        caplog = self._caplog

        with mock.patch("sentry.ratelimits.leaky_bucket.leaky_bucket_info") as lua_script:
            lua_script.side_effect = Exception("Boom")

            # fails open
            for _ in range(6):
                caplog.clear()
                assert not self.limiter.is_limited("foo")
                assert "Could not determine leaky bucket limiter state" in caplog.text

        with mock.patch.object(self.limiter, "client") as redis_client:
            redis_client.side_effect = Exception("Boom")

            caplog.clear()
            info = self.limiter.get_bucket_state("foo")
            assert info.current_level == 0
            assert "Could not get bucket state" in caplog.text

    def test_validate(self):
        assert self.limiter.validate() is None

        with mock.patch.object(self.limiter, "client") as redis_client:
            redis_client.ping.side_effect = Exception("Boom")
            with pytest.raises(InvalidConfiguration):
                self.limiter.validate()
