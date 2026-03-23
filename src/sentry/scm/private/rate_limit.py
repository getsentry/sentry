import functools
from typing import Callable

from django.conf import settings

from sentry.scm.types import Referrer
from sentry.utils import redis


def usage_count_key(provider: str, organization_id: int, window: int, referrer: str) -> str:
    return f"rl:scm:{provider}:{organization_id}:{referrer}:{window}"


def total_limit_key(provider: str, organization_id: int) -> str:
    return f"limit:scm:{provider}:{organization_id}"


def is_rate_limited(
    provider: str,
    organization_id: int,
    referrer: Referrer,
    referrer_allocation: dict[Referrer, float],
    rate_limit_window_seconds: int,
    get_and_set_rate_limit: Callable[[str, str, int], tuple[int | None, int]],
    get_time_in_seconds: Callable[[], int],
) -> bool:
    """
    Returns true if the quota for this organization has been exhausted.

    This check is best-effort and is not guaranteed to prevent a rate-limit error response from
    a service-provider.

    :param provider: The service-provider we received rate-limit headers from.
    :param organization_id: The organization-id we're scoped to.
    :param referrer: The referrer being used to make a request.
    :param referrer_allocation: The referrer allocation pool we're working with.
    :param rate_limit_window_seconds: The number of seconds in a rate-limit window.
    :param get_and_set_rate_limit: Get the cached request limit, incr the usage key, and return the usage key.
    :param get_time_in_seconds: Get the current UTC timestamp in seconds.
    """
    assert referrer == "shared" or referrer in referrer_allocation, (
        'Referrer must exist in the allocation pool. Pass "shared" if no allocation was defined.'
    )

    # Find the bucket ID of the request. The bucket ID is the number of windows which have
    # previously elapsed.
    current_time = get_time_in_seconds()
    time_bucket = current_time // rate_limit_window_seconds

    # Computed as the window minus the number seconds elapsed within the window. So if our window
    # is 100 seconds and 10 seconds of the current window has already elapsed then the remaining
    # time is 90 seconds.
    expires_in = rate_limit_window_seconds - int(current_time % rate_limit_window_seconds)

    # Get the total capacity of the service-provider and the amount of quota we've consumed for
    # a given referrer. If the referrer does not exist in the allocation pool
    service_capacity, quota_used = get_and_set_rate_limit(
        total_limit_key(provider, organization_id),
        usage_count_key(provider, organization_id, time_bucket, referrer),
        expires_in,
    )

    # If no limit could be found we fail open. We'll populate the limit on the other-side of the
    # HTTP request.
    if service_capacity is None:
        return False

    # If the referrer exists in the allocation pool then we compute its capacity otherwise we need
    # to compute the total unallocated "shared" capacity.
    if referrer == "shared":
        referrer_capacity = int(service_capacity * (1.0 - sum(referrer_allocation.values())))
    else:
        referrer_capacity = int(service_capacity * referrer_allocation[referrer])

    return quota_used >= referrer_capacity


def update_rate_limits_from_provider(
    provider: str,
    organization_id: int,
    referrer_allocation: dict[Referrer, float],
    recorded_limit: int,
    specified_limit: int,
    specified_usage: int,
    specified_next_window_start: int,
    rate_limit_window_seconds: int,
    get_accounted_usage: Callable[[list[str]], int],
    get_time_in_seconds: Callable[[], int],
    set_key_values: Callable[[dict[str, tuple[int, int | None]]], None],
) -> None:
    """
    Some service-providers offer dynamic rate-limits per organization. We need to cache the
    metadata service-providers return in their responses and use that metadata to rate-limit our
    own requests eagerly.

    :param provider: The service-provider we received rate-limit headers from.
    :param organization_id: The organization-id we're scoped to.
    :param referrer_allocation: The referrer allocation pool we're working with.
    :param recorded_limit: Sentry's understanding of the total number of requests available per window.
    :param specified_limit: The actual total number of requests available per window.
    :param specified_usage: The total number of requests the service-provider is telling us they have received.
    :param specified_next_window_start: The next rate-limit window after the current window.
    :param rate_limit_window_seconds: The number of seconds in a rate-limit window.
    :param get_accounted_usage: Return the total number of requests issued by the SCM for a given referrer.
    :param get_time_in_seconds: Get the current UTC timestamp in seconds.
    :param set_key_values: Set a dictionary of key, value pairs into a semi-persistent store.
    """
    # We need to figure out what window Sentry thinks its in and what window the service-provider
    # thinks its in.
    current_time = get_time_in_seconds()
    time_bucket = current_time // rate_limit_window_seconds

    # TODO: This might be a little GitHub specific but we don't have another usage example.
    specified_bucket = (specified_next_window_start // rate_limit_window_seconds) - 1

    kvs = {}

    # If the limit we have recorded in Sentry is different from the rate-limit recording in
    # the service-provider we need to update our limit to match.
    if recorded_limit != specified_limit:
        kvs[total_limit_key(provider, organization_id)] = (specified_limit, None)

    # If we share the same window as the service-provider we can update our rate-limits to match
    # what the service-provider recorded. It doesn't matter if we're perfect.
    if time_bucket == specified_bucket:
        key_fn = functools.partial(usage_count_key, provider, organization_id, time_bucket)

        # Computed as the window minus the number seconds elapsed within the window. So if our window
        # is 100 seconds and 10 seconds of the current window has already elapsed then the remaining
        # time is 90 seconds.
        expiration = rate_limit_window_seconds - int(current_time % rate_limit_window_seconds)

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
        accounted_usage = get_accounted_usage(
            [key_fn(referrer) for referrer in referrer_allocation]
        )
        kvs[key_fn("shared")] = (max(0, specified_usage - accounted_usage), expiration)

    if kvs:
        set_key_values(kvs)


def get_and_set_rate_limit(
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
    with redis.redis_clusters.get(settings.SENTRY_SCM_REDIS_CLUSTER).pipeline() as pipe:
        pipe.get(total_key)
        pipe.incr(usage_key)
        pipe.expire(usage_key, expiration)

        result = pipe.execute()
        return (int(result[0]) if result[0] is not None else None, result[1])


def get_accounted_usage(keys: list[str]) -> int:
    """Return the sum of a given set of keys."""
    with redis.redis_clusters.get(settings.SENTRY_SCM_REDIS_CLUSTER).pipeline() as pipe:
        for key in keys:
            pipe.get(key)
        return sum(int(r) for r in pipe.execute() if r is not None)


def set_key_values(kvs: dict[str, tuple[int, int | None]]) -> None:
    """For a given set of key, value pairs set them in the Redis Cluster."""
    with redis.redis_clusters.get(settings.SENTRY_SCM_REDIS_CLUSTER).pipeline() as pipe:
        for key, (value, expiration) in kvs.items():
            pipe.set(key, value, ex=expiration)
        pipe.execute()
