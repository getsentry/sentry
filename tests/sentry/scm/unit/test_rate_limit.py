from collections.abc import Callable

import pytest

from sentry.scm.private.rate_limit import DynamicRateLimiter


class MockRateLimitProvider:
    def __init__(self, get_and_set_return: tuple[int | None, int], accounted_usage: int = 0):
        self._get_and_set_return = get_and_set_return
        self._accounted_usage = accounted_usage
        self.accounted_keys: list[str] = []
        self.set_kvs: dict = {}

    def get_and_set_rate_limit(self, total_key, usage_key, expiration):
        return self._get_and_set_return

    def get_accounted_usage(self, keys):
        self.accounted_keys.extend(keys)
        return self._accounted_usage

    def set_key_values(self, kvs):
        self.set_kvs.update(kvs)


def make_limiter(
    get_and_set_return: tuple[int | None, int] = (None, 0),
    accounted_usage: int = 0,
    referrer_allocation: dict | None = None,
    recorded_capacity: int | None = None,
    get_time_in_seconds: Callable[[], int] = lambda: 73,
) -> tuple[DynamicRateLimiter, MockRateLimitProvider]:
    provider = MockRateLimitProvider(get_and_set_return, accounted_usage)
    limiter = DynamicRateLimiter(
        get_time_in_seconds=get_time_in_seconds,
        integration_id=1,
        provider="github",
        rate_limit_provider=provider,
        rate_limit_window_seconds=3600,
        referrer_allocation=referrer_allocation or {},
        recorded_capacity=recorded_capacity,
    )
    return limiter, provider


class TestIsRateLimited:
    def test_allocated_referrer_with_excess_quota(self) -> None:
        """Referrer with remaining quota is not rate limited."""
        limiter, _ = make_limiter(
            get_and_set_return=(100, 10),
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("my_referrer") is False

    def test_allocated_referrer_exhausted_quota(self) -> None:
        """Referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(
            get_and_set_return=(10, 10),
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("my_referrer") is True

    def test_shared_referrer_with_excess_quota(self) -> None:
        """Shared referrer with remaining quota is not rate limited."""
        limiter, _ = make_limiter(get_and_set_return=(100, 10))
        assert limiter.is_rate_limited("shared") is False

    def test_shared_referrer_exhausted_quota(self) -> None:
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(get_and_set_return=(10, 10))
        assert limiter.is_rate_limited("shared") is True

    def test_unregistered_referrer_raises(self) -> None:
        """A referrer not in the allocation pool must not be passed."""
        limiter, _ = make_limiter(get_and_set_return=(10, 10))
        with pytest.raises(AssertionError):
            limiter.is_rate_limited("other")

    def test_fails_open_when_limit_not_set(self) -> None:
        """Rate limit fails open if no limit is cached."""
        limiter, _ = make_limiter(
            get_and_set_return=(None, 100_000_000),
            referrer_allocation={"my_referrer": 0.000000001},
        )
        assert limiter.is_rate_limited("my_referrer") is False

    def test_caches_recorded_capacity_after_check(self) -> None:
        """is_rate_limited stores the service capacity on the instance."""
        limiter, _ = make_limiter(get_and_set_return=(500, 1))
        limiter.is_rate_limited("shared")
        assert limiter.recorded_capacity == 500

    def test_fully_reserved_quota(self) -> None:
        """Assert fully allocated referrer pool exhausts shared referrer by default."""
        limiter, _ = make_limiter(
            get_and_set_return=(100, 10),
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("shared") is True
