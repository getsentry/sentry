from collections.abc import Callable

from sentry.scm.private.rate_limit import (
    CUMULATIVE_USAGE_TTL_SECONDS,
    DynamicRateLimiter,
    IndeterminateResult,
    WindowState,
    decode_window_state,
    encode_window_state,
)


def is_rate_limited(limiter: DynamicRateLimiter, referrer: str, resource: str) -> bool:
    """
    The decision alone, for tests that don't exercise completion accounting. Production callers
    must pair `check_rate_limit` with `record_completed_request`.
    """
    return limiter.check_rate_limit(referrer, resource).is_limited


class MockRateLimitProvider:
    def __init__(
        self,
        capacity: int | None = None,
        window: WindowState | None = None,
        usage: int = 0,
        total_usage: int | None = None,
        accounted_usage: int = 0,
        accounted_usage_error: Exception | None = None,
        state_error: Exception | None = None,
    ):
        self._capacity = capacity
        self._window = window
        self._usage = usage
        self._total_usage = usage if total_usage is None else total_usage
        self._accounted_usage = accounted_usage
        self._accounted_usage_error = accounted_usage_error
        self._state_error = state_error
        self.accounted_keys: list[str] = []
        self.set_kvs: dict = {}
        self.state_calls: list[tuple[str, str]] = []
        self.incr_calls: list[tuple[str, str, int]] = []
        self.completed_calls: list[tuple[str, int | None]] = []
        self.window_writes: list[tuple[str, WindowState, int]] = []

    def get_rate_limit_state(self, total_key, window_key):
        self.state_calls.append((total_key, window_key))
        if self._state_error is not None:
            raise self._state_error
        return (self._capacity, self._window)

    def incr_usage(self, usage_key, total_usage_key, expiration):
        self.incr_calls.append((usage_key, total_usage_key, expiration))
        return self._usage, self._total_usage

    def set_window_state(self, window_key, state, expiration):
        self.window_writes.append((window_key, state, expiration))

    def incr_completed_usage(self, usage_key, expiration):
        self.completed_calls.append((usage_key, expiration))

    def get_usage_counts(self, keys):
        self.accounted_keys.extend(keys)
        if self._accounted_usage_error is not None:
            raise self._accounted_usage_error
        return [self._accounted_usage] + [0] * (len(keys) - 1)

    def set_key_values(self, kvs):
        self.set_kvs.update(kvs)


def make_limiter(
    capacity: int | None = None,
    window: WindowState | None = None,
    usage: int = 0,
    total_usage: int | None = None,
    accounted_usage: int = 0,
    accounted_usage_error: Exception | None = None,
    state_error: Exception | None = None,
    referrer_allocation: dict | None = None,
    get_time_in_seconds: Callable[[], int] = lambda: 73,
    resource_windows: dict[str, int] | None = None,
) -> tuple[DynamicRateLimiter, MockRateLimitProvider]:
    provider = MockRateLimitProvider(
        capacity=capacity,
        window=window,
        usage=usage,
        total_usage=total_usage,
        accounted_usage=accounted_usage,
        accounted_usage_error=accounted_usage_error,
        state_error=state_error,
    )
    limiter = DynamicRateLimiter(
        get_time_in_seconds=get_time_in_seconds,
        integration_id=1,
        provider="github",
        rate_limit_provider=provider,
        rate_limit_window_seconds=3600,
        referrer_allocation=referrer_allocation or {},
        resource_windows=resource_windows,
    )
    return limiter, provider


class StatefulRateLimitProvider:
    """
    A minimal in-memory stand-in for Redis, so window rollover and key scoping are actually
    exercised rather than asserted on.
    """

    def __init__(self, now: Callable[[], int]) -> None:
        self.now = now
        self.capacities: dict[str, int] = {}
        self.usage: dict[str, tuple[int, int]] = {}
        self.total_usage: dict[str, int] = {}
        self.completed_usage: dict[str, tuple[int, int | None]] = {}
        self.windows: dict[str, tuple[WindowState, int]] = {}

    def _live(self, expires_at: int | None) -> bool:
        return expires_at is None or expires_at > self.now()

    def get_rate_limit_state(self, total_key, window_key):
        window = self.windows.get(window_key)
        if window is not None and not self._live(window[1]):
            window = None
        return (self.capacities.get(total_key), window[0] if window is not None else None)

    def incr_usage(self, usage_key, total_usage_key, expiration):
        count, expires_at = self.usage.get(usage_key, (0, 0))
        if not self._live(expires_at):
            count = 0
        count += 1
        self.usage[usage_key] = (count, self.now() + expiration)
        total = self.total_usage.get(total_usage_key, 0) + 1
        self.total_usage[total_usage_key] = total
        return count, total

    def set_window_state(self, window_key, state, expiration):
        self.windows[window_key] = (state, self.now() + expiration)

    def incr_completed_usage(self, usage_key, expiration):
        count, expires_at = self.completed_usage.get(usage_key, (0, 0))
        if not self._live(expires_at):
            count = 0
        expires_at = self.now() + expiration if expiration is not None else None
        self.completed_usage[usage_key] = (count + 1, expires_at)

    def get_usage_counts(self, keys):
        counts = []
        for key in keys:
            if key in self.total_usage:
                counts.append(self.total_usage[key])
                continue
            count, expires_at = self.completed_usage.get(key, self.usage.get(key, (0, 0)))
            counts.append(count if self._live(expires_at) else 0)
        return counts

    def set_key_values(self, kvs):
        for key, (value, _) in kvs.items():
            self.capacities[key] = value


