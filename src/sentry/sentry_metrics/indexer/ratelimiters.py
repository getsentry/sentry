from __future__ import annotations

import dataclasses
from typing import Any, MutableMapping, Optional, Sequence, Tuple

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


@dataclasses.dataclass(frozen=True)
class DroppedString:
    key_result: KeyResult
    fetch_type: FetchType
    fetch_type_ext: FetchTypeExt


@dataclasses.dataclass(frozen=True)
class RateLimitState:
    _writes_limiter: WritesLimiter
    _use_case_id: UseCaseKey
    _requests: Sequence[RequestedQuota]
    _grants: Sequence[GrantedQuota]
    _timestamp: Timestamp

    accepted_keys: KeyCollection
    dropped_strings: Sequence[DroppedString]

    def __enter__(self) -> RateLimitState:
        return self

    @metrics.wraps("sentry_metrics.indexer.writes_limiter.exit")
    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        """
        Consumes the rate limits returned by `check_write_limits`.
        """
        if exc_type is None:
            self._writes_limiter._get_rate_limiter(self._use_case_id).use_quotas(
                self._requests, self._grants, self._timestamp
            )


class WritesLimiter:
    def __init__(self) -> None:
        self.rate_limiters: MutableMapping[UseCaseKey, RedisSlidingWindowRateLimiter] = {}

    def _get_rate_limiter(self, use_case_id: UseCaseKey) -> RedisSlidingWindowRateLimiter:
        if use_case_id not in self.rate_limiters:
            options = get_ingest_config(use_case_id).writes_limiter_cluster_options
            self.rate_limiters[use_case_id] = RedisSlidingWindowRateLimiter(**options)

        return self.rate_limiters[use_case_id]

    @metrics.wraps("sentry_metrics.indexer.check_write_limits")
    def check_write_limits(self, use_case_id: UseCaseKey, keys: KeyCollection) -> RateLimitState:
        """
        Takes a KeyCollection and applies DB write limits as configured via sentry.options.

        Returns a context manager that, upon entering, returns a tuple of:

        1. A key collection containing all unmapped keys that passed through the
          rate limiter.

        2. All unmapped keys that did not pass through the rate limiter.

        Upon (successful) exit, rate limits are consumed.
        """

        org_ids, requests = _construct_quota_requests(use_case_id, keys)
        timestamp, grants = self._get_rate_limiter(use_case_id).check_within_quotas(requests)

        granted_key_collection = dict(keys.mapping)
        dropped_strings = []

        for org_id, request, grant in zip(org_ids, requests, grants):
            allowed_strings = granted_key_collection[org_id]
            if len(allowed_strings) > grant.granted:
                allowed_strings = set(allowed_strings)

                while len(allowed_strings) > grant.granted:
                    dropped_strings.append(
                        DroppedString(
                            key_result=KeyResult(
                                org_id=org_id, string=allowed_strings.pop(), id=None
                            ),
                            fetch_type=FetchType.RATE_LIMITED,
                            fetch_type_ext=FetchTypeExt(
                                is_global=any(
                                    quota.prefix_override is not None
                                    for quota in grant.reached_quotas
                                ),
                            ),
                        )
                    )

            granted_key_collection[org_id] = allowed_strings

        state = RateLimitState(
            _writes_limiter=self,
            _use_case_id=use_case_id,
            _requests=requests,
            _grants=grants,
            _timestamp=timestamp,
            accepted_keys=KeyCollection(granted_key_collection),
            dropped_strings=dropped_strings,
        )
        return state


writes_limiter = WritesLimiter()
