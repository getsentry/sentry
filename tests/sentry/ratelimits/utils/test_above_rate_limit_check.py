import uuid
from concurrent.futures import ThreadPoolExecutor
from time import sleep, time
from unittest import TestCase

from django.conf import settings

from sentry.ratelimits import above_rate_limit_check, finish_request
from sentry.ratelimits.config import RateLimitConfig
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.ratelimit import RateLimit, RateLimitMeta, RateLimitType


class RatelimitMiddlewareTest(TestCase):
    group = RateLimitConfig().group

    def test_above_rate_limit_check(self):
        with freeze_time("2000-01-01"):
            expected_reset_time = int(time() + 100)
            return_val = above_rate_limit_check(
                "foo", RateLimit(10, 100), "request_uid", self.group
            )
            assert return_val == RateLimitMeta(
                rate_limit_type=RateLimitType.NOT_LIMITED,
                current=1,
                limit=10,
                window=100,
                group=self.group,
                reset_time=expected_reset_time,
                remaining=9,
                concurrent_limit=settings.SENTRY_CONCURRENT_RATE_LIMIT_DEFAULT,
                concurrent_requests=1,
            )
            for i in range(10):
                return_val = above_rate_limit_check(
                    "foo", RateLimit(10, 100), f"request_uid{i}", self.group
                )
            assert return_val == RateLimitMeta(
                rate_limit_type=RateLimitType.FIXED_WINDOW,
                current=11,
                limit=10,
                window=100,
                group=self.group,
                reset_time=expected_reset_time,
                remaining=0,
                concurrent_limit=settings.SENTRY_CONCURRENT_RATE_LIMIT_DEFAULT,
                concurrent_requests=None,
            )

            for i in range(10):
                return_val = above_rate_limit_check(
                    "bar", RateLimit(120, 100, 9), f"request_uid{i}", self.group
                )
            assert return_val == RateLimitMeta(
                rate_limit_type=RateLimitType.CONCURRENT,
                current=10,
                limit=120,
                window=100,
                group=self.group,
                reset_time=expected_reset_time,
                remaining=110,
                concurrent_limit=9,
                concurrent_requests=9,
            )

    def test_concurrent(self):
        def do_request():
            uid = uuid.uuid4().hex
            meta = above_rate_limit_check("foo", RateLimit(10, 1, 3), uid, self.group)
            sleep(0.2)
            finish_request("foo", uid)
            return meta

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            for _ in range(4):
                futures.append(executor.submit(do_request))
            results = []
            for f in futures:
                results.append(f.result())
            assert len([r for r in results if r.concurrent_remaining == 0]) == 2

    def test_window_and_concurrent_limit(self):
        """Test that if there is a window limit and a concurrent limit, the
        FIXED_WINDOW limit takes precedence"""
        return_val = above_rate_limit_check("xar", RateLimit(0, 100, 0), "request_uid", self.group)
        assert return_val.rate_limit_type == RateLimitType.FIXED_WINDOW
        assert return_val.concurrent_remaining is None