def make_stateful_limiter(
    now: Callable[[], int] = lambda: 73,
    referrer_allocation: dict[str, float] | None = None,
    resource_windows: dict[str, int] | None = None,
) -> tuple[DynamicRateLimiter, StatefulRateLimitProvider]:
    provider = StatefulRateLimitProvider(now)
    limiter = DynamicRateLimiter(
        get_time_in_seconds=now,
        integration_id=1,
        provider="github",
        rate_limit_provider=provider,
        rate_limit_window_seconds=3600,
        referrer_allocation=referrer_allocation or {},
        resource_windows=resource_windows,
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
        assert is_rate_limited(limiter, "my_referrer", "default") is False

    def test_allocated_referrer_exhausted_quota(self) -> None:
        """Referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(
            capacity=10,
            usage=11,
            referrer_allocation={"my_referrer": 1.0},
        )
        assert is_rate_limited(limiter, "my_referrer", "default") is True

    def test_shared_referrer_with_excess_quota(self) -> None:
        """Shared referrer with remaining quota is not rate limited."""
        limiter, _ = make_limiter(capacity=100, usage=10)
        assert is_rate_limited(limiter, "shared", "default") is False

    def test_shared_referrer_exhausted_quota(self) -> None:
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(capacity=10, usage=11)
        assert is_rate_limited(limiter, "shared", "default") is True

    def test_unknown_referrer_exhausted_shared_quota(self) -> None:
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(capacity=10, usage=11)
        assert is_rate_limited(limiter, "abc", "default") is True

    def test_fails_open_when_limit_not_set(self) -> None:
        """Rate limit fails open if no limit is cached."""
        limiter, _ = make_limiter(
            capacity=None,
            usage=100_000_000,
            referrer_allocation={"my_referrer": 0.000000001},
        )
        assert is_rate_limited(limiter, "my_referrer", "default") is False

    def test_caches_recorded_capacity_after_check(self) -> None:
        """is_rate_limited stores the service capacity on the instance, keyed by resource."""
        limiter, _ = make_limiter(capacity=500, usage=1)
        is_rate_limited(limiter, "shared", "default")
        assert limiter.recorded_capacity == {"default": 500}

    def test_fully_reserved_quota(self) -> None:
        """Assert fully allocated referrer pool exhausts shared referrer by default."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=10,
            referrer_allocation={"my_referrer": 1.0},
        )
        assert is_rate_limited(limiter, "shared", "default") is True


