from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Protocol

from django.conf import settings
from redis import RedisError

from sentry.utils import redis

# Window identities and TTLs are derived from the reset instant the service-provider reports. A
# reset more than this many window-lengths in the future is implausible -- clock skew or a
# nonsensical header -- and is treated as if the provider had reported nothing, so it can neither
# pin a counter in place for an unbounded stretch nor derive a counter's identity from the
# current instant.
MAX_WINDOW_TTL_MULTIPLIER = 2


def usage_count_key(
    provider: str, integration_id: int, time_bucket: int, referrer: str, resource: str
) -> str:
    return f"rl:scm:{provider}:{integration_id}:{resource}:{referrer}:{time_bucket}"


def total_limit_key(provider: str, integration_id: int, resource: str) -> str:
    return f"limit:scm:{provider}:{integration_id}:{resource}"


def window_state_key(provider: str, integration_id: int, resource: str) -> str:
    return f"window:scm:{provider}:{integration_id}:{resource}"


@dataclass(frozen=True)
class WindowState:
    """
    The service-provider's own accounting of the current rate-limit window.

    :param used: Quota the provider says has been consumed in this window, across all referrers.
    :param reset: The epoch second at which the provider's window rolls over.
    """

    used: int
    reset: int


def encode_window_state(state: WindowState) -> str:
    return f"{state.used}:{state.reset}"


def decode_window_state(value: str | None) -> WindowState | None:
    if not value:
        return None

    used, _, reset = value.partition(":")
    try:
        return WindowState(used=int(used), reset=int(reset))
    except ValueError:
        return None


class RateLimitProvider(Protocol):
    """
    Type definition for rate-limit service providers. Service providers could be Redis, local
    in-memory, an RDBMS, or anything really (so long as it persists state between requests). In
    practice this will always be Redis but we define the type so we can simplify testing and
    simulation.
    """

    def get_rate_limit_state(
        self, total_key: str, window_key: str
    ) -> tuple[int | None, WindowState | None]:
        """
        Get the request limit and the service-provider's own view of the current window.

        :param total_key: The location of the request limit.
        :param window_key: The location of the reported window state.
        """
        ...

    def incr_usage(self, usage_key: str, expiration: int) -> int:
        """
        Increment the quota counter for the key and return its new value.

        :param usage_key: The location of the quota counter.
        :param expiration: The number of seconds until the key expires.
        """
        ...

    def set_window_state(self, window_key: str, state: WindowState, expiration: int) -> None:
        """Record the service-provider's reported window state."""
        ...

    def get_accounted_usage(self, keys: list[str]) -> int:
        """Return the sum of a given set of keys."""
        ...

    def set_key_values(self, kvs: dict[str, tuple[int, int | None]]) -> None:
        """For a given set of key, value pairs set them in the Redis Cluster."""
        ...


