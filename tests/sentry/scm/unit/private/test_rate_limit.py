from typing import Callable

import pytest

from sentry.scm.private.rate_limit import (
    DynamicRateLimiter,
    total_limit_key,
    usage_count_key,
)


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
        organization_id=1,
        provider="github",
        rate_limit_provider=provider,
        rate_limit_window_seconds=3600,
        referrer_allocation=referrer_allocation or {},
        recorded_capacity=recorded_capacity,
    )
    return limiter, provider


class TestIsRateLimited:
    def test_allocated_referrer_with_excess_quota(self):
        """Referrer with remaining quota is not rate limited."""
        limiter, _ = make_limiter(
            get_and_set_return=(100, 10),
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("my_referrer") is False

    def test_allocated_referrer_exhausted_quota(self):
        """Referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(
            get_and_set_return=(10, 10),
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("my_referrer") is True

    def test_shared_referrer_with_excess_quota(self):
        """Shared referrer with remaining quota is not rate limited."""
        limiter, _ = make_limiter(get_and_set_return=(100, 10))
        assert limiter.is_rate_limited("shared") is False

    def test_shared_referrer_exhausted_quota(self):
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(get_and_set_return=(10, 10))
        assert limiter.is_rate_limited("shared") is True

    def test_unregistered_referrer_raises(self):
        """A referrer not in the allocation pool must not be passed."""
        limiter, _ = make_limiter(get_and_set_return=(10, 10))
        with pytest.raises(AssertionError):
            limiter.is_rate_limited("other")

    def test_fails_open_when_limit_not_set(self):
        """Rate limit fails open if no limit is cached."""
        limiter, _ = make_limiter(
            get_and_set_return=(None, 100_000_000),
            referrer_allocation={"my_referrer": 0.000000001},
        )
        assert limiter.is_rate_limited("my_referrer") is False

    def test_caches_recorded_capacity_after_check(self):
        """is_rate_limited stores the service capacity on the instance."""
        limiter, _ = make_limiter(get_and_set_return=(500, 1))
        limiter.is_rate_limited("shared")
        assert limiter.recorded_capacity == 500

    def test_fully_reserved_quota(self):
        """Assert fully allocated referrer pool exhausts shared referrer by default."""
        limiter, _ = make_limiter(
            get_and_set_return=(100, 10),
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("shared") is True


class TestUpdateRateLimitMeta:
    def test_updates_limit_and_shared_usage(self):
        """Limit and shared usage are written when provider reports new values."""
        limiter, provider = make_limiter(
            accounted_usage=40,
            recorded_capacity=100,
            referrer_allocation={"a": 0.05, "b": 0.01},
        )
        limiter.update_rate_limit_meta(capacity=110, consumed=50, next_window_start=3601)

        assert provider.accounted_keys == [
            usage_count_key("github", 1, 0, "a"),
            usage_count_key("github", 1, 0, "b"),
        ], provider.accounted_keys
        assert provider.set_kvs == {
            # Sentry said our limit was 100 but GitHub says its 110. GitHub wins.
            total_limit_key("github", 1): (110, None),
            # GitHub said 50 used but we recorded 40. Shared pool usage is set to reflect.
            usage_count_key("github", 1, 0, "shared"): (10, 3527),
        }, provider.set_kvs

    def test_accounted_keys_include_all_allocated_referrers(self):
        """get_accounted_usage is called with all allocated referrer keys."""
        limiter, provider = make_limiter(
            accounted_usage=40,
            recorded_capacity=100,
        )
        limiter.update_rate_limit_meta(capacity=110, consumed=50, next_window_start=3601)

        # No referrer allocation so not keys were looked up.
        assert provider.accounted_keys == []

        assert provider.set_kvs == {
            # Sentry said our limit was 100 but GitHub says its 110. GitHub wins.
            total_limit_key("github", 1): (110, None),
            # GitHub said 50 used but we recorded 40. Shared pool usage is set to reflect.
            usage_count_key("github", 1, 0, "shared"): (10, 3527),
        }, provider.set_kvs

    def test_shared_usage_floored_at_zero(self):
        """Shared usage is never negative when accounted exceeds reported."""
        limiter, provider = make_limiter(accounted_usage=100, recorded_capacity=100)
        limiter.update_rate_limit_meta(capacity=110, consumed=50, next_window_start=3601)

        assert provider.set_kvs[usage_count_key("github", 1, 0, "shared")] == (0, 3527)

    def test_window_miss_skips_shared_usage_update(self):
        """Shared usage is not written when provider window does not match."""
        limiter, provider = make_limiter(recorded_capacity=100)
        limiter.update_rate_limit_meta(capacity=110, consumed=50, next_window_start=0)

        # Only the new capacity value was written.
        assert provider.set_kvs == {total_limit_key("github", 1): (110, None)}

    def test_matching_limits_skips_total_key_write(self):
        """Capacity key is not written when recorded and specified capacities match."""
        limiter, provider = make_limiter(recorded_capacity=110, accounted_usage=0)
        limiter.update_rate_limit_meta(capacity=110, consumed=50, next_window_start=3601)

        # Service limit not overwritten.
        assert provider.set_kvs == {usage_count_key("github", 1, 0, "shared"): (50, 3527)}

    def test_matching_limits_and_window_miss_writes_nothing(self):
        """No writes when capacities match and windows differ."""
        limiter, provider = make_limiter(accounted_usage=50, recorded_capacity=110)
        limiter.update_rate_limit_meta(capacity=110, consumed=50, next_window_start=0)

        # No values written.
        assert provider.set_kvs == {}
