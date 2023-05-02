from __future__ import annotations

import dataclasses
from typing import Any, Mapping, MutableMapping, Optional, Sequence, Tuple

from sentry import options
from sentry.ratelimits.sliding_windows import (
    GrantedQuota,
    Quota,
    RedisSlidingWindowRateLimiter,
    RequestedQuota,
    Timestamp,
)
from sentry.sentry_metrics.configuration import MetricsIngestConfiguration, UseCaseKey
from sentry.sentry_metrics.indexer.base import (
    FetchType,
    FetchTypeExt,
    KeyCollection,
    KeyResult,
    UseCaseKeyCollection,
)
from sentry.sentry_metrics.use_case_id_registry import METRIC_PATH_MAPPING
from sentry.utils import metrics

OrgId = int


def _build_quota_key(namespace: str, org_id: Optional[OrgId] = None) -> str:
    if org_id is not None:
        return f"metrics-indexer-{namespace}-org-{org_id}"
    else:
        return f"metrics-indexer-{namespace}-global"


@metrics.wraps("sentry_metrics.indexer.construct_quotas")
def _construct_quotas(use_case_id: UseCaseKey, namespace: str) -> Sequence[Quota]:
    """
    Construct write limit's quotas based on current sentry options.

    This value can potentially cached globally as long as it is invalidated
    when sentry.options are.
    """
    if use_case_id == UseCaseKey.PERFORMANCE:
        return [
            Quota(prefix_override=_build_quota_key(namespace, None), **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.performance.global")
        ] + [
            Quota(prefix_override=None, **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.performance.per-org")
        ]
    elif use_case_id == UseCaseKey.RELEASE_HEALTH:
        return [
            Quota(prefix_override=_build_quota_key(namespace, None), **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.releasehealth.global")
        ] + [
            Quota(prefix_override=None, **args)
            for args in options.get("sentry-metrics.writes-limiter.limits.releasehealth.per-org")
        ]
    else:
        raise ValueError(use_case_id)


@metrics.wraps("sentry_metrics.indexer.construct_quota_requests")
def _construct_quota_requests(
    use_case_id: UseCaseKey, namespace: str, keys: KeyCollection
) -> Tuple[Sequence[OrgId], Sequence[RequestedQuota]]:
    org_ids = []
    requests = []
    quotas = _construct_quotas(use_case_id, namespace)

    if quotas:
        for org_id, strings in keys.mapping.items():
            org_ids.append(org_id)
            requests.append(
                RequestedQuota(
                    prefix=_build_quota_key(namespace, org_id),
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
    _namespace: str
    _requests: Sequence[RequestedQuota]
    _grants: Sequence[GrantedQuota]
    _timestamp: Timestamp

    accepted_keys: UseCaseKeyCollection
    dropped_strings: Sequence[DroppedString]

    def __enter__(self) -> RateLimitState:
        return self

    @metrics.wraps("sentry_metrics.indexer.writes_limiter.exit")
    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        """
        Consumes the rate limits returned by `check_write_limits`.
        """
        if exc_type is None:
            self._writes_limiter.rate_limiter.use_quotas(
                self._requests, self._grants, self._timestamp
            )


class WritesLimiter:
    def __init__(self, namespace: str, **options: Mapping[str, str]) -> None:
        self.namespace = namespace
        self.rate_limiter: RedisSlidingWindowRateLimiter = RedisSlidingWindowRateLimiter(**options)

    @metrics.wraps("sentry_metrics.indexer.check_write_limits")
    def check_write_limits(
        self,
        use_case_keys: UseCaseKeyCollection,
    ) -> RateLimitState:
        """
        Takes a KeyCollection and applies DB write limits as configured via sentry.options.

        Returns a context manager that, upon entering, returns a tuple of:

        1. A key collection containing all unmapped keys that passed through the
          rate limiter.

        2. All unmapped keys that did not pass through the rate limiter.

        Upon (successful) exit, rate limits are consumed.
        """
        use_case_id = next(iter(use_case_keys.mapping.keys()))
        keys = next(iter(use_case_keys.mapping.values()))
        org_ids, requests = _construct_quota_requests(
            METRIC_PATH_MAPPING[use_case_id],
            self.namespace,
            keys,
        )
        timestamp, grants = self.rate_limiter.check_within_quotas(requests)

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
            _use_case_id=METRIC_PATH_MAPPING[use_case_id],
            _namespace=self.namespace,
            _requests=requests,
            _grants=grants,
            _timestamp=timestamp,
            accepted_keys=UseCaseKeyCollection(
                {use_case_id: KeyCollection(granted_key_collection)}
            ),
            dropped_strings=dropped_strings,
        )
        return state


class WritesLimiterFactory:
    """
    The WritesLimiterFactory is in charge of initializing the WritesLimiter
    based on a configuration's namespace and options. Ideally this logic would
    live in the initialization of the backends (postgres etc) but
    since each backend supports multiple use cases dynamically we just keep the
    mapping of rate limiters in this factory.
    """

    def __init__(self) -> None:
        self.rate_limiters: MutableMapping[str, WritesLimiter] = {}

    def get_ratelimiter(self, config: MetricsIngestConfiguration) -> WritesLimiter:
        namespace = config.writes_limiter_namespace
        if namespace not in self.rate_limiters:
            writes_rate_limiter = WritesLimiter(namespace, **config.writes_limiter_cluster_options)
            self.rate_limiters[namespace] = writes_rate_limiter

        return self.rate_limiters[namespace]


writes_limiter_factory = WritesLimiterFactory()