class DynamicRateLimiter:
    """
    Quota management class for external rate-limits with dynamic, per-organization request limits.

    The `DynamicRateLimiter` class operates as a mirror of an externally managed rate limiter. It
    attempts to load-shed requests when it thinks a quota allocation has been exceeded.

    Two sources of truth are combined. Our own counter accounts for requests as we issue them,
    which is the only accounting available for requests still in flight. The service-provider's
    reported usage, recorded by `update_rate_limit_meta` from response metadata, is authoritative
    for everything already answered. Taking the greater of the two keeps the mirror from drifting
    in either direction: we neither forget requests the provider counted but we missed, nor carry
    usage the provider has already forgiven.

    Windows are identified by the instant the provider's window resets rather than by a locally
    computed boundary. A provider's window rarely aligns to our clock -- GitHub's resets at a
    per-installation offset -- so a locally aligned window would carry usage across the provider's
    reset and systematically overstate consumption for the remainder of our window.

    Quota is tracked per resource. A resource is an independently metered pool on the
    service-provider's side; usage against one pool must never be compared against another pool's
    limit. Resources may also be metered over different windows, which `resource_windows`
    expresses.

    :param get_time_in_seconds: Get the current UTC timestamp in seconds.
    :param integration_id: The integration we're scoped to.
    :param provider: The service-provider we received rate-limit headers from.
    :param rate_limit_window_seconds: The window length used by resources absent from
        `resource_windows`, assumed until the provider tells us when its window resets.
    :param referrer_allocation: The referrer allocation pool we're working with.
    :param resource_windows: Per-resource window length overrides, in seconds.
    """

    def __init__(
        self,
        get_time_in_seconds: Callable[[], int],
        integration_id: int,
        provider: str,
        rate_limit_provider: RateLimitProvider,
        rate_limit_window_seconds: int,
        referrer_allocation: dict[str, float],
        resource_windows: Mapping[str, int] | None = None,
    ) -> None:
        self.get_time_in_seconds = get_time_in_seconds
        self.integration_id = integration_id
        self.provider = provider
        self.rate_limit_provider = rate_limit_provider
        self.rate_limit_window_seconds = rate_limit_window_seconds
        self.referrer_allocation = referrer_allocation
        self.resource_windows = dict(resource_windows or {})
        self.recorded_capacity: dict[str, int | None] = {}

    def window_seconds(self, resource: str) -> int:
        """Return the length of the rate-limit window for a resource."""
        return self.resource_windows.get(resource, self.rate_limit_window_seconds)

    def window_end(self, current_time: int, window: WindowState | None, resource: str) -> int:
        """
        Return the epoch second at which the current rate-limit window ends.

        This doubles as the window's identity, so it must be stable across calls made within the
        same window -- deriving it from the current instant would hand every request its own
        counter. A reported reset is used as-is when it is live and plausibly near. A missing,
        closed, or implausibly distant reset falls back to a locally aligned tumbling window; the
        first response carrying a usable reset moves the counter onto the provider's window, and
        the provider's reported usage covers whatever the abandoned local counter had seen.
        """
        window_seconds = self.window_seconds(resource)

        if window is not None:
            max_reset = current_time + (window_seconds * MAX_WINDOW_TTL_MULTIPLIER)
            if current_time < window.reset <= max_reset:
                return window.reset

        # We have no live, plausible reset from the provider, so assume a tumbling window of the
        # configured length.
        elapsed = int(current_time % window_seconds)
        return current_time - elapsed + window_seconds

    def is_rate_limited(self, referrer: str, resource: str) -> bool:
        """
        Returns true if the quota for this organization has been exhausted.

        This check is best-effort and is not guaranteed to prevent a rate-limit error response from
        a service-provider.
        """

        if referrer not in self.referrer_allocation:
            referrer = "shared"

        current_time = self.get_time_in_seconds()

        service_capacity, window = self.rate_limit_provider.get_rate_limit_state(
            total_limit_key(self.provider, self.integration_id, resource),
            window_state_key(self.provider, self.integration_id, resource),
        )

        # We can cache this value to skip the service_capacity set operation. It saves us from
        # writing the same capacity value over and over again. The cached capacity is preserved
        # across multiple callers meaning this caching, though local to the dynamic rate limiter,
        # enjoys global population semantics.
        self.recorded_capacity[resource] = service_capacity

        window_end = self.window_end(current_time, window, resource)
        quota_used = self.rate_limit_provider.incr_usage(
            usage_count_key(self.provider, self.integration_id, window_end, referrer, resource),
            window_end - current_time,
        )

        # The provider reports usage across every referrer, so it can only be reconciled against
        # the shared pool, and only after the quota reserved referrers have accounted for is
        # deducted from it. A report whose window has already closed describes usage the provider
        # has forgiven, so it must not be charged into the window we are in now.
        if window is not None and window.reset > current_time and referrer == "shared":
            quota_used = max(quota_used, window.used - self._reserved_usage(window_end, resource))

        # If no limit could be found we fail open. We'll populate the limit on the other-side of the
        # HTTP request.
        if service_capacity is None:
            return False

        # If the referrer exists in the allocation pool then we compute its capacity otherwise we
        # need to compute the total unallocated "shared" capacity.
        if referrer == "shared":
            referrer_capacity = int(
                service_capacity * (1.0 - sum(self.referrer_allocation.values()))
            )
        else:
            referrer_capacity = int(service_capacity * self.referrer_allocation[referrer])

        return quota_used > referrer_capacity

    def _reserved_usage(self, window_end: int, resource: str) -> int:
        """Return the quota consumed by referrers holding a reserved allocation."""
        keys = [
            usage_count_key(self.provider, self.integration_id, window_end, referrer, resource)
            for referrer in self.referrer_allocation
        ]
        if not keys:
            return 0

        try:
            return self.rate_limit_provider.get_accounted_usage(keys)
        except IndeterminateResult:
            # Deducting nothing overstates the shared pool's usage, which is the conservative
            # direction. The next request will try again.
            return 0

    def update_rate_limit_meta(
        self,
        capacity: int,
        consumed: int,
        next_window_start: int,
        resource: str,
    ) -> None:
        """Update the store with select rate-limit metadata."""
        self.set_total_capacity(capacity, resource)
        self.set_window_state(consumed, next_window_start, resource)

    def set_total_capacity(self, capacity: int, resource: str) -> None:
        """Set the service capacity if it does not match what already exists."""
        if capacity != self.recorded_capacity.get(resource):
            key = total_limit_key(self.provider, self.integration_id, resource)
            self.rate_limit_provider.set_key_values({key: (capacity, None)})
            self.recorded_capacity[resource] = capacity
        return None

    def set_window_state(self, consumed: int, next_window_start: int, resource: str) -> None:
        """Record the service-provider's own accounting of the current window."""
        current_time = self.get_time_in_seconds()
        if next_window_start <= current_time:
            # The window has already closed, so this tells us nothing about current consumption.
            return None

        state = WindowState(used=consumed, reset=next_window_start)
        self.rate_limit_provider.set_window_state(
            window_state_key(self.provider, self.integration_id, resource),
            state,
            self.window_end(current_time, state, resource) - current_time,
        )
        return None


