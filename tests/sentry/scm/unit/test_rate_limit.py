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
        self.state_calls: list[tuple[str, str]] = []
        self.incr_calls: list[tuple[str, int]] = []
        self.window_writes: list[tuple[str, WindowState, int]] = []

    def get_rate_limit_state(self, total_key, window_key):
        self.state_calls.append((total_key, window_key))
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
    resource_windows: dict[str, int] | None = None,
) -> tuple[DynamicRateLimiter, MockRateLimitProvider]:
    provider = MockRateLimitProvider(capacity, window, usage, accounted_usage)
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
        self.windows: dict[str, tuple[WindowState, int]] = {}

    def _live(self, expires_at: int) -> bool:
        return expires_at > self.now()

    def get_rate_limit_state(self, total_key, window_key):
        window = self.windows.get(window_key)
        if window is not None and not self._live(window[1]):
            window = None
        return (self.capacities.get(total_key), window[0] if window is not None else None)

    def incr_usage(self, usage_key, expiration):
        count, expires_at = self.usage.get(usage_key, (0, 0))
        if not self._live(expires_at):
            count = 0
        count += 1
        self.usage[usage_key] = (count, self.now() + expiration)
        return count

    def set_window_state(self, window_key, state, expiration):
        self.windows[window_key] = (state, self.now() + expiration)

    def get_accounted_usage(self, keys):
        return sum(self.usage.get(key, (0, 0))[0] for key in keys)

    def set_key_values(self, kvs):
        for key, (value, _) in kvs.items():
            self.capacities[key] = value


