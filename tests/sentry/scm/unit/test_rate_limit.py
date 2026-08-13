from collections.abc import Callable

from sentry.scm.private.rate_limit import (
    DynamicRateLimiter,
    WindowState,
    decode_window_state,
    encode_window_state,
)


class MockRateLimitProvider:
    def __init__(
        self,
        capacity: int | None = None,
        window: WindowState | None = None,
        usage: int = 0,
        accounted_usage: int = 0,
    ):
        self._capacity = capacity
        self._window = window
        self._usage = usage
        self._accounted_usage = accounted_usage
        self.accounted_keys: list[str] = []
        self.set_kvs: dict = {}
        self.incr_calls: list[tuple[str, int]] = []
        self.window_writes: list[tuple[str, WindowState, int]] = []

    def get_rate_limit_state(self, total_key, window_key):
        return (self._capacity, self._window)

    def incr_usage(self, usage_key, expiration):
        self.incr_calls.append((usage_key, expiration))
        return self._usage

    def set_window_state(self, window_key, state, expiration):
        self.window_writes.append((window_key, state, expiration))

    def get_accounted_usage(self, keys):
        self.accounted_keys.extend(keys)
        return self._accounted_usage

    def set_key_values(self, kvs):
        self.set_kvs.update(kvs)


def make_limiter(
    capacity: int | None = None,
    window: WindowState | None = None,
    usage: int = 0,
    accounted_usage: int = 0,
    referrer_allocation: dict | None = None,
    get_time_in_seconds: Callable[[], int] = lambda: 73,
) -> tuple[DynamicRateLimiter, MockRateLimitProvider]:
    provider = MockRateLimitProvider(capacity, window, usage, accounted_usage)
    limiter = DynamicRateLimiter(
        get_time_in_seconds=get_time_in_seconds,
        integration_id=1,
        provider="github",
        rate_limit_provider=provider,
        rate_limit_window_seconds=3600,
        referrer_allocation=referrer_allocation or {},
    )
    return limiter, provider


