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

# The cumulative issued and completed counters are compared by difference, so they are only
# meaningful while they move in lockstep. Give both the same generous TTL, refreshed on every
# increment, so an idle integration's counters expire together instead of persisting forever and
# so neither key sits in Redis without an expiry.
CUMULATIVE_USAGE_TTL_SECONDS = 86400

# Compare-and-set for the window state key. Implemented as a Lua script because the cluster
# clients used in production do not support WATCH/MULTI pipelines, and any exception those
# pipelines raise is not a `RedisError`.
set_window_state_script = redis.load_redis_script("scm/set_window_state.lua")


def usage_count_key(
    provider: str, integration_id: int, time_bucket: int, referrer: str, resource: str
) -> str:
    return f"rl:scm:{provider}:{integration_id}:{resource}:{referrer}:{time_bucket}"


def total_limit_key(provider: str, integration_id: int, resource: str) -> str:
    return f"limit:scm:{provider}:{integration_id}:{resource}"


def window_state_key(provider: str, integration_id: int, resource: str) -> str:
    return f"window:scm:{provider}:{integration_id}:{resource}"


def total_usage_key(provider: str, integration_id: int, referrer: str, resource: str) -> str:
    return f"usage:scm:{provider}:{integration_id}:{resource}:{referrer}"


def completed_usage_key(
    provider: str, integration_id: int, window_end: int, referrer: str, resource: str
) -> str:
    return f"completed:scm:{provider}:{integration_id}:{resource}:{referrer}:{window_end}"


def completed_total_usage_key(
    provider: str, integration_id: int, referrer: str, resource: str
) -> str:
    return f"completed-total:scm:{provider}:{integration_id}:{resource}:{referrer}"


@dataclass(frozen=True)
class WindowState:
    """
    The service-provider's own accounting of the current rate-limit window.

    :param used: Quota the provider says has been consumed in this window, across all referrers.
    :param reset: The epoch second at which the provider's window rolls over.
    :param local_used: Shared requests known to be represented by this provider report.
    :param reserved_used: Completed reserved requests represented by this provider report.
    """

    used: int
    reset: int
    local_used: int | None = None
    reserved_used: int | None = None


@dataclass(frozen=True)
class RateLimitCheck:
    is_limited: bool
    local_used: int
    referrer: str = "shared"
    window_end: int = 0
    shared_completed: int = 0
    reserved_completed: int = 0


def encode_window_state(state: WindowState) -> str:
    value = f"{state.used}:{state.reset}"
    if state.local_used is None and state.reserved_used is None:
        return value
    local_used = "" if state.local_used is None else state.local_used
    if state.reserved_used is None:
        return f"{value}:{local_used}"
    return f"{value}:{local_used}:{state.reserved_used}"


def decode_window_state(value: str | None) -> WindowState | None:
    if not value:
        return None

    parts = value.split(":")
    try:
        if len(parts) == 2:
            return WindowState(used=int(parts[0]), reset=int(parts[1]))
        if len(parts) == 3:
            return WindowState(
                used=int(parts[0]),
                reset=int(parts[1]),
                local_used=int(parts[2]) if parts[2] else None,
            )
        if len(parts) == 4:
            return WindowState(
                used=int(parts[0]),
                reset=int(parts[1]),
                local_used=int(parts[2]) if parts[2] else None,
                reserved_used=int(parts[3]) if parts[3] else None,
            )
    except (TypeError, ValueError):
        return None
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

        Raises `IndeterminateResult` if the state could not be read.

        :param total_key: The location of the request limit.
        :param window_key: The location of the reported window state.
        """
        ...

    def incr_usage(self, usage_key: str, total_usage_key: str, expiration: int) -> tuple[int, int]:
        """
        Increment the window and cumulative quota counters and return their new values.

        :param usage_key: The location of the quota counter.
        :param total_usage_key: The location of the cumulative quota counter.
        :param expiration: The number of seconds until the key expires.
        """
        ...

    def set_window_state(self, window_key: str, state: WindowState, expiration: int) -> None:
        """Record the service-provider's reported window state."""
        ...

    def incr_completed_usage(self, usage_key: str, expiration: int) -> None:
        """Increment a completed-request counter."""
        ...

    def get_usage_counts(self, keys: list[str]) -> list[int]:
        """
        Return the counter value for each key, with missing keys counted as zero.

        Raises `IndeterminateResult` if the counters could not be read.
        """
        ...

    def set_key_values(self, kvs: dict[str, tuple[int, int | None]]) -> None:
        """For a given set of key, value pairs set them in the Redis Cluster."""
        ...