def make_stateful_limiter(
    now: Callable[[], int] = lambda: 73,
    resource_windows: dict[str, int] | None = None,
) -> tuple[DynamicRateLimiter, StatefulRateLimitProvider]:
    provider = StatefulRateLimitProvider(now)
    limiter = DynamicRateLimiter(
        get_time_in_seconds=now,
        integration_id=1,
        provider="github",
        rate_limit_provider=provider,
        rate_limit_window_seconds=3600,
        referrer_allocation={},
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
        assert limiter.is_rate_limited("my_referrer", "default") is False

    def test_allocated_referrer_exhausted_quota(self) -> None:
        """Referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(
            capacity=10,
            usage=11,
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("my_referrer", "default") is True

    def test_shared_referrer_with_excess_quota(self) -> None:
        """Shared referrer with remaining quota is not rate limited."""
        limiter, _ = make_limiter(capacity=100, usage=10)
        assert limiter.is_rate_limited("shared", "default") is False

    def test_shared_referrer_exhausted_quota(self) -> None:
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(capacity=10, usage=11)
        assert limiter.is_rate_limited("shared", "default") is True

    def test_unknown_referrer_exhausted_shared_quota(self) -> None:
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(capacity=10, usage=11)
        assert limiter.is_rate_limited("abc", "default") is True

    def test_fails_open_when_limit_not_set(self) -> None:
        """Rate limit fails open if no limit is cached."""
        limiter, _ = make_limiter(
            capacity=None,
            usage=100_000_000,
            referrer_allocation={"my_referrer": 0.000000001},
        )
        assert limiter.is_rate_limited("my_referrer", "default") is False

    def test_caches_recorded_capacity_after_check(self) -> None:
        """is_rate_limited stores the service capacity on the instance, keyed by resource."""
        limiter, _ = make_limiter(capacity=500, usage=1)
        limiter.is_rate_limited("shared", "default")
        assert limiter.recorded_capacity == {"default": 500}

    def test_fully_reserved_quota(self) -> None:
        """Assert fully allocated referrer pool exhausts shared referrer by default."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=10,
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("shared", "default") is True


class TestResourceScoping:
    """
    A resource is an independently metered pool on the service-provider's side. Usage against one
    pool must never be compared against another pool's limit.
    """

    def test_reads_state_and_usage_scoped_to_the_resource(self) -> None:
        """Each resource must consult its own capacity, window, and usage counter."""
        limiter, provider = make_limiter(capacity=30, usage=1)
        limiter.is_rate_limited("shared", resource="search")

        total_key, window_key = provider.state_calls[0]
        usage_key, _ = provider.incr_calls[0]
        assert total_key == "limit:scm:github:1:search"
        assert window_key == "window:scm:github:1:search"
        assert usage_key.startswith("rl:scm:github:1:search:shared:")

    def test_resources_do_not_share_a_usage_counter(self) -> None:
        """A search request must not consume the core resource's quota."""
        limiter, provider = make_limiter(capacity=5000, usage=1)
        limiter.is_rate_limited("shared", resource="core")
        limiter.is_rate_limited("shared", resource="search")

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
            limiter.is_rate_limited("shared", resource="core")

        assert limiter.is_rate_limited("shared", resource="core") is False
        assert limiter.is_rate_limited("shared", resource="search") is False

    def test_resource_usage_is_isolated(self) -> None:
        """Core traffic must not exhaust the search resource's much smaller quota."""
        limiter, _ = make_stateful_limiter()
        limiter.set_total_capacity(5000, resource="core")
        limiter.set_total_capacity(30, resource="search")

        for _ in range(100):
            limiter.is_rate_limited("shared", resource="core")

        assert limiter.is_rate_limited("shared", resource="search") is False

    def test_resource_still_rate_limits_on_its_own_usage(self) -> None:
        """Isolation must not defeat the limiter: search still trips on its own quota."""
        limiter, _ = make_stateful_limiter()
        limiter.set_total_capacity(30, resource="search")

        for _ in range(30):
            assert limiter.is_rate_limited("shared", resource="search") is False

        assert limiter.is_rate_limited("shared", resource="search") is True

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
        assert limiter.is_rate_limited("shared", resource="core") is False
        assert limiter.is_rate_limited("shared", resource="search") is True

    def test_uses_resource_specific_window(self) -> None:
        """Search is metered per minute, so its bucket and TTL must use a 60 second window."""
        limiter, provider = make_limiter(
            capacity=30,
            usage=1,
            get_time_in_seconds=lambda: 3675,
            resource_windows={"search": 60},
        )
        limiter.is_rate_limited("shared", resource="search")

        usage_key, expires_in = provider.incr_calls[0]
        assert usage_key.endswith(":3720")
        assert expires_in == 45

    def test_falls_back_to_default_window_for_unlisted_resource(self) -> None:
        limiter, provider = make_limiter(
            capacity=5000,
            usage=1,
            get_time_in_seconds=lambda: 3675,
            resource_windows={"search": 60},
        )
        limiter.is_rate_limited("shared", resource="core")

        usage_key, expires_in = provider.incr_calls[0]
        assert usage_key.endswith(":7200")
        assert expires_in == 3525

    def test_window_seconds_reports_resource_override(self) -> None:
        limiter, _ = make_limiter(resource_windows={"search": 60})
        assert limiter.window_seconds("search") == 60
        assert limiter.window_seconds("core") == 3600


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
        assert limiter.is_rate_limited("shared", "default") is True

    def test_local_usage_is_kept_when_it_leads(self) -> None:
        """Requests in flight are not yet reflected in the provider's report."""
        limiter, _ = make_limiter(
            capacity=100,
            usage=101,
            window=WindowState(used=1, reset=4000),
        )
        assert limiter.is_rate_limited("shared", "default") is True

    def test_reported_usage_below_capacity_is_not_rate_limited(self) -> None:
        limiter, _ = make_limiter(
            capacity=100,
            usage=10,
            window=WindowState(used=50, reset=4000),
        )
        assert limiter.is_rate_limited("shared", "default") is False

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
        assert limiter.is_rate_limited("my_referrer", "default") is False

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
        assert limiter.is_rate_limited("shared", "default") is False

    def test_reserved_usage_is_read_for_the_current_window(self) -> None:
        limiter, provider = make_limiter(
            capacity=100,
            usage=1,
            window=WindowState(used=10, reset=4000),
            referrer_allocation={"my_referrer": 0.5},
        )
        limiter.is_rate_limited("shared", "default")
        assert provider.accounted_keys == ["rl:scm:github:1:default:my_referrer:4000"]

    def test_reserved_usage_is_read_for_the_current_resource(self) -> None:
        limiter, provider = make_limiter(
            capacity=100,
            usage=1,
            window=WindowState(used=10, reset=4000),
            referrer_allocation={"my_referrer": 0.5},
        )
        limiter.is_rate_limited("shared", "search")
        assert provider.accounted_keys == ["rl:scm:github:1:search:my_referrer:4000"]

    def test_no_reserved_referrers_means_no_extra_reads(self) -> None:
        limiter, provider = make_limiter(
            capacity=100, usage=1, window=WindowState(used=10, reset=4000)
        )
        limiter.is_rate_limited("shared", "default")
        assert provider.accounted_keys == []


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

    def test_clamps_an_implausible_reset(self) -> None:
        """A clock-skewed or nonsensical reset must not pin a counter in place indefinitely."""
        limiter, _ = make_limiter()
        assert limiter.window_end(1000, WindowState(used=5, reset=10**10), "default") == 1000 + 7200

    def test_clamps_an_implausible_reset_against_the_resource_window(self) -> None:
        """A minute-metered resource must not be clamped against the default hour."""
        limiter, _ = make_limiter(resource_windows={"search": 60})
        assert limiter.window_end(1000, WindowState(used=5, reset=10**10), "search") == 1120

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
        limiter.is_rate_limited("shared", "default")
        usage_key, expiration = provider.incr_calls[0]
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
        limiter.is_rate_limited("shared", "default")

        rolled_over, rolled_over_provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=7600), get_time_in_seconds=lambda: 4001
        )
        rolled_over.is_rate_limited("shared", "default")

        assert provider.incr_calls[0][0] != rolled_over_provider.incr_calls[0][0]

    def test_counter_ttl_expires_with_the_provider_window(self) -> None:
        limiter, provider = make_limiter(
            capacity=100, window=WindowState(used=1, reset=4000), get_time_in_seconds=lambda: 3000
        )
        limiter.is_rate_limited("shared", "default")
        assert provider.incr_calls[0][1] == 1000

    def test_counter_uses_the_local_boundary_without_reported_state(self) -> None:
        limiter, provider = make_limiter(capacity=100, get_time_in_seconds=lambda: 3675)
        limiter.is_rate_limited("shared", "default")
        usage_key, expiration = provider.incr_calls[0]
        assert usage_key == "rl:scm:github:1:default:shared:7200"
        assert expiration == 3525


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

    def test_clamps_the_ttl_of_an_implausible_reset(self) -> None:
        limiter, provider = make_limiter(get_time_in_seconds=lambda: 1000)
        limiter.set_window_state(consumed=42, next_window_start=10**10, resource="default")
        assert provider.window_writes[0][2] == 7200

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
            limiter.is_rate_limited("shared", "core")
        assert limiter.is_rate_limited("shared", "core") is True

        # GitHub's window rolls over and it reports a fresh count.
        clock["now"] = 1501
        limiter.update_rate_limit_meta(
            capacity=100, consumed=1, next_window_start=5100, resource="core"
        )

        # The local counter must roll over with it, even though our local hour has not elapsed.
        assert limiter.is_rate_limited("shared", "core") is False

    def test_usage_is_not_forgiven_before_the_provider_window_resets(self) -> None:
        """Alignment must not defeat the limiter within a window."""
        clock = {"now": 1000}
        limiter, _ = make_stateful_limiter(now=lambda: clock["now"])
        limiter.update_rate_limit_meta(
            capacity=100, consumed=0, next_window_start=1500, resource="core"
        )

        for _ in range(100):
            limiter.is_rate_limited("shared", "core")

        clock["now"] = 1499
        assert limiter.is_rate_limited("shared", "core") is True

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

        assert limiter.is_rate_limited("shared", "core") is True