class TestResourceScoping:
    """
    A resource is an independently metered pool on the service-provider's side. Usage against one
    pool must never be compared against another pool's limit.
    """

    def test_reads_state_and_usage_scoped_to_the_resource(self) -> None:
        """Each resource must consult its own capacity, window, and usage counter."""
        limiter, provider = make_limiter(capacity=30, usage=1)
        is_rate_limited(limiter, "shared", resource="search")

        total_key, window_key = provider.state_calls[0]
        usage_key, _, _ = provider.incr_calls[0]
        assert total_key == "limit:scm:github:1:search"
        assert window_key == "window:scm:github:1:search"
        assert usage_key.startswith("rl:scm:github:1:search:shared:")

    def test_resources_do_not_share_a_usage_counter(self) -> None:
        """A search request must not consume the core resource's quota."""
        limiter, provider = make_limiter(capacity=5000, usage=1)
        is_rate_limited(limiter, "shared", resource="core")
        is_rate_limited(limiter, "shared", resource="search")

        assert provider.state_calls[0] != provider.state_calls[1]
        assert provider.incr_calls[0][0] != provider.incr_calls[1][0]

    def test_resource_capacity_is_isolated(self) -> None:
        """
        Recording a low `search` capacity must not make `core` look exhausted. This is the
        regression that produced bursts of false positives: one shared capacity key meant a single
        30/minute search response starved every `core` request until a core response overwrote it.
        """
        limiter, _ = make_stateful_limiter()
        limiter.set_total_capacity(5000, resource="core")
        limiter.set_total_capacity(30, resource="search")

        # Burn well past the search limit but stay far below the core limit.
        for _ in range(50):
            is_rate_limited(limiter, "shared", resource="core")

        assert is_rate_limited(limiter, "shared", resource="core") is False
        assert is_rate_limited(limiter, "shared", resource="search") is False

    def test_resource_usage_is_isolated(self) -> None:
        """Core traffic must not exhaust the search resource's much smaller quota."""
        limiter, _ = make_stateful_limiter()
        limiter.set_total_capacity(5000, resource="core")
        limiter.set_total_capacity(30, resource="search")

        for _ in range(100):
            is_rate_limited(limiter, "shared", resource="core")

        assert is_rate_limited(limiter, "shared", resource="search") is False

    def test_resource_still_rate_limits_on_its_own_usage(self) -> None:
        """Isolation must not defeat the limiter: search still trips on its own quota."""
        limiter, _ = make_stateful_limiter()
        limiter.set_total_capacity(30, resource="search")

        for _ in range(30):
            assert is_rate_limited(limiter, "shared", resource="search") is False

        assert is_rate_limited(limiter, "shared", resource="search") is True

    def test_reported_window_is_isolated(self) -> None:
        """
        Each resource resets on its own schedule. A `search` reset must not roll the `core`
        counter, nor may `search` usage be reconciled against `core`'s reported total.
        """
        limiter, _ = make_stateful_limiter(now=lambda: 1000)
        limiter.update_rate_limit_meta(
            capacity=5000, consumed=0, next_window_start=4600, resource="core"
        )
        limiter.update_rate_limit_meta(
            capacity=30, consumed=4000, next_window_start=1060, resource="search"
        )

        # `search` reports usage far above `core`'s capacity, but it is charged only to `search`.
        assert is_rate_limited(limiter, "shared", resource="core") is False
        assert is_rate_limited(limiter, "shared", resource="search") is True

    def test_uses_resource_specific_window(self) -> None:
        """Search is metered per minute, so its bucket and TTL must use a 60 second window."""
        limiter, provider = make_limiter(
            capacity=30,
            usage=1,
            get_time_in_seconds=lambda: 3675,
            resource_windows={"search": 60},
        )
        is_rate_limited(limiter, "shared", resource="search")

        usage_key, _, expires_in = provider.incr_calls[0]
        assert usage_key.endswith(":3720")
        assert expires_in == 45

    def test_falls_back_to_default_window_for_unlisted_resource(self) -> None:
        limiter, provider = make_limiter(
            capacity=5000,
            usage=1,
            get_time_in_seconds=lambda: 3675,
            resource_windows={"search": 60},
        )
        is_rate_limited(limiter, "shared", resource="core")

        usage_key, _, expires_in = provider.incr_calls[0]
        assert usage_key.endswith(":7200")
        assert expires_in == 3525

    def test_window_seconds_reports_resource_override(self) -> None:
        limiter, _ = make_limiter(resource_windows={"search": 60})
        assert limiter.window_seconds("search") == 60
        assert limiter.window_seconds("core") == 3600


