from collections.abc import Callable
from typing import Protocol

from django.conf import settings
from redis import RedisError

from sentry.utils import redis


def usage_count_key(provider: str, integration_id: int, time_bucket: int, referrer: str) -> str:
    return f"rl:scm:{provider}:{integration_id}:{referrer}:{time_bucket}"


def total_limit_key(provider: str, integration_id: int) -> str:
    return f"limit:scm:{provider}:{integration_id}"


class RateLimitProvider(Protocol):
    """
    Type definition for rate-limit service providers. Service providers could be Redis, local
    in-memory, an RDBMS, or anything really (so long as it persists state between requests). In
    practice this will always be Redis but we define the type so we can simplify testing and
    simulation.
    """

    def get_and_set_rate_limit(
        self, total_key: str, usage_key: str, expiration: int
    ) -> tuple[int | None, int]:
        """
        Get the request limit and incr/expire quota usage for the key.

        :param total_key: The location of the request limit.
        :param usage_key: The location of the quota counter.
        :param expiration: The number of seconds until the key expires.
        """
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

    The `DynamicRateLimiter` class operates as a mirror of an externally managed rate limiter. This
    call will attempt to load-shed requests when it thinks a quota allocation has been exceeded.
    We do not attempt to synchronize with the source. This requires every outbound request to utilize
    this class otherwise the counters will de-sync.

    :param get_time_in_seconds: Get the current UTC timestamp in seconds.
    :param integration_id: The integration we're scoped to.
    :param provider: The service-provider we received rate-limit headers from.
    :param rate_limit_window_seconds: The number of seconds in a rate-limit window.
    :param referrer_allocation: The referrer allocation pool we're working with.
    """

    def __init__(
        self,
        get_time_in_seconds: Callable[[], int],
        integration_id: int,
        provider: str,
        rate_limit_provider: RateLimitProvider,
        rate_limit_window_seconds: int,
        referrer_allocation: dict[str, float],
    ) -> None:
        self.get_time_in_seconds = get_time_in_seconds
        self.integration_id = integration_id
        self.provider = provider
        self.rate_limit_provider = rate_limit_provider
        self.rate_limit_window_seconds = rate_limit_window_seconds
        self.referrer_allocation = referrer_allocation
        self.recorded_capacity: int | None = None

    def is_rate_limited(self, referrer: str) -> bool:
        """
        Returns true if the quota for this organization has been exhausted.

        This check is best-effort and is not guaranteed to prevent a rate-limit error response from
        a service-provider.
        """

        if referrer not in self.referrer_allocation:
            referrer = "shared"

        # Find the bucket ID of the request. The bucket ID is the number of windows which have
        # previously elapsed.
        current_time = self.get_time_in_seconds()
        time_bucket = current_time // self.rate_limit_window_seconds

        # Computed as the window minus the number seconds elapsed within the window. So if our window
        # is 100 seconds and 10 seconds of the current window has already elapsed then the remaining
        # time is 90 seconds.
        expires_in = self.rate_limit_window_seconds - int(
            current_time % self.rate_limit_window_seconds
        )

        # Get the total capacity of the service-provider and the amount of quota we've consumed for
        # a given referrer. If the referrer does not exist in the allocation pool
        service_capacity, quota_used = self.rate_limit_provider.get_and_set_rate_limit(
            total_limit_key(self.provider, self.integration_id),
            usage_count_key(self.provider, self.integration_id, time_bucket, referrer),
            expires_in,
        )

        # We can cache this value to skip the service_capacity set operation. It saves us from writing
        # the same capacity value over and over again. The cached capacity is preserved across multiple
        # callers meaning this caching, though local to the dynamic rate limiter, enjoys global
        # population semantics.
        self.recorded_capacity = service_capacity

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

    def update_rate_limit_meta(self, capacity: int, consumed: int, next_window_start: int) -> None:
        """Update the store with select rate-limit metadata."""
        self.set_total_capacity(capacity)

    def set_total_capacity(self, capacity: int) -> None:
        """Set the service capacity if it does not match what already exists."""
        if capacity != self.recorded_capacity:
            key = total_limit_key(self.provider, self.integration_id)
            self.rate_limit_provider.set_key_values({key: (capacity, None)})
        return None


class RedisRateLimitProvider:
    def __init__(self):
        self.cluster = redis.redis_clusters.get(settings.SENTRY_SCM_REDIS_CLUSTER)

    def get_and_set_rate_limit(
        self,
        total_key: str,
        usage_key: str,
        expiration: int,
    ) -> tuple[int | None, int]:
        """
        Get the request limit and incr/expire quota usage for the key.

        :param total_key: The location of the request limit.
        :param usage_key: The location of the quota counter.
        :param expiration: The number of seconds until the key expires.
        """
        try:
            with self.cluster.pipeline() as pipe:
                pipe.get(total_key)
                pipe.incr(usage_key)
                pipe.expire(usage_key, expiration)

                result = pipe.execute()
                return (int(result[0]) if result[0] is not None else None, result[1])
        except (RedisError, IndexError):
            # Fail open if we could not properly handle the rate-limits. We may have miss the
            # increment of the usage key. This will eventually show up as a consumption of shared
            # quota. This could lead to starvation if this function fails at significant rates and
            # request volume for the allocated referrers is high.
            return (None, 0)

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
