import functools
from typing import Callable

from sentry.scm.types import Referrer


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
    get_and_set_rate_limit: Callable[[str, str], tuple[int | None, int]],
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

    # Find the window of the request. GitHub's rate-limit window is always the current hour.
    window = get_time_in_seconds() // rate_limit_window_seconds

    # Get the total capacity of the service-provider and the amount of quota we've consumed for
    # a given referrer. If the referrer does not exist in the allocation pool
    service_capacity, quota_used = get_and_set_rate_limit(
        total_limit_key(provider, organization_id),
        usage_count_key(provider, organization_id, window, referrer),
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
    specified_next_window: int,
    rate_limit_window_seconds: int,
    get_accounted_usage: Callable[[list[str]], int],
    get_time_in_seconds: Callable[[], int],
    set_key_values: Callable[[dict[str, int]], None],
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
    :param specified_next_window: The next rate-limit window after the current window.
    :param rate_limit_window_seconds: The number of seconds in a rate-limit window.
    :param get_accounted_usage: Return the total number of requests issued by the SCM for a given referrer.
    :param get_time_in_seconds: Get the current UTC timestamp in seconds.
    :param set_key_values: Set a dictionary of key, value pairs into a semi-persistent store.
    """
    # We need to figure out what window Sentry thinks its in and what window the service-provider
    # thinks its in.
    window = get_time_in_seconds() // rate_limit_window_seconds

    # TODO: This might be a little GitHub specific but we don't have another usage example.
    specified_window = (specified_next_window // rate_limit_window_seconds) - 1

    kvs = {}

    # If the limit we have recorded in Sentry is different from the rate-limit recording in
    # the service-provider we need to update our limit to match.
    if recorded_limit != specified_limit:
        kvs[total_limit_key(provider, organization_id)] = specified_limit

    # If we share the same window as the service-provider we can update our rate-limits to match
    # what the service-provider recorded. It doesn't matter if we're perfect.
    if window == specified_window:
        key_fn = functools.partial(usage_count_key, provider, organization_id, window)

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
        kvs[key_fn("shared")] = max(0, specified_usage - accounted_usage)

    if kvs:
        set_key_values(kvs)