class TestReportedUsageReconciliation:
    """
    The provider's reported usage is authoritative for requests it has already answered. The
    cumulative counter identifies requests issued after that report, so provider-only usage and
    later local requests are both retained.
    """

    def test_reported_usage_raises_the_effective_count(self) -> None:
        """Requests the provider counted but we missed must still be charged."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=10,
            window=WindowState(used=101, reset=4000),
        )
        assert is_rate_limited(limiter, "shared", "default") is True

    def test_local_usage_is_kept_when_it_leads(self) -> None:
        """Requests in flight are not yet reflected in the provider's report."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=101,
            window=WindowState(used=1, reset=4000),
        )
        assert is_rate_limited(limiter, "shared", "default") is True

    def test_local_usage_since_the_report_is_added_to_reported_usage(self) -> None:
        """Retries in the report and requests issued afterward must both be charged."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=91,
            total_usage=91,
            window=WindowState(used=90, reset=4000, local_used=80),
        )
        assert is_rate_limited(limiter, "shared", "default") is True

    def test_implausible_in_flight_backlog_is_discarded(self) -> None:
        """
        The issued and completed counters can desync -- an evicted key, lost completion writes.
        More in-flight requests than the provider's total capacity is implausible, so the
        difference must be discarded rather than charged as a phantom backlog forever.
        """
        limiter, _ = make_limiter(
            capacity=100,
            usage=1,
            total_usage=1_000_000,
            window=WindowState(used=50, reset=4000, local_used=0),
        )
        assert is_rate_limited(limiter, "shared", "default") is False

    def test_plausible_in_flight_backlog_is_charged(self) -> None:
        limiter, _ = make_limiter(
            capacity=100,
            usage=1,
            total_usage=60,
            window=WindowState(used=50, reset=4000, local_used=0),
        )
        assert is_rate_limited(limiter, "shared", "default") is True

    def test_completed_shared_usage_expires_with_the_cumulative_counters(self) -> None:
        """
        The issued and completed counters are compared by difference, so they must expire
        together rather than persist forever.
        """
        limiter, provider = make_limiter()
        limiter.record_completed_request("shared", "default", None)
        assert provider.completed_calls == [
            ("completed-total:scm:github:1:default:shared", CUMULATIVE_USAGE_TTL_SECONDS)
        ]

    def test_reported_usage_below_capacity_is_not_rate_limited(self) -> None:
        limiter, _ = make_limiter(
            capacity=100,
            usage=10,
            window=WindowState(used=50, reset=4000),
        )
        assert is_rate_limited(limiter, "shared", "default") is False

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
        assert is_rate_limited(limiter, "my_referrer", "default") is False

    def test_reported_usage_from_a_closed_window_is_not_charged_forward(self) -> None:
        """
        A stale report can outlive its window -- TTL slop, or our clock running ahead of Redis.
        Its usage belongs to the closed window and must not exhaust the fresh one.
        """
        limiter, _ = make_limiter(
            capacity=100,
            usage=1,
            window=WindowState(used=5000, reset=100),
            get_time_in_seconds=lambda: 3675,
        )
        assert is_rate_limited(limiter, "shared", "default") is False

    def test_reported_usage_from_an_implausible_window_is_ignored(self) -> None:
        limiter, _ = make_limiter(
            capacity=100,
            usage=1,
            window=WindowState(used=5000, reset=10**10),
            get_time_in_seconds=lambda: 1000,
        )
        assert is_rate_limited(limiter, "shared", "default") is False

    def test_reserved_usage_is_deducted_from_reported_usage(self) -> None:
        """
        Reported usage includes quota the reserved referrers consumed. Charging it to the shared
        pool as well would exhaust shared long before it really is.
        """
        limiter, _ = make_limiter(
            capacity=100,
            usage=1,
            window=WindowState(used=60, reset=4000, reserved_used=60),
            referrer_allocation={"my_referrer": 0.5},
        )
        assert is_rate_limited(limiter, "shared", "default") is False

    def test_reserved_in_flight_usage_is_not_deducted_from_the_report(self) -> None:
        limiter, _ = make_limiter(
            capacity=100,
            usage=31,
            total_usage=31,
            window=WindowState(used=60, reset=4000, local_used=30, reserved_used=0),
            referrer_allocation={"my_referrer": 0.5},
        )
        assert is_rate_limited(limiter, "shared", "default") is True

    def test_completed_reserved_usage_is_recorded_for_the_provider_window(self) -> None:
        limiter, provider = make_limiter(
            get_time_in_seconds=lambda: 3900,
            referrer_allocation={"my_referrer": 0.5},
        )
        limiter.record_completed_request("my_referrer", "default", 4000)
        assert provider.completed_calls == [
            ("completed:scm:github:1:default:my_referrer:4000", 100)
        ]

    def test_completed_reserved_usage_is_scoped_to_the_resource(self) -> None:
        limiter, provider = make_limiter(
            get_time_in_seconds=lambda: 3900,
            referrer_allocation={"my_referrer": 0.5},
        )
        limiter.record_completed_request("my_referrer", "search", 4000)
        assert provider.completed_calls == [("completed:scm:github:1:search:my_referrer:4000", 100)]

    def test_indeterminate_completed_usage_snapshots_zero(self) -> None:
        """
        If reserved usage cannot be read, nothing is deducted from the report. That overstates the
        shared pool's usage, which is the conservative direction.
        """
        limiter, _ = make_limiter(
            capacity=100,
            usage=1,
            accounted_usage_error=IndeterminateResult(),
            get_time_in_seconds=lambda: 1000,
            referrer_allocation={"my_referrer": 0.5},
        )
        check = limiter.check_rate_limit("shared", "default")
        assert check.shared_completed == 0
        assert check.reserved_completed == 0

    def test_no_reserved_referrers_reads_only_shared_completion_snapshot(self) -> None:
        limiter, provider = make_limiter(
            capacity=100, usage=1, window=WindowState(used=10, reset=4000)
        )
        is_rate_limited(limiter, "shared", "default")
        assert provider.accounted_keys == ["completed-total:scm:github:1:default:shared"]


class TestWindowEnd:
    """
    The provider's window rarely aligns to our clock. GitHub's resets at a per-installation offset,
    so a locally aligned window carries usage past the provider's reset and overstates consumption
    for the rest of our window.
    """

    def test_uses_the_reported_reset(self) -> None:
        limiter, _ = make_limiter()
        assert limiter.window_end(1000, WindowState(used=5, reset=1500), "default") == 1500

    def test_falls_back_to_a_local_boundary_without_reported_state(self) -> None:
        limiter, _ = make_limiter()
        assert limiter.window_end(3675, None, "default") == 7200

    def test_falls_back_to_a_local_boundary_for_a_closed_window(self) -> None:
        """A reset in the past tells us nothing about the window we are in now."""
        limiter, _ = make_limiter()
        assert limiter.window_end(3675, WindowState(used=5, reset=100), "default") == 7200

    def test_accepts_a_reset_at_the_plausibility_bound(self) -> None:
        limiter, _ = make_limiter()
        assert limiter.window_end(1000, WindowState(used=5, reset=8200), "default") == 8200

    def test_an_implausible_reset_falls_back_to_a_stable_local_boundary(self) -> None:
        """
        A clock-skewed or nonsensical reset must not pin a counter in place indefinitely -- nor
        may the fallback derive the bucket from the current instant, or every request lands in a
        fresh counter and local accounting never accumulates.
        """
        limiter, _ = make_limiter()
        assert limiter.window_end(1000, WindowState(used=5, reset=10**10), "default") == 3600
        assert limiter.window_end(1001, WindowState(used=5, reset=10**10), "default") == 3600

    def test_an_implausible_reset_is_judged_against_the_resource_window(self) -> None:
        """A minute-metered resource must not be judged against the default hour."""
        limiter, _ = make_limiter(resource_windows={"search": 60})
        assert limiter.window_end(1000, WindowState(used=5, reset=1100), "search") == 1100
        assert limiter.window_end(1000, WindowState(used=5, reset=10**10), "search") == 1020

    def test_fallback_returns_the_end_of_the_current_local_window(self) -> None:
        limiter, _ = make_limiter()
        assert limiter.window_end(0, None, "default") == 3600
        assert limiter.window_end(3599, None, "default") == 3600
        assert limiter.window_end(3600, None, "default") == 7200

    def test_fallback_uses_the_resource_window(self) -> None:
        limiter, _ = make_limiter(resource_windows={"search": 60})
        assert limiter.window_end(3675, None, "search") == 3720


class TestUsageKeyBucketing:
    def test_counter_is_bucketed_by_the_reported_reset(self) -> None:
        limiter, provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=4000), get_time_in_seconds=lambda: 3900
        )
        is_rate_limited(limiter, "shared", "default")
        usage_key, _, expiration = provider.incr_calls[0]
        assert usage_key == "rl:scm:github:1:default:shared:4000"
        assert expiration == 100

    def test_counter_rolls_over_when_the_provider_window_does(self) -> None:
        """
        A counter keyed on the provider's reset starts fresh exactly when the provider forgives the
        previous window's usage, instead of carrying it to a locally computed boundary.
        """
        limiter, provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=4000), get_time_in_seconds=lambda: 3900
        )
        is_rate_limited(limiter, "shared", "default")

        rolled_over, rolled_over_provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=7600), get_time_in_seconds=lambda: 4001
        )
        is_rate_limited(rolled_over, "shared", "default")

        assert provider.incr_calls[0][0] != rolled_over_provider.incr_calls[0][0]

    def test_counter_ttl_expires_with_the_provider_window(self) -> None:
        limiter, provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=4000), get_time_in_seconds=lambda: 3000
        )
        is_rate_limited(limiter, "shared", "default")
        assert provider.incr_calls[0][2] == 1000

    def test_counter_uses_the_local_boundary_without_reported_state(self) -> None:
        limiter, provider = make_limiter(capacity=100, get_time_in_seconds=lambda: 3675)
        is_rate_limited(limiter, "shared", "default")
        usage_key, _, expiration = provider.incr_calls[0]
        assert usage_key == "rl:scm:github:1:default:shared:7200"
        assert expiration == 3525


class TestStateReadFailure:
    def test_fails_open_when_state_cannot_be_read(self) -> None:
        limiter, _ = make_limiter(state_error=IndeterminateResult())
        assert is_rate_limited(limiter, "shared", "default") is False

    def test_failed_read_does_not_clobber_the_capacity_cache(self) -> None:
        """
        A failed read says nothing about what the store holds. Forgetting a known capacity would
        force a redundant capacity rewrite on the next response.
        """
        limiter, provider = make_limiter(capacity=5000)
        limiter.set_total_capacity(5000, "default")
        provider.set_kvs.clear()

        provider._state_error = IndeterminateResult()
        is_rate_limited(limiter, "shared", "default")

        limiter.set_total_capacity(5000, "default")
        assert provider.set_kvs == {}

    def test_successful_read_still_refreshes_the_capacity_cache(self) -> None:
        """A read that finds no capacity must clear the cache so the next response rewrites it."""
        limiter, provider = make_limiter(capacity=None)
        limiter.set_total_capacity(5000, "default")
        provider.set_kvs.clear()

        is_rate_limited(limiter, "shared", "default")

        limiter.set_total_capacity(5000, "default")
        assert provider.set_kvs == {"limit:scm:github:1:default": (5000, None)}


class TestSetTotalCapacity:
    def test_writes_capacity_when_no_prior_value(self) -> None:
        """Capacity is written when the resource has no recorded capacity."""
        limiter, provider = make_limiter()
        limiter.set_total_capacity(5000, "default")
        assert provider.set_kvs == {"limit:scm:github:1:default": (5000, None)}

    def test_writes_capacity_when_value_differs(self) -> None:
        """Capacity is written when it differs from the resource's recorded capacity."""
        limiter, provider = make_limiter()
        limiter.recorded_capacity["core"] = 1000
        limiter.set_total_capacity(5000, "default")
        assert provider.set_kvs == {"limit:scm:github:1:default": (5000, None)}

    def test_skips_write_when_capacity_matches(self) -> None:
        """No write occurs when capacity matches the resource's recorded capacity."""
        limiter, provider = make_limiter()
        limiter.recorded_capacity["default"] = 5000
        limiter.set_total_capacity(5000, "default")
        assert provider.set_kvs == {}

    def test_writes_capacity_to_the_resource_key(self) -> None:
        limiter, provider = make_limiter()
        limiter.set_total_capacity(30, resource="search")
        assert provider.set_kvs == {"limit:scm:github:1:search": (30, None)}

    def test_capacity_recorded_for_one_resource_does_not_suppress_another(self) -> None:
        """
        A matching capacity on `search` must not be mistaken for a matching capacity on `core`,
        otherwise the two resources overwrite each other's limits.
        """
        limiter, provider = make_limiter()
        limiter.set_total_capacity(30, resource="search")
        provider.set_kvs.clear()
        limiter.set_total_capacity(30, resource="core")
        assert provider.set_kvs == {"limit:scm:github:1:core": (30, None)}

    def test_caches_written_capacity(self) -> None:
        """A repeated write of the same capacity is elided."""
        limiter, provider = make_limiter()
        limiter.set_total_capacity(5000, "default")
        provider.set_kvs.clear()
        limiter.set_total_capacity(5000, "default")
        assert provider.set_kvs == {}


