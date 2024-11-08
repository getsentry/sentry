from typing import Any, Never
from unittest import mock

import pytest

from sentry.exceptions import InvalidConfiguration
from sentry.ratelimits.leaky_bucket import LeakyBucketLimitInfo, LeakyBucketRateLimiter
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class LeakyBucketRateLimiterTest(TestCase):
    def setUp(self) -> None:
        self.limiter = LeakyBucketRateLimiter(burst_limit=5, drip_rate=2)

    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog: pytest.LogCaptureFixture) -> None:
        self._caplog = caplog

    def test_basic(self) -> None:
        with freeze_time("2077-09-13"):
            # burst limit is 5, so we should be able to get 5 requests in
            for _ in range(5):
                assert not self.limiter.is_limited("foo")
            # after 5 requests, we should be limited
            assert self.limiter.is_limited("foo")

            # subsequent requests should still be limited
            for _ in range(3):
                assert self.limiter.is_limited("foo")

    def test_incr_by(self) -> None:
        with freeze_time("2077-09-13"):
            assert not self.limiter.is_limited("foo", incr_by=3)
            assert self.limiter.is_limited("foo", incr_by=3)
            assert not self.limiter.is_limited("foo", incr_by=2)
            assert self.limiter.is_limited("foo")

    def test_invalid_incr_by(self) -> None:
        with pytest.raises(ValueError) as ex:
            self.limiter.is_limited("foo", incr_by=0)
            assert ex.value.args[0] == "incr_by must be an integer greater than 0"

        with pytest.raises(ValueError) as ex:
            self.limiter.is_limited("foo", incr_by="foo")  # type: ignore[arg-type]
            assert ex.value.args[0] == "incr_by must be an integer greater than 0"

    def test_default_key(self) -> None:
        limiter = LeakyBucketRateLimiter(burst_limit=5, drip_rate=2, key="my_default_key")

        assert limiter._redis_key() == "leaky_bucket_limiter:my_default_key"
        assert limiter._redis_key("foo") == "leaky_bucket_limiter:foo"

        with mock.patch.object(limiter, "_redis_key", wraps=limiter._redis_key) as _redis_key_spy:
            limiter.is_limited()
            limiter.is_limited("foo")

            assert _redis_key_spy.call_args_list == [
                mock.call(None),
                mock.call("foo"),
            ]

    def test_key_required(self) -> None:
        with pytest.raises(ValueError):
            self.limiter.is_limited()
            assert "Either key or default_key must be set" in self._caplog.text

    def test_drip_rate(self) -> None:
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

    def test_decorator(self) -> None:
        @self.limiter("foo")
        def foo() -> Never:
            assert False, "This should not be executed when limited"

        with freeze_time("2077-09-13"):
            for _ in range(5):
                with pytest.raises(AssertionError):
                    foo()

            assert foo() is None

        @self.limiter("bar", raise_exception=True)
        def bar() -> Never:
            assert False, "This should not be executed when limited"

        with freeze_time("2077-09-13"):
            for _ in range(5):
                with pytest.raises(AssertionError):
                    bar()

            with pytest.raises(self.limiter.LimitExceeded):
                bar()

        last_info: list[LeakyBucketLimitInfo] = []

        def callback(info: LeakyBucketLimitInfo, context: dict[str, Any]) -> str:
            last_info.append(info)
            return "rate limited"

        @self.limiter("baz", limited_handler=callback)
        def baz() -> str:
            return "normal value"

        with freeze_time("2077-09-13"):
            for i in range(5):
                assert baz() == "normal value"
                assert len(last_info) == 0

            baz_rv = baz()
            assert baz_rv == "rate limited"
            assert len(last_info) == 1
            info = last_info[0]
            assert info.wait_time > 0
            assert info.current_level == 5

    def test_decorator_default_key(self) -> None:
        limiter = LeakyBucketRateLimiter(burst_limit=5, drip_rate=2)

        with mock.patch.object(limiter, "_redis_key", wraps=limiter._redis_key) as _redis_key_spy:

            @limiter()
            def foo() -> Any:
                pass

            foo()

            assert _redis_key_spy.call_args_list == [
                mock.call("LeakyBucketRateLimiterTest.test_decorator_default_key.<locals>.foo")
            ]

    def test_get_bucket_state(self) -> None:
        with freeze_time("2077-09-13"):

            info = self.limiter.get_bucket_state("foo")
            assert info.current_level == 0.0
            assert info.wait_time == 0.0

            for i in range(1, 6):
                self.limiter.is_limited("foo")
                info = self.limiter.get_bucket_state("foo")
                assert info.current_level == i

    def test_redis_failures(self) -> None:
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

    def test_validate(self) -> None:
        self.limiter.validate()

        with mock.patch.object(self.limiter, "client") as redis_client:
            redis_client.ping.side_effect = Exception("Boom")
            with pytest.raises(InvalidConfiguration):
                self.limiter.validate()