class RedisRateLimitProvider:
    def __init__(self):
        self.cluster = redis.redis_clusters.get(settings.SENTRY_SCM_REDIS_CLUSTER)

    def get_rate_limit_state(
        self, total_key: str, window_key: str
    ) -> tuple[int | None, WindowState | None]:
        """
        Get the request limit and the service-provider's own view of the current window.

        :param total_key: The location of the request limit.
        :param window_key: The location of the reported window state.
        """
        try:
            with self.cluster.pipeline() as pipe:
                pipe.get(total_key)
                pipe.get(window_key)

                capacity, window = pipe.execute()
                return (
                    int(capacity) if capacity is not None else None,
                    decode_window_state(window),
                )
        except (RedisError, IndexError, ValueError):
            # Fail open if we could not read our own state. The limit is treated as unknown, which
            # lets the request through, and the response will repopulate it.
            return (None, None)

    def incr_usage(self, usage_key: str, expiration: int) -> int:
        """
        Increment the quota counter for the key and return its new value.

        :param usage_key: The location of the quota counter.
        :param expiration: The number of seconds until the key expires.
        """
        try:
            with self.cluster.pipeline() as pipe:
                pipe.incr(usage_key)
                pipe.expire(usage_key, expiration)
                return pipe.execute()[0]
        except (RedisError, IndexError):
            # Fail open if we could not properly handle the rate-limits. We may have miss the
            # increment of the usage key. This will eventually show up as a consumption of shared
            # quota. This could lead to starvation if this function fails at significant rates and
            # request volume for the allocated referrers is high.
            return 0

    def set_window_state(self, window_key: str, state: WindowState, expiration: int) -> None:
        """Record the service-provider's reported window state."""
        try:
            self.cluster.set(window_key, encode_window_state(state), ex=expiration)
        except RedisError:
            # The window state is refreshed by every response, so a dropped write costs us one
            # request's worth of accuracy.
            return None

    def get_accounted_usage(self, keys: list[str]) -> int:
        """Return the sum of a given set of keys."""
        try:
            with self.cluster.pipeline() as pipe:
                for key in keys:
                    pipe.get(key)

                values = pipe.execute(raise_on_error=True)
                assert len(values) == len(keys)
                return sum(int(k) for k in values if k is not None)
        except (AssertionError, RedisError):
            raise IndeterminateResult

    def set_key_values(self, kvs: dict[str, tuple[int, int | None]]) -> None:
        """For a given set of key, value pairs set them in the Redis Cluster."""
        try:
            with self.cluster.pipeline() as pipe:
                for key, (value, expiration) in kvs.items():
                    pipe.set(key, value, ex=expiration)
                pipe.execute()
        except RedisError:
            # Partial updates do not break the system. Shared quota or a total update may not
            # have been written. They can be written on the next request.
            return None


class IndeterminateResult(Exception): ...
