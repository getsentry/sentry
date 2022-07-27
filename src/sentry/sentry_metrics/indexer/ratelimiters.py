import dataclasses
from typing import MutableMapping, Optional, Sequence, Tuple

from sentry import options
from sentry.ratelimits.sliding_windows import (
    GrantedQuota,
    Quota,
    RedisSlidingWindowRateLimiter,
    RequestedQuota,
    Timestamp,
)
from sentry.sentry_metrics.configuration import UseCaseKey, get_ingest_config
from sentry.sentry_metrics.indexer.base import FetchType, FetchTypeExt, KeyCollection, KeyResult
from sentry.utils import metrics

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
def _construct_quotas(use_case_id: UseCaseKey) -> Sequence[Quota]:
    """
    Construct write limit's quotas based on current sentry options.

    This value can potentially cached globally as long as it is invalidated
    when sentry.options are.
    """
    if use_case_id == UseCaseKey.PERFORMANCE:
        return [
            Quota(prefix_override=_build_quota_key(UseCaseKey.PERFORMANCE, None), **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.performance.global")
        ] + [
            Quota(prefix_override=None, **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.performance.per-org")
        ]
    elif use_case_id == UseCaseKey.RELEASE_HEALTH:
        return [
            Quota(prefix_override=_build_quota_key(UseCaseKey.RELEASE_HEALTH, None), **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.releasehealth.global")
        ] + [
            Quota(prefix_override=None, **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.releasehealth.per-org")
        ]
    else:
        raise ValueError(use_case_id)


@metrics.wraps("sentry_metrics.indexer.construct_quota_requests")
def _construct_quota_requests(
    use_case_id: UseCaseKey, keys: KeyCollection
) -> Tuple[Sequence[OrgId], Sequence[RequestedQuota]]:
    org_ids = []
    requests = []
    quotas = _construct_quotas(use_case_id)

    if quotas:
        for org_id, strings in keys.mapping.items():
            org_ids.append(org_id)
            requests.append(
                RequestedQuota(
                    prefix=_build_quota_key(use_case_id, org_id),
                    requested=len(strings),
                    quotas=quotas,
                )
            )

    return org_ids, requests


@dataclasses.dataclass
class RateLimitState:
    use_case_id: UseCaseKey
    requests: Sequence[RequestedQuota]
    grants: Sequence[GrantedQuota]
    timestamp: Timestamp


class WritesLimiter:
    def __init__(self) -> None:
        self.rate_limiters: MutableMapping[UseCaseKey, RedisSlidingWindowRateLimiter] = {}

    def _get_rate_limiter(self, use_case_id: UseCaseKey) -> RedisSlidingWindowRateLimiter:
        if use_case_id not in self.rate_limiters:
            options = get_ingest_config(use_case_id).writes_limiter_cluster_options
            self.rate_limiters[use_case_id] = RedisSlidingWindowRateLimiter(**options)

        return self.rate_limiters[use_case_id]

    @metrics.wraps("sentry_metrics.indexer.check_write_limits")
    def check_write_limits(
        self, use_case_id: UseCaseKey, keys: KeyCollection
    ) -> Tuple[RateLimitState, KeyCollection, Sequence[Tuple[KeyResult, FetchType, FetchTypeExt]]]:
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
        timestamp, grants = self._get_rate_limiter(use_case_id).check_within_quotas(requests)

        granted_key_collection = dict(keys.mapping)
        dropped_key_results = []

        for org_id, request, grant in zip(org_ids, requests, grants):
            allowed_strings = granted_key_collection[org_id]
            if len(allowed_strings) > grant.granted:
                allowed_strings = set(allowed_strings)

                while len(allowed_strings) > grant.granted:
                    dropped_key_results.append(
                        (
                            KeyResult(org_id=org_id, string=allowed_strings.pop(), id=None),
                            FetchType.RATE_LIMITED,
                            FetchTypeExt(
                                is_global=any(
                                    quota.prefix_override is not None
                                    for quota in grant.reached_quotas
                                ),
                            ),
                        )
                    )

            granted_key_collection[org_id] = allowed_strings

        state = RateLimitState(
            use_case_id=use_case_id, requests=requests, grants=grants, timestamp=timestamp
        )
        return state, KeyCollection(granted_key_collection), dropped_key_results

    @metrics.wraps("sentry_metrics.indexer.apply_write_limits")
    def apply_write_limits(self, state: RateLimitState) -> None:
        """
        Consumes the rate limits returned by `check_write_limits`.
        """
        self._get_rate_limiter(state.use_case_id).use_quotas(
            state.requests, state.grants, state.timestamp
        )


writes_limiter = WritesLimiter()