class TestSetWindowState:
    def test_records_reported_usage_and_reset(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=1600, resource="default")
        assert provider.window_writes == [
            ("window:scm:github:1:default", WindowState(used=42, reset=1600), 600)
        ]

    def test_ignores_a_window_that_has_already_closed(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=999, resource="default")
        assert provider.window_writes == []

    def test_ignores_a_reset_at_the_current_instant(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=1000, resource="default")
        assert provider.window_writes == []

    def test_ignores_an_implausible_reset(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=10**10, resource="default")
        assert provider.window_writes == []

    def test_window_state_is_scoped_to_the_resource(self) -> None:
        """Resources reset on their own schedules, so their window state cannot share a key."""
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=1, next_window_start=1060, resource="search")
        limiter.set_window_state(consumed=2, next_window_start=4600, resource="core")
        assert [write[0] for write in provider.window_writes] == [
            "window:scm:github:1:search",
            "window:scm:github:1:core",
        ]


class TestUpdateRateLimitMeta:
    def test_records_both_capacity_and_window(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.update_rate_limit_meta(
            capacity=5000, consumed=42, next_window_start=1600, resource="default"
        )
        assert provider.set_kvs == {"limit:scm:github:1:default": (5000, None)}
        assert provider.window_writes == [
            ("window:scm:github:1:default", WindowState(used=42, reset=1600), 600)
        ]


class TestWindowStateCodec:
    def test_round_trips(self) -> None:
        state = WindowState(used=42, reset=1600, local_used=37, reserved_used=5)
        assert decode_window_state(encode_window_state(state)) == state

    def test_decodes_legacy_state_without_local_usage(self) -> None:
        assert decode_window_state("42:1600") == WindowState(used=42, reset=1600)

    def test_decodes_state_without_reserved_usage(self) -> None:
        assert decode_window_state("42:1600:37") == WindowState(used=42, reset=1600, local_used=37)

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

    def test_round_trips_reserved_usage_without_local_usage(self) -> None:
        state = WindowState(used=42, reset=1600, local_used=None, reserved_used=5)
        assert encode_window_state(state) == "42:1600::5"
        assert decode_window_state("42:1600::5") == state

    def test_decodes_negative_values(self) -> None:
        """A proxy can hand us nonsense like a negative reset; the codec must not choke on it."""
        assert decode_window_state("5:-1") == WindowState(used=5, reset=-1)


class TestNegativeReset:
    def test_negative_reset_falls_back_to_the_local_boundary(self) -> None:
        limiter, _ = make_limiter()
        assert limiter.window_end(3675, WindowState(used=5, reset=-1), "default") == 7200

    def test_negative_reset_is_not_recorded(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=-1, resource="default")
        assert provider.window_writes == []

    def test_negative_reported_usage_is_not_charged(self) -> None:
        limiter, _ = make_limiter(
            capacity=100,
            usage=1,
            window=WindowState(used=-5, reset=4000),
        )
        assert is_rate_limited(limiter, "shared", "default") is False


class TestWindowAlignmentScenario:
    """
    GitHub's window resets at a per-installation offset, not on our hour boundary. A locally
    aligned counter therefore carries usage across GitHub's reset and reports consumption GitHub
    has already forgiven -- producing false positives concentrated at a fixed phase of each hour.
    """

    def test_usage_is_forgiven_when_the_provider_window_resets(self) -> None:
        clock = {"now": 1000}
        limiter, _ = make_stateful_limiter(now=lambda: clock["now"])

        # GitHub's window closes at 1500, well inside our local 0-3600 window.
        limiter.update_rate_limit_meta(
            capacity=100, consumed=0, next_window_start=1500, resource="core"
        )

        for _ in range(100):
            is_rate_limited(limiter, "shared", "core")
        assert is_rate_limited(limiter, "shared", "core") is True

        # GitHub's window rolls over and it reports a fresh count.
        clock["now"] = 1501
        limiter.update_rate_limit_meta(
            capacity=100, consumed=1, next_window_start=5100, resource="core"
        )

        # The local counter must roll over with it, even though our local hour has not elapsed.
        assert is_rate_limited(limiter, "shared", "core") is False

    def test_usage_is_not_forgiven_before_the_provider_window_resets(self) -> None:
        """Alignment must not defeat the limiter within a window."""
        clock = {"now": 1000}
        limiter, _ = make_stateful_limiter(now=lambda: clock["now"])
        limiter.update_rate_limit_meta(
            capacity=100, consumed=0, next_window_start=1500, resource="core"
        )

        for _ in range(100):
            is_rate_limited(limiter, "shared", "core")

        clock["now"] = 1499
        assert is_rate_limited(limiter, "shared", "core") is True

    def test_provider_reported_usage_survives_a_lost_local_counter(self) -> None:
        """
        If our counter is lost -- an evicted key, a cold cache, a silo whose counter never saw the
        traffic -- GitHub's reported usage still holds the line.
        """
        clock = {"now": 1000}
        limiter, provider = make_stateful_limiter(now=lambda: clock["now"])
        limiter.update_rate_limit_meta(
            capacity=100, consumed=500, next_window_start=1500, resource="core"
        )

        provider.usage.clear()

        assert is_rate_limited(limiter, "shared", "core") is True

    def test_rollover_without_a_new_provider_report(self) -> None:
        """
        The reset can pass before the next response arrives. The old window's usage must not leak
        into the new one while we wait for GitHub to report again.
        """
        clock = {"now": 1000}
        limiter, _ = make_stateful_limiter(now=lambda: clock["now"])
        limiter.update_rate_limit_meta(
            capacity=100, consumed=0, next_window_start=1500, resource="core"
        )

        for _ in range(100):
            is_rate_limited(limiter, "shared", "core")
        assert is_rate_limited(limiter, "shared", "core") is True

        # GitHub's window rolls over, but no response has refreshed our state yet.
        clock["now"] = 1501
        assert is_rate_limited(limiter, "shared", "core") is False

    def test_shared_usage_survives_the_transition_to_a_reported_window(self) -> None:
        """
        Before the first response arrives, usage accrues under a locally aligned key. The first
        report moves the counter onto GitHub's own window -- the local counter is abandoned, but
        the report's `used` covers everything GitHub already answered.
        """
        clock = {"now": 1000}
        limiter, _ = make_stateful_limiter(now=lambda: clock["now"])
        limiter.set_total_capacity(100, resource="core")

        for _ in range(80):
            is_rate_limited(limiter, "shared", "core")

        limiter.update_rate_limit_meta(
            capacity=100,
            consumed=90,
            next_window_start=1500,
            resource="core",
            local_used=80,
        )

        for _ in range(10):
            assert is_rate_limited(limiter, "shared", "core") is False
        assert is_rate_limited(limiter, "shared", "core") is True

    def test_request_in_flight_before_a_report_remains_accounted(self) -> None:
        clock = {"now": 1000}
        limiter, _ = make_stateful_limiter(now=lambda: clock["now"])
        limiter.set_total_capacity(92, resource="core")

        for _ in range(80):
            is_rate_limited(limiter, "shared", "core")
            limiter.record_completed_request("shared", "core", None)

        # This request remains in flight while the next request produces the provider report.
        limiter.check_rate_limit("shared", "core")
        reporting_check = limiter.check_rate_limit("shared", "core")
        local_used, reserved_used = limiter.report_usage_snapshots(reporting_check, 1500)
        limiter.update_rate_limit_meta(
            capacity=92,
            consumed=91,
            next_window_start=1500,
            resource="core",
            local_used=local_used,
            reserved_used=reserved_used,
        )
        limiter.record_completed_request("shared", "core", 1500)

        # The report covers 91 uses; the earlier in-flight request and this request bring it to 93.
        assert is_rate_limited(limiter, "shared", "core") is True


class TestReservedReferrerScenario:
    """
    Reserved referrers consume quota GitHub reports in its cross-referrer total. The shared pool
    must deduct that consumption -- but only consumption belonging to the current window.
    """

    def test_reserved_usage_is_deducted_from_the_shared_pool(self) -> None:
        clock = {"now": 1000}
        limiter, _ = make_stateful_limiter(
            now=lambda: clock["now"], referrer_allocation={"emerge": 0.5}
        )
        limiter.update_rate_limit_meta(
            capacity=100, consumed=0, next_window_start=1500, resource="core"
        )

        for _ in range(60):
            is_rate_limited(limiter, "emerge", "core")
            limiter.record_completed_request("emerge", "core", 1500)

        # GitHub's report includes emerge's 60 requests; shared must not be charged for them.
        clock["now"] = 1100
        limiter.update_rate_limit_meta(
            capacity=100,
            consumed=60,
            next_window_start=1500,
            resource="core",
            reserved_used=60,
        )
        assert is_rate_limited(limiter, "shared", "core") is False

    def test_reserved_response_snapshots_shared_and_completed_usage(self) -> None:
        clock = {"now": 1000}
        limiter, provider = make_stateful_limiter(
            now=lambda: clock["now"], referrer_allocation={"emerge": 0.5}
        )
        limiter.set_total_capacity(100, resource="core")

        for _ in range(30):
            is_rate_limited(limiter, "shared", "core")
            limiter.record_completed_request("shared", "core", None)
        check = limiter.check_rate_limit("emerge", "core")
        local_used, reserved_used = limiter.report_usage_snapshots(check, 1500)
        limiter.update_rate_limit_meta(
            capacity=100,
            consumed=31,
            next_window_start=1500,
            resource="core",
            local_used=local_used,
            reserved_used=reserved_used,
        )
        limiter.record_completed_request("emerge", "core", 1500)

        state, _ = provider.windows["window:scm:github:1:core"]
        assert state.local_used == 30
        assert state.reserved_used == 1

    def test_shared_request_started_after_a_reserved_report_is_not_lost(self) -> None:
        clock = {"now": 1000}
        limiter, _ = make_stateful_limiter(
            now=lambda: clock["now"], referrer_allocation={"emerge": 0.5}
        )
        limiter.set_total_capacity(182, resource="core")

        for _ in range(80):
            is_rate_limited(limiter, "shared", "core")
            limiter.record_completed_request("shared", "core", None)

        reporting_check = limiter.check_rate_limit("emerge", "core")
        limiter.check_rate_limit("shared", "core")
        local_used, reserved_used = limiter.report_usage_snapshots(reporting_check, 1500)
        limiter.update_rate_limit_meta(
            capacity=182,
            consumed=91,
            next_window_start=1500,
            resource="core",
            local_used=local_used,
            reserved_used=reserved_used,
        )
        limiter.record_completed_request("emerge", "core", 1500)

        # Shared usage is 90 in the report plus both requests started after its snapshot.
        assert is_rate_limited(limiter, "shared", "core") is True

    def test_later_reserved_completion_is_not_deducted_from_an_older_report(self) -> None:
        limiter, _ = make_stateful_limiter(referrer_allocation={"emerge": 0.5})
        first_check = limiter.check_rate_limit("emerge", "core")
        second_check = limiter.check_rate_limit("emerge", "core")

        limiter.record_completed_request("emerge", "core", 3600)

        _, first_reserved = limiter.report_usage_snapshots(first_check, 3600)
        _, second_reserved = limiter.report_usage_snapshots(second_check, 3600)
        assert first_reserved == 1
        assert second_reserved == 1

    def test_stale_reserved_usage_is_not_deducted_after_rollover(self) -> None:
        clock = {"now": 1000}
        limiter, _ = make_stateful_limiter(
            now=lambda: clock["now"], referrer_allocation={"emerge": 0.5}
        )
        limiter.update_rate_limit_meta(
            capacity=100, consumed=0, next_window_start=1500, resource="core"
        )

        for _ in range(60):
            is_rate_limited(limiter, "emerge", "core")
            limiter.record_completed_request("emerge", "core", 1500)

        # The window rolls over; the fresh report's usage belongs entirely to shared callers, so
        # emerge's previous-window consumption must not be deducted from it.
        clock["now"] = 1501
        limiter.update_rate_limit_meta(
            capacity=100,
            consumed=51,
            next_window_start=5100,
            resource="core",
            reserved_used=0,
        )
        assert is_rate_limited(limiter, "shared", "core") is True
