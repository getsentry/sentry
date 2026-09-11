from collections.abc import Callable

from sentry.scm.private.rate_limit import DynamicRateLimiter


class MockRateLimitProvider:
    def __init__(self, get_and_set_return: tuple[int | None, int], accounted_usage: int = 0):
        self._get_and_set_return = get_and_set_return
        self._accounted_usage = accounted_usage
        self.accounted_keys: list[str] = []
        self.set_kvs: dict = {}
        self.get_and_set_calls: list[tuple[str, str, int]] = []

    def get_and_set_rate_limit(self, total_key, usage_key, expiration):
        self.get_and_set_calls.append((total_key, usage_key, expiration))
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
    get_time_in_seconds: Callable[[], int] = lambda: 73,
    resource_windows: dict[str, int] | None = None,
) -> tuple[DynamicRateLimiter, MockRateLimitProvider]:
    provider = MockRateLimitProvider(get_and_set_return, accounted_usage)
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
    """A minimal in-memory stand-in for Redis, so key scoping is actually exercised."""

    def __init__(self) -> None:
        self.capacities: dict[str, int] = {}
        self.usage: dict[str, int] = {}

    def get_and_set_rate_limit(self, total_key, usage_key, expiration):
        self.usage[usage_key] = self.usage.get(usage_key, 0) + 1
        return (self.capacities.get(total_key), self.usage[usage_key])

    def get_accounted_usage(self, keys):
        return sum(self.usage.get(key, 0) for key in keys)

    def set_key_values(self, kvs):
        for key, (value, _) in kvs.items():
            self.capacities[key] = value


def make_stateful_limiter(
    resource_windows: dict[str, int] | None = None,
    get_time_in_seconds: Callable[[], int] = lambda: 73,
) -> tuple[DynamicRateLimiter, StatefulRateLimitProvider]:
    provider = StatefulRateLimitProvider()
    limiter = DynamicRateLimiter(
        get_time_in_seconds=get_time_in_seconds,
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
            get_and_set_return=(100, 10),
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("my_referrer", "default") is False

    def test_allocated_referrer_exhausted_quota(self) -> None:
        """Referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(
            get_and_set_return=(10, 11),
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("my_referrer", "default") is True

    def test_shared_referrer_with_excess_quota(self) -> None:
        """Shared referrer with remaining quota is not rate limited."""
        limiter, _ = make_limiter(get_and_set_return=(100, 10))
        assert limiter.is_rate_limited("shared", "default") is False

    def test_shared_referrer_exhausted_quota(self) -> None:
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(get_and_set_return=(10, 11))
        assert limiter.is_rate_limited("shared", "default") is True

    def test_unknown_referrer_exhausted_shared_quota(self) -> None:
        """Shared referrer at quota limit is rate limited."""
        limiter, _ = make_limiter(get_and_set_return=(10, 11))
        assert limiter.is_rate_limited("abc", "default") is True

    def test_fails_open_when_limit_not_set(self) -> None:
        """Rate limit fails open if no limit is cached."""
        limiter, _ = make_limiter(
            get_and_set_return=(None, 100_000_000),
            referrer_allocation={"my_referrer": 0.000000001},
        )
        assert limiter.is_rate_limited("my_referrer", "default") is False

    def test_caches_recorded_capacity_after_check(self) -> None:
        """is_rate_limited stores the service capacity on the instance, keyed by resource."""
        limiter, _ = make_limiter(get_and_set_return=(500, 1))
        limiter.is_rate_limited("shared", "default")
        assert limiter.recorded_capacity == {"default": 500}

    def test_fully_reserved_quota(self) -> None:
        """Assert fully allocated referrer pool exhausts shared referrer by default."""
        limiter, _ = make_limiter(
            get_and_set_return=(100, 10),
            referrer_allocation={"my_referrer": 1.0},
        )
        assert limiter.is_rate_limited("shared", "default") is True

    def test_reads_capacity_and_usage_scoped_to_the_resource(self) -> None:
        """Each resource must consult its own capacity and its own usage counter."""
        limiter, provider = make_limiter(get_and_set_return=(30, 1))
        limiter.is_rate_limited("shared", resource="search")
        total_key, usage_key, _ = provider.get_and_set_calls[0]
        assert total_key == "limit:scm:github:1:search"
        assert usage_key == "rl:scm:github:1:search:shared:0"

    def test_resources_do_not_share_a_usage_counter(self) -> None:
        """A search request must not consume the core resource's quota."""
        limiter, provider = make_limiter(get_and_set_return=(5000, 1))
        limiter.is_rate_limited("shared", resource="core")
        limiter.is_rate_limited("shared", resource="search")
        core_total, core_usage, _ = provider.get_and_set_calls[0]
        search_total, search_usage, _ = provider.get_and_set_calls[1]
        assert core_total != search_total
        assert core_usage != search_usage

    def test_resource_capacity_is_isolated(self) -> None:
        """
        Recording a low `search` capacity must not make `core` look exhausted. This is the
        regression that produced bursts of false positives: one shared capacity key meant a single
        30/minute search response starved every `core` request until a core response overwrote it.
        """
        limiter, provider = make_stateful_limiter()
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

    def test_uses_resource_specific_window(self) -> None:
        """Search is metered per minute, so its bucket and TTL must use a 60 second window."""
        limiter, provider = make_limiter(
            get_and_set_return=(30, 1),
            get_time_in_seconds=lambda: 3675,
            resource_windows={"search": 60},
        )
        limiter.is_rate_limited("shared", resource="search")
        _, usage_key, expires_in = provider.get_and_set_calls[0]
        assert usage_key.endswith(":61")
        assert expires_in == 45

    def test_falls_back_to_default_window_for_unlisted_resource(self) -> None:
        limiter, provider = make_limiter(
            get_and_set_return=(5000, 1),
            get_time_in_seconds=lambda: 3675,
            resource_windows={"search": 60},
        )
        limiter.is_rate_limited("shared", resource="core")
        _, usage_key, expires_in = provider.get_and_set_calls[0]
        assert usage_key.endswith(":1")
        assert expires_in == 3525

    def test_window_seconds_reports_resource_override(self) -> None:
        limiter, _ = make_limiter(resource_windows={"search": 60})
        assert limiter.window_seconds("search") == 60
        assert limiter.window_seconds("core") == 3600


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