class TestIsRateLimited:
    def test_allocated_referrer_with_excess_quota(self) -> None:
        """Referrer with remaining quota is not rate limited."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=10,
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("my_referrer") is False

    def test_allocated_referrer_exhausted_quota(self) -> None:
        """Referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(
            capacity=10,
            usage=11,
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("my_referrer") is True

    def test_shared_referrer_with_excess_quota(self) -> None:
        """Shared referrer with remaining quota is not rate limited."""
        limiter, _ = make_limiter(capacity=100, usage=10)
        assert limiter.is_rate_limited("shared") is False

    def test_shared_referrer_exhausted_quota(self) -> None:
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(capacity=10, usage=11)
        assert limiter.is_rate_limited("shared") is True

    def test_unknown_referrer_exhausted_shared_quota(self) -> None:
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(capacity=10, usage=11)
        assert limiter.is_rate_limited("abc") is True

    def test_fails_open_when_limit_not_set(self) -> None:
        """Rate limit fails open if no limit is cached."""
        limiter, _ = make_limiter(
            capacity=None,
            usage=100_000_000,
            referrer_allocation={"my_referrer": 0.000000001},
        )
        assert limiter.is_rate_limited("my_referrer") is False

    def test_caches_recorded_capacity_after_check(self) -> None:
        """is_rate_limited stores the service capacity on the instance."""
        limiter, _ = make_limiter(capacity=500, usage=1)
        limiter.is_rate_limited("shared")
        assert limiter.recorded_capacity == 500

    def test_fully_reserved_quota(self) -> None:
        """Assert fully allocated referrer pool exhausts shared referrer by default."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=10,
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("shared") is True


class TestReportedUsageReconciliation:
    """
    The provider's reported usage is authoritative for requests it has already answered. Our own
    counter is the only accounting available for requests still in flight, so the greater of the
    two is used.
    """

    def test_reported_usage_raises_the_effective_count(self) -> None:
        """Requests the provider counted but we missed must still be charged."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=10,
            window=WindowState(used=101, reset=4000),
        )
        assert limiter.is_rate_limited("shared") is True

    def test_local_usage_is_kept_when_it_leads(self) -> None:
        """Requests in flight are not yet reflected in the provider's report."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=101,
            window=WindowState(used=1, reset=4000),
        )
        assert limiter.is_rate_limited("shared") is True

    def test_reported_usage_below_capacity_is_not_rate_limited(self) -> None:
        limiter, _ = make_limiter(
            capacity=100,
            usage=10,
            window=WindowState(used=50, reset=4000),
        )
        assert limiter.is_rate_limited("shared") is False

    def test_reported_usage_is_not_applied_to_a_reserved_referrer(self) -> None:
        """
        Reported usage is a total across every referrer, so it says nothing about the consumption
        of a single reserved referrer.
        """
        limiter, _ = make_limiter(
            capacity=1000,
            usage=1,
            window=WindowState(used=900, reset=4000),
            referrer_allocation={"my_referrer": 0.5},
        )
        assert limiter.is_rate_limited("my_referrer") is False

    def test_reserved_usage_is_deducted_from_reported_usage(self) -> None:
        """
        Reported usage includes quota the reserved referrers consumed. Charging it to the shared
        pool as well would exhaust shared long before it really is.
        """
        limiter, _ = make_limiter(
            capacity=100,
            usage=1,
            window=WindowState(used=60, reset=4000),
            accounted_usage=60,
            referrer_allocation={"my_referrer": 0.5},
        )
        assert limiter.is_rate_limited("shared") is False

    def test_reserved_usage_is_read_for_the_current_window(self) -> None:
        limiter, provider = make_limiter(
            capacity=100,
            usage=1,
            window=WindowState(used=10, reset=4000),
            referrer_allocation={"my_referrer": 0.5},
        )
        limiter.is_rate_limited("shared")
        assert provider.accounted_keys == ["rl:scm:github:1:my_referrer:4000"]

    def test_no_reserved_referrers_means_no_extra_reads(self) -> None:
        limiter, provider = make_limiter(
            capacity=100, usage=1, window=WindowState(used=10, reset=4000)
        )
        limiter.is_rate_limited("shared")
        assert provider.accounted_keys == []


class TestWindowEnd:
    """
    The provider's window rarely aligns to our clock. GitHub's resets at a per-installation offset,
    so a locally aligned window carries usage past the provider's reset and overstates consumption
    for the rest of our window.
    """

    def test_uses_the_reported_reset(self) -> None:
        limiter, _ = make_limiter()
        assert limiter.window_end(1000, WindowState(used=5, reset=1500)) == 1500

    def test_falls_back_to_a_local_boundary_without_reported_state(self) -> None:
        limiter, _ = make_limiter()
        assert limiter.window_end(3675, None) == 7200

    def test_falls_back_to_a_local_boundary_for_a_closed_window(self) -> None:
        """A reset in the past tells us nothing about the window we are in now."""
        limiter, _ = make_limiter()
        assert limiter.window_end(3675, WindowState(used=5, reset=100)) == 7200

    def test_clamps_an_implausible_reset(self) -> None:
        """A clock-skewed or nonsensical reset must not pin a counter in place indefinitely."""
        limiter, _ = make_limiter()
        assert limiter.window_end(1000, WindowState(used=5, reset=10**10)) == 1000 + 7200

    def test_fallback_returns_the_end_of_the_current_local_window(self) -> None:
        limiter, _ = make_limiter()
        assert limiter.window_end(0, None) == 3600
        assert limiter.window_end(3599, None) == 3600
        assert limiter.window_end(3600, None) == 7200


class TestUsageKeyBucketing:
    def test_counter_is_bucketed_by_the_reported_reset(self) -> None:
        limiter, provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=4000), get_time_in_seconds=lambda: 3900
        )
        limiter.is_rate_limited("shared")
        usage_key, expiration = provider.incr_calls[0]
        assert usage_key == "rl:scm:github:1:shared:4000"
        assert expiration == 100

    def test_counter_rolls_over_when_the_provider_window_does(self) -> None:
        """
        A counter keyed on the provider's reset starts fresh exactly when the provider forgives the
        previous window's usage, instead of carrying it to a locally computed boundary.
        """
        limiter, provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=4000), get_time_in_seconds=lambda: 3900
        )
        limiter.is_rate_limited("shared")

        rolled_over, rolled_over_provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=7600), get_time_in_seconds=lambda: 4001
        )
        rolled_over.is_rate_limited("shared")

        assert provider.incr_calls[0][0] != rolled_over_provider.incr_calls[0][0]

    def test_counter_ttl_expires_with_the_provider_window(self) -> None:
        limiter, provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=4000), get_time_in_seconds=lambda: 3000
        )
        limiter.is_rate_limited("shared")
        assert provider.incr_calls[0][1] == 1000

    def test_counter_uses_the_local_boundary_without_reported_state(self) -> None:
        limiter, provider = make_limiter(capacity=100, get_time_in_seconds=lambda: 3675)
        limiter.is_rate_limited("shared")
        usage_key, expiration = provider.incr_calls[0]
        assert usage_key == "rl:scm:github:1:shared:7200"
        assert expiration == 3525


class TestSetTotalCapacity:
    def test_writes_capacity_when_no_prior_value(self) -> None:
        """Capacity is written when recorded_capacity is None."""
        limiter, provider = make_limiter()
        limiter.set_total_capacity(5000)
        assert provider.set_kvs == {"limit:scm:github:1": (5000, None)}

    def test_writes_capacity_when_value_differs(self) -> None:
        """Capacity is written when it differs from recorded_capacity."""
        limiter, provider = make_limiter()
        limiter.recorded_capacity = 1000
        limiter.set_total_capacity(5000)
        assert provider.set_kvs == {"limit:scm:github:1": (5000, None)}

    def test_skips_write_when_capacity_matches(self) -> None:
        """No write occurs when capacity matches recorded_capacity."""
        limiter, provider = make_limiter()
        limiter.recorded_capacity = 5000
        limiter.set_total_capacity(5000)
        assert provider.set_kvs == {}

    def test_caches_written_capacity(self) -> None:
        """A repeated write of the same capacity is elided."""
        limiter, provider = make_limiter()
        limiter.set_total_capacity(5000)
        provider.set_kvs.clear()
        limiter.set_total_capacity(5000)
        assert provider.set_kvs == {}


class TestSetWindowState:
    def test_records_reported_usage_and_reset(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=1600)
        assert provider.window_writes == [
            ("window:scm:github:1", WindowState(used=42, reset=1600), 600)
        ]

    def test_ignores_a_window_that_has_already_closed(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=999)
        assert provider.window_writes == []

    def test_ignores_a_reset_at_the_current_instant(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=1000)
        assert provider.window_writes == []

    def test_clamps_the_ttl_of_an_implausible_reset(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=10**10)
        assert provider.window_writes[0][2] == 7200


class TestUpdateRateLimitMeta:
    def test_records_both_capacity_and_window(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.update_rate_limit_meta(capacity=5000, consumed=42, next_window_start=1600)
        assert provider.set_kvs == {"limit:scm:github:1": (5000, None)}
        assert provider.window_writes == [
            ("window:scm:github:1", WindowState(used=42, reset=1600), 600)
        ]


class TestWindowStateCodec:
    def test_round_trips(self) -> None:
        state = WindowState(used=42, reset=1600)
        assert decode_window_state(encode_window_state(state)) == state

    def test_decodes_none(self) -> None:
        assert decode_window_state(None) is None

    def test_decodes_empty_string(self) -> None:
        assert decode_window_state("") is None

    def test_decodes_garbage_as_none(self) -> None:
        assert decode_window_state("not-a-window") is None

    def test_decodes_partial_value_as_none(self) -> None:
        assert decode_window_state("42") is None

    def test_decodes_zero_values(self) -> None:
        assert decode_window_state("0:0") == WindowState(used=0, reset=0)


class StatefulRateLimitProvider:
    """A minimal in-memory stand-in for Redis, so window rollover is actually exercised."""

    def __init__(self, now: Callable[[], int]) -> None:
        self.now = now
        self.capacity: int | None = None
        self.usage: dict[str, tuple[int, int]] = {}
        self.window: tuple[WindowState, int] | None = None

    def _live(self, expires_at: int) -> bool:
        return expires_at > self.now()

    def get_rate_limit_state(self, total_key, window_key):
        window = None
        if self.window is not None and self._live(self.window[1]):
            window = self.window[0]
        return (self.capacity, window)

    def incr_usage(self, usage_key, expiration):
        count, expires_at = self.usage.get(usage_key, (0, 0))
        if not self._live(expires_at):
            count = 0
        count += 1
        self.usage[usage_key] = (count, self.now() + expiration)
        return count

    def set_window_state(self, window_key, state, expiration):
        self.window = (state, self.now() + expiration)

    def get_accounted_usage(self, keys):
        return sum(self.usage.get(key, (0, 0))[0] for key in keys)

    def set_key_values(self, kvs):
        self.capacity = next(iter(kvs.values()))[0]


class TestWindowAlignmentScenario:
    """
    GitHub's window resets at a per-installation offset, not on our hour boundary. A locally
    aligned counter therefore carries usage across GitHub's reset and reports consumption GitHub
    has already forgiven -- producing false positives concentrated at a fixed phase of each hour.
    """

    def test_usage_is_forgiven_when_the_provider_window_resets(self) -> None:
        clock = {"now": 1000}
        provider = StatefulRateLimitProvider(lambda: clock["now"])
        limiter = DynamicRateLimiter(
            get_time_in_seconds=lambda: clock["now"],
            integration_id=1,
            provider="github",
            rate_limit_provider=provider,
            rate_limit_window_seconds=3600,
            referrer_allocation={},
        )

        # GitHub's window closes at 1500, well inside our local 0-3600 window.
        limiter.update_rate_limit_meta(capacity=100, consumed=0, next_window_start=1500)

        for _ in range(100):
            limiter.is_rate_limited("shared")
        assert limiter.is_rate_limited("shared") is True

        # GitHub's window rolls over and it reports a fresh count.
        clock["now"] = 1501
        limiter.update_rate_limit_meta(capacity=100, consumed=1, next_window_start=5100)

        # The local counter must roll over with it, even though our local hour has not elapsed.
        assert limiter.is_rate_limited("shared") is False

    def test_usage_is_not_forgiven_before_the_provider_window_resets(self) -> None:
        """Alignment must not defeat the limiter within a window."""
        clock = {"now": 1000}
        provider = StatefulRateLimitProvider(lambda: clock["now"])
        limiter = DynamicRateLimiter(
            get_time_in_seconds=lambda: clock["now"],
            integration_id=1,
            provider="github",
            rate_limit_provider=provider,
            rate_limit_window_seconds=3600,
            referrer_allocation={},
        )
        limiter.update_rate_limit_meta(capacity=100, consumed=0, next_window_start=1500)

        for _ in range(100):
            limiter.is_rate_limited("shared")

        clock["now"] = 1499
        assert limiter.is_rate_limited("shared") is True

    def test_provider_reported_usage_survives_a_lost_local_counter(self) -> None:
        """
        If our counter is lost -- an evicted key, a cold cache, a silo whose counter never saw the
        traffic -- GitHub's reported usage still holds the line.
        """
        clock = {"now": 1000}
        provider = StatefulRateLimitProvider(lambda: clock["now"])
        limiter = DynamicRateLimiter(
            get_time_in_seconds=lambda: clock["now"],
            integration_id=1,
            provider="github",
            rate_limit_provider=provider,
            rate_limit_window_seconds=3600,
            referrer_allocation={},
        )
        limiter.update_rate_limit_meta(capacity=100, consumed=500, next_window_start=1500)

        provider.usage.clear()

        assert limiter.is_rate_limited("shared") is True