class DynamicRateLimiter:
    """
    Quota management class for external rate-limits with dynamic, per-organization request limits.

    The `DynamicRateLimiter` class operates as a mirror of an externally managed rate limiter. It
    attempts to load-shed requests when it thinks a quota allocation has been exceeded.

    Two sources of truth are combined. The service-provider's reported usage, recorded by
    `update_rate_limit_meta` from response metadata, is authoritative for everything it has
    answered. Completion snapshots captured before a request identify local work guaranteed to be
    represented by its eventual report. Requests not completed at that point are added without
    assuming provider responses arrive in issuance order. The window counter remains a conservative
    fallback if either source is missing.

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

    def is_live_window(self, current_time: int, window: WindowState, resource: str) -> bool:
        """Return whether the provider reset is live and plausibly near."""
        max_reset = current_time + (self.window_seconds(resource) * MAX_WINDOW_TTL_MULTIPLIER)
        return current_time < window.reset <= max_reset

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

        if window is not None and self.is_live_window(current_time, window, resource):
            return window.reset

        # We have no live, plausible reset from the provider, so assume a tumbling window of the
        # configured length.
        elapsed = int(current_time % window_seconds)
        return current_time - elapsed + window_seconds

    def normalize_referrer(self, referrer: str) -> str:
        return referrer if referrer in self.referrer_allocation else "shared"

    def check_rate_limit(self, referrer: str, resource: str) -> RateLimitCheck:
        """
        Return the rate-limit decision and the cumulative local count for this request.

        Every call increments the cumulative issued counter, so callers must pair it with a
        `record_completed_request` call once the request settles; unpaired calls permanently
        inflate the in-flight estimate.

        This check is best-effort and is not guaranteed to prevent a rate-limit error response from
        a service-provider.
        """

        referrer = self.normalize_referrer(referrer)

        current_time = self.get_time_in_seconds()

        try:
            service_capacity, window = self.rate_limit_provider.get_rate_limit_state(
                total_limit_key(self.provider, self.integration_id, resource),
                window_state_key(self.provider, self.integration_id, resource),
            )
            # We can cache this value to skip the service_capacity set operation. It saves us from
            # writing the same capacity value over and over again. The cached capacity is preserved
            # across multiple callers meaning this caching, though local to the dynamic rate
            # limiter, enjoys global population semantics.
            self.recorded_capacity[resource] = service_capacity
        except IndeterminateResult:
            # The read failed; fail open. A failed read says nothing about what Redis holds, so
            # the capacity cache is left alone -- clobbering it would force a redundant capacity
            # rewrite on the next response.
            service_capacity, window = None, None

        window_end = self.window_end(current_time, window, resource)
        quota_used, local_used = self.rate_limit_provider.incr_usage(
            usage_count_key(self.provider, self.integration_id, window_end, referrer, resource),
            total_usage_key(self.provider, self.integration_id, referrer, resource),
            window_end - current_time,
        )
        shared_completed, reserved_completed = self._completion_snapshots(window_end, resource)

        # The provider reports usage across every referrer, so it can only be reconciled against
        # the shared pool, and only after the quota reserved referrers have accounted for is
        # deducted from it. A report whose window has already closed describes usage the provider
        # has forgiven, so it must not be charged into the window we are in now.
        if (
            window is not None
            and self.is_live_window(current_time, window, resource)
            and referrer == "shared"
        ):
            reported_usage = max(0, window.used - (window.reserved_used or 0))
            if window.local_used is not None:
                in_flight = max(0, local_used - window.local_used)
                if service_capacity is not None and in_flight > service_capacity:
                    # More in-flight requests than the provider's total capacity is implausible.
                    # The issued and completed counters have desynced -- an evicted key, lost
                    # completions -- so the difference is meaningless. Fall back to the report
                    # alone rather than charging the phantom backlog forever.
                    in_flight = 0
                reported_usage += in_flight
            quota_used = max(quota_used, reported_usage)

        # If no limit could be found we fail open. We'll populate the limit on the other-side of the
        # HTTP request.
        if service_capacity is None:
            return RateLimitCheck(
                is_limited=False,
                local_used=local_used,
                referrer=referrer,
                window_end=window_end,
                shared_completed=shared_completed,
                reserved_completed=reserved_completed,
            )

        # If the referrer exists in the allocation pool then we compute its capacity otherwise we
        # need to compute the total unallocated "shared" capacity.
        if referrer == "shared":
            referrer_capacity = int(
                service_capacity * (1.0 - sum(self.referrer_allocation.values()))
            )
        else:
            referrer_capacity = int(service_capacity * self.referrer_allocation[referrer])

        return RateLimitCheck(
            is_limited=quota_used > referrer_capacity,
            local_used=local_used,
            referrer=referrer,
            window_end=window_end,
            shared_completed=shared_completed,
            reserved_completed=reserved_completed,
        )

    def record_completed_request(
        self, referrer: str, resource: str, window_end: int | None
    ) -> None:
        """Record that a local request is no longer in flight."""
        referrer = self.normalize_referrer(referrer)
        if referrer == "shared":
            self.rate_limit_provider.incr_completed_usage(
                completed_total_usage_key(
                    self.provider,
                    self.integration_id,
                    referrer,
                    resource,
                ),
                CUMULATIVE_USAGE_TTL_SECONDS,
            )
            return None

        if window_end is None:
            return None

        current_time = self.get_time_in_seconds()
        window = WindowState(used=0, reset=window_end)
        if not self.is_live_window(current_time, window, resource):
            return None

        self.rate_limit_provider.incr_completed_usage(
            completed_usage_key(
                self.provider,
                self.integration_id,
                window_end,
                referrer,
                resource,
            ),
            window_end - current_time,
        )
        return None

    def report_usage_snapshots(self, check: RateLimitCheck, window_end: int) -> tuple[int, int]:
        """Return local usage known to be represented by this request's provider report."""
        shared_used = check.shared_completed + int(check.referrer == "shared")
        reserved_used = int(check.referrer != "shared")
        if check.window_end == window_end:
            reserved_used += check.reserved_completed
        return shared_used, reserved_used

    def _completion_snapshots(self, window_end: int, resource: str) -> tuple[int, int]:
        """
        Return the completed shared usage and the completed reserved usage for a window.

        Both counters are fetched in a single round trip. If they cannot be read, both snapshot to
        zero: treating no shared requests as represented and deducting no reserved usage each
        overstate shared usage, which is the conservative direction.
        """
        shared_key = completed_total_usage_key(
            self.provider,
            self.integration_id,
            "shared",
            resource,
        )
        reserved_keys = [
            completed_usage_key(
                self.provider,
                self.integration_id,
                window_end,
                referrer,
                resource,
            )
            for referrer in self.referrer_allocation
        ]

        try:
            counts = self.rate_limit_provider.get_usage_counts([shared_key, *reserved_keys])
        except IndeterminateResult:
            return 0, 0
        return counts[0], sum(counts[1:])

    def update_rate_limit_meta(
        self,
        capacity: int,
        consumed: int,
        next_window_start: int,
        resource: str,
        local_used: int | None = None,
        reserved_used: int | None = None,
    ) -> None:
        """Update the store with select rate-limit metadata."""
        self.set_total_capacity(capacity, resource)
        self.set_window_state(consumed, next_window_start, resource, local_used, reserved_used)

    def set_total_capacity(self, capacity: int, resource: str) -> None:
        """Set the service capacity if it does not match what already exists."""
        if capacity != self.recorded_capacity.get(resource):
            key = total_limit_key(self.provider, self.integration_id, resource)
            self.rate_limit_provider.set_key_values({key: (capacity, None)})
            self.recorded_capacity[resource] = capacity
        return None

    def set_window_state(
        self,
        consumed: int,
        next_window_start: int,
        resource: str,
        local_used: int | None = None,
        reserved_used: int | None = None,
    ) -> None:
        """Record the service-provider's own accounting of the current window."""
        current_time = self.get_time_in_seconds()
        reported_window = WindowState(used=consumed, reset=next_window_start)
        if not self.is_live_window(current_time, reported_window, resource):
            # A closed or implausibly distant window tells us nothing about current consumption.
            return None

        state = WindowState(
            used=consumed,
            reset=next_window_start,
            local_used=local_used,
            reserved_used=reserved_used,
        )
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

        Raises `IndeterminateResult` if the state could not be read.

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
            # The caller fails open on an unreadable state. The limit is treated as unknown, which
            # lets the request through, and the response will repopulate it.
            raise IndeterminateResult

    def incr_usage(self, usage_key: str, total_usage_key: str, expiration: int) -> tuple[int, int]:
        """
        Increment the window and cumulative quota counters and return their new values.

        :param usage_key: The location of the quota counter.
        :param total_usage_key: The location of the cumulative quota counter.
        :param expiration: The number of seconds until the key expires.
        """
        try:
            with self.cluster.pipeline() as pipe:
                pipe.incr(usage_key)
                pipe.expire(usage_key, expiration)
                pipe.incr(total_usage_key)
                pipe.expire(total_usage_key, CUMULATIVE_USAGE_TTL_SECONDS)
                usage, _, total_usage, _ = pipe.execute()
                return usage, total_usage
        except (RedisError, IndexError):
            # Fail open if we could not properly handle the rate-limits. We may have miss the
            # increment of the usage key. This will eventually show up as a consumption of shared
            # quota. This could lead to starvation if this function fails at significant rates and
            # request volume for the allocated referrers is high.
            return (0, 0)

    def set_window_state(self, window_key: str, state: WindowState, expiration: int) -> None:
        """Record the service-provider's reported window state."""
        try:
            set_window_state_script(
                [window_key],
                [state.used, state.reset, encode_window_state(state), expiration],
                self.cluster,
            )
        except Exception:
            # The window state is refreshed by every response, so a dropped write costs us one
            # request's worth of accuracy. Cluster clients raise exceptions that are not
            # `RedisError` subclasses, so contain everything.
            return None

    def incr_completed_usage(self, usage_key: str, expiration: int) -> None:
        """Increment a completed-request counter."""
        try:
            with self.cluster.pipeline() as pipe:
                pipe.incr(usage_key)
                pipe.expire(usage_key, expiration)
                pipe.execute()
        except RedisError:
            # Missing completed usage overstates shared usage, which is the conservative direction.
            return None

    def get_usage_counts(self, keys: list[str]) -> list[int]:
        """
        Return the counter value for each key, with missing keys counted as zero.

        Raises `IndeterminateResult` if the counters could not be read.
        """
        try:
            with self.cluster.pipeline() as pipe:
                for key in keys:
                    pipe.get(key)

                values = pipe.execute(raise_on_error=True)
                assert len(values) == len(keys)
                return [int(value) if value is not None else 0 for value in values]
        except (AssertionError, RedisError, ValueError):
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
