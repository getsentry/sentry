from typing import Mapping, Optional, Sequence, Tuple

from django.conf import settings

from sentry import options
from sentry.ratelimits.sliding_windows import (
    GrantedQuota,
    Quota,
    RedisSlidingWindowRateLimiter,
    RequestedQuota,
    Timestamp,
)
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import KeyCollection, KeyResult
from sentry.utils import metrics

writes_limiter = RedisSlidingWindowRateLimiter(
    **settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS
)


OrgId = int


def _build_quota_key(use_case_id: UseCaseKey, org_id: Optional[OrgId] = None) -> str:
    use_case_str = {
        UseCaseKey.PERFORMANCE: "performance",
        UseCaseKey.RELEASE_HEALTH: "releasehealth",
    }[use_case_id]

    if org_id is not None:
        return f"metrics-indexer-{use_case_str}-org-{org_id}"
    else:
        return f"metrics-indexer-{use_case_str}-global"


@metrics.wraps("sentry_metrics.indexer.construct_quotas")
def _construct_quotas() -> Mapping[UseCaseKey, Sequence[Quota]]:
    """
    Construct write limit's quotas based on current sentry options.

    This value can potentially cached globally as long as it is invalidated
    when sentry.options are.
    """
    return {
        UseCaseKey.PERFORMANCE: [
            Quota(prefix_override=_build_quota_key(UseCaseKey.PERFORMANCE, None), **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.performance.global")
        ]
        + [
            Quota(prefix_override=None, **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.performance.per-org")
        ],
        UseCaseKey.RELEASE_HEALTH: [
            Quota(prefix_override=_build_quota_key(UseCaseKey.RELEASE_HEALTH, None), **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.releasehealth.global")
        ]
        + [
            Quota(prefix_override=None, **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.releasehealth.per-org")
        ],
    }


@metrics.wraps("sentry_metrics.indexer.construct_quota_requests")
def _construct_quota_requests(
    use_case_id: UseCaseKey, keys: KeyCollection
) -> Tuple[Sequence[OrgId], Sequence[RequestedQuota]]:
    org_ids = []
    requests = []
    quotas = _construct_quotas()

    if quotas[use_case_id]:
        for org_id, strings in keys.mapping.items():
            org_ids.append(org_id)
            requests.append(
                RequestedQuota(
                    prefix=_build_quota_key(use_case_id, org_id),
                    requested=len(strings),
                    quotas=quotas[use_case_id],
                )
            )

    return org_ids, requests


RateLimitState = Tuple[Sequence[RequestedQuota], Sequence[GrantedQuota], Timestamp]


@metrics.wraps("sentry_metrics.indexer.check_write_limits")
def check_write_limits(
    use_case_id: UseCaseKey, keys: KeyCollection
) -> Tuple[RateLimitState, KeyCollection, Sequence[KeyResult]]:
    """
    Takes a KeyCollection and applies DB write limits as configured via sentry.options.

    Returns a tuple of:

    1. `RateLimitState` that needs to be passed to `apply_write_limits` in order
      to commit quotas upon successful DB write.

    2. A key collection containing all unmapped keys that passed through the
      rate limiter.

    3. All unmapped keys that did not pass through the rate limiter.
    """

    org_ids, requests = _construct_quota_requests(use_case_id, keys)
    timestamp, grants = writes_limiter.check_within_quotas(requests)

    granted_key_collection = dict(keys.mapping)
    dropped_key_results = []

    for org_id, request, grant in zip(org_ids, requests, grants):
        allowed_strings = granted_key_collection[org_id]
        if len(allowed_strings) > grant.granted:
            allowed_strings = set(allowed_strings)

            while len(allowed_strings) > grant.granted:
                dropped_key_results.append(
                    KeyResult(org_id=org_id, string=allowed_strings.pop(), id=None)
                )

        granted_key_collection[org_id] = allowed_strings

    state = requests, grants, timestamp
    return state, KeyCollection(granted_key_collection), dropped_key_results


@metrics.wraps("sentry_metrics.indexer.apply_write_limits")
def apply_write_limits(state: RateLimitState) -> None:
    """
    Consumes the rate limits returned by `check_write_limits`.
    """
    requests, grants, timestamp = state
    writes_limiter.use_quotas(requests, grants, timestamp)
