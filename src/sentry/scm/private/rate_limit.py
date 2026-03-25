import functools
from typing import Callable, Protocol

from django.conf import settings

from sentry.scm.types import Referrer
from sentry.utils import redis


def usage_count_key(provider: str, organization_id: int, time_bucket: int, referrer: str) -> str:
    return f"rl:scm:{provider}:{organization_id}:{referrer}:{time_bucket}"


def total_limit_key(provider: str, organization_id: int) -> str:
    return f"limit:scm:{provider}:{organization_id}"


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

    The `DynamicRateLimiter` class operates as an eventually consistent mirror of an externally
    managed rate limiter. This class defines best-effort load shedding behavior. Because we will
    never be consistent with the primary our goal is to reasonably allocate traffic between
    referrers. We offer no guarantees that this class will actually reserve quota. It should more
    accurately be thought of as a load-shedding heuristic where unallocated referrer requests are
    eagerly dropped.

    :param get_time_in_seconds: Get the current UTC timestamp in seconds.
    :param organization_id: The organization-id we're scoped to.
    :param provider: The service-provider we received rate-limit headers from.
    :param rate_limit_window_seconds: The number of seconds in a rate-limit window.
    :param referrer_allocation: The referrer allocation pool we're working with.
    :param referrer: The referrer being used to make a request.
    """

    def __init__(
        self,
        get_time_in_seconds: Callable[[], int],
        organization_id: int,
        provider: str,
        rate_limit_provider: RateLimitProvider,
        rate_limit_window_seconds: int,
        referrer_allocation: dict[Referrer, float],
        recorded_capacity: int | None = None,
    ) -> None:
        self.get_time_in_seconds = get_time_in_seconds
        self.organization_id = organization_id
        self.provider = provider
        self.rate_limit_provider = rate_limit_provider
        self.rate_limit_window_seconds = rate_limit_window_seconds
        self.referrer_allocation = referrer_allocation
        self.recorded_capacity = recorded_capacity

    def is_rate_limited(self, referrer: Referrer) -> bool:
        """
        Returns true if the quota for this organization has been exhausted.

        This check is best-effort and is not guaranteed to prevent a rate-limit error response from
        a service-provider.
        """
        assert referrer == "shared" or referrer in self.referrer_allocation, (
            'Referrer must exist in the allocation pool. Pass "shared" if no allocation was defined.'
        )

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
            total_limit_key(self.provider, self.organization_id),
            usage_count_key(self.provider, self.organization_id, time_bucket, referrer),
            expires_in,
        )

        # If no limit could be found we fail open. We'll populate the limit on the other-side of the
        # HTTP request.
        if service_capacity is None:
            return False

        # Cache this value on the class instance. We'll return back to it later when updating the
        # rate-limit metadata.
        self.recorded_capacity = service_capacity

        # If the referrer exists in the allocation pool then we compute its capacity otherwise we
        # need to compute the total unallocated "shared" capacity.
        if referrer == "shared":
            referrer_capacity = int(
                service_capacity * (1.0 - sum(self.referrer_allocation.values()))
            )
        else:
            referrer_capacity = int(service_capacity * self.referrer_allocation[referrer])

        return quota_used >= referrer_capacity

    def update_rate_limit_meta(self, capacity: int, consumed: int, next_window_start: int) -> None:
        """
        Some service-providers offer dynamic rate-limits per organization. We need to cache the
        metadata service-providers return in their API responses and use that metadata to rate-
        limit our own requests eagerly.

        :param capacity: The actual total number of requests available per window.
        :param consumed: The total number of requests the service-provider is telling us they have received.
        :param next_window_start: The next rate-limit window after the current window.
        """
        # We need to figure out what window Sentry thinks its in and what window the service-provider
        # thinks its in.
        current_time = self.get_time_in_seconds()
        time_bucket = current_time // self.rate_limit_window_seconds

        # TODO: This might be a little GitHub specific but we don't have another usage example.
        specified_bucket = (next_window_start // self.rate_limit_window_seconds) - 1

        kvs: dict[str, tuple[int, int | None]] = {}

        # If the limit we have recorded in Sentry is different from the rate-limit recording in
        # the service-provider we need to update our limit to match.
        if self.recorded_capacity != capacity:
            kvs[total_limit_key(self.provider, self.organization_id)] = (capacity, None)

        # If we share the same window as the service-provider we can update our rate-limits to match
        # what the service-provider recorded. It doesn't matter if we're perfect.
        if time_bucket == specified_bucket:
            key_fn = functools.partial(
                usage_count_key, self.provider, self.organization_id, time_bucket
            )

            # Computed as the window minus the number seconds elapsed within the window. So if our window
            # is 100 seconds and 10 seconds of the current window has already elapsed then the remaining
            # time is 90 seconds.
            expiration = self.rate_limit_window_seconds - int(
                current_time % self.rate_limit_window_seconds
            )

            # The shared usage is the delta of the accounted usage and the reported usage. This
            # value is expected to be strictly higher than our accounted shared usage because a
            # significant portion of Sentry accesses GitHub without passing through the rate-limiter.
            #
            # We will only throttle usage generated by the SCM using a shared referrer so this is
            # strictly worse for early adopters in the shared pool. However, we will hopefully solve
            # this problem relatively quickly.
            #
            # We don't look up our shared usage. It doesn't matter if its non-zero. The shared usage
            # is what GitHub says it is. The accounted usage is what we say it is.
            #
            # TODO: If one day a significant majority of usage of GitHub transits the SCM this can
            #       go away and we can just set the limit blindly.
            accounted_usage = self.rate_limit_provider.get_accounted_usage(
                [key_fn(referrer) for referrer in self.referrer_allocation]
            )
            kvs[key_fn("shared")] = (max(0, consumed - accounted_usage), expiration)

        if kvs:
            self.rate_limit_provider.set_key_values(kvs)


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
        with self.cluster.pipeline() as pipe:
            pipe.get(total_key)
            pipe.incr(usage_key)
            pipe.expire(usage_key, expiration)

            result = pipe.execute()
            return (int(result[0]) if result[0] is not None else None, result[1])

    def get_accounted_usage(self, keys: list[str]) -> int:
        """Return the sum of a given set of keys."""
        with self.cluster.pipeline() as pipe:
            for key in keys:
                pipe.get(key)
            return sum(int(r) for r in pipe.execute() if r is not None)

    def set_key_values(self, kvs: dict[str, tuple[int, int | None]]) -> None:
        """For a given set of key, value pairs set them in the Redis Cluster."""
        with self.cluster.pipeline() as pipe:
            for key, (value, expiration) in kvs.items():
                pipe.set(key, value, ex=expiration)
            pipe.execute()
