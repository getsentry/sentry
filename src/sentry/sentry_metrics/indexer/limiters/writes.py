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
from sentry.sentry_metrics.configuration import MetricsIngestConfiguration
from sentry.sentry_metrics.indexer.base import (
    FetchType,
    FetchTypeExt,
    UseCaseKeyCollection,
    UseCaseKeyResult,
)
from sentry.sentry_metrics.use_case_id_registry import (
    USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS,
    UseCaseID,
)
from sentry.utils import metrics

OrgId = int


@dataclasses.dataclass(frozen=True)
class DroppedString:
    use_case_key_result: UseCaseKeyResult
    fetch_type: FetchType
    fetch_type_ext: FetchTypeExt


@dataclasses.dataclass(frozen=True)
class RateLimitState:
    _writes_limiter: WritesLimiter
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
        if exc_type is not None:
            return

        self._writes_limiter.rate_limiter.use_quotas(self._requests, self._grants, self._timestamp)


class WritesLimiter:
    def __init__(self, namespace: str, **options: Mapping[str, str]) -> None:
        self.namespace = namespace
        self.rate_limiter: RedisSlidingWindowRateLimiter = RedisSlidingWindowRateLimiter(**options)

    def _build_quota_key(self, use_case_id: UseCaseID, org_id: Optional[OrgId] = None) -> str:
        if org_id is not None:
            return f"metrics-indexer-{use_case_id.value}-org-{org_id}"
        else:
            return f"metrics-indexer-{use_case_id.value}-global"

    @metrics.wraps("sentry_metrics.indexer.construct_quotas")
    def _construct_quotas(self, use_case_id: UseCaseID) -> Sequence[Quota]:
        """
        Construct write limit's quotas based on current sentry options.

        This value can potentially cached globally as long as it is invalidated
        when sentry.options are.
        """
        option_name = USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS.get(
            use_case_id, "sentry-metrics.writes-limiter.limits.generic-metrics"
        )
        return [
            Quota(prefix_override=self._build_quota_key(use_case_id), **args)
            for args in options.get(f"{option_name}.global")
        ] + [Quota(prefix_override=None, **args) for args in options.get(f"{option_name}.per-org")]

    @metrics.wraps("sentry_metrics.indexer.construct_quota_requests")
    def _construct_quota_requests(
        self, keys: UseCaseKeyCollection
    ) -> Tuple[Sequence[UseCaseID], Sequence[OrgId], Sequence[RequestedQuota]]:
        use_case_ids = []
        org_ids = []
        requests = []

        for use_case_id, key_collection in keys.mapping.items():
            quotas = self._construct_quotas(use_case_id)

            if not quotas:
                continue
            for org_id, strings in key_collection.mapping.items():
                use_case_ids.append(use_case_id)
                org_ids.append(org_id)
                requests.append(
                    RequestedQuota(
                        prefix=self._build_quota_key(use_case_id, org_id),
                        requested=len(strings),
                        quotas=quotas,
                    )
                )

        return use_case_ids, org_ids, requests

    @metrics.wraps("sentry_metrics.indexer.check_write_limits")
    def check_write_limits(
        self,
        use_case_keys: UseCaseKeyCollection,
    ) -> RateLimitState:
        """
        Takes a UseCaseKeyCollection and applies DB write limits as configured via sentry.options.

        Returns a context manager that, upon entering, returns a tuple of:

        1. A UseCaseKeyCollection containing all unmapped keys that passed through the
          rate limiter.

        2. All unmapped keys that did not pass through the rate limiter.

        Upon (successful) exit, rate limits are consumed.
        """

        use_case_ids, org_ids, requests = self._construct_quota_requests(use_case_keys)
        timestamp, grants = self.rate_limiter.check_within_quotas(requests)

        accepted_keys = {
            use_case_id: {org_id: strings for org_id, strings in key_collection.mapping.items()}
            for use_case_id, key_collection in use_case_keys.mapping.items()
        }
        dropped_strings = []

        for use_case_id, org_id, grant in zip(use_case_ids, org_ids, grants):
            if len(accepted_keys[use_case_id][org_id]) <= grant.granted:
                continue

            allowed_strings = set(accepted_keys[use_case_id][org_id])

            while len(allowed_strings) > grant.granted:
                dropped_strings.append(
                    DroppedString(
                        use_case_key_result=UseCaseKeyResult(
                            use_case_id=use_case_id,
                            org_id=org_id,
                            string=allowed_strings.pop(),
                            id=None,
                        ),
                        fetch_type=FetchType.RATE_LIMITED,
                        fetch_type_ext=FetchTypeExt(
                            is_global=any(
                                quota.prefix_override is not None for quota in grant.reached_quotas
                            ),
                        ),
                    )
                )

            accepted_keys[use_case_id][org_id] = allowed_strings

        state = RateLimitState(
            _writes_limiter=self,
            _namespace=self.namespace,
            _requests=requests,
            _grants=grants,
            _timestamp=timestamp,
            accepted_keys=UseCaseKeyCollection(accepted_keys),
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
