from __future__ import annotations

import dataclasses
from typing import Any, List, Mapping, MutableMapping, Optional, Sequence, Set, Tuple

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
    KeyCollection,
    UseCaseKeyCollection,
    UseCaseKeyResult,
)
from sentry.sentry_metrics.use_case_id_registry import (
    USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTION_NAME,
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
    _requests: Sequence[Sequence[RequestedQuota]]
    _grants: Sequence[Sequence[GrantedQuota]]
    _timestamps: Sequence[Timestamp]

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
        for requests, grants, timestamp in zip(self._requests, self._grants, self._timestamps):
            self._writes_limiter.rate_limiter.use_quotas(requests, grants, timestamp)


class WritesLimiter:
    def __init__(self, namespace: str, **options: Mapping[str, str]) -> None:
        self.namespace = namespace
        self.rate_limiter: RedisSlidingWindowRateLimiter = RedisSlidingWindowRateLimiter(**options)

    def _build_quota_key(self, org_id: Optional[OrgId] = None) -> str:
        if org_id is not None:
            return f"metrics-indexer-{self.namespace}-org-{org_id}"
        else:
            return f"metrics-indexer-{self.namespace}-global"

    @metrics.wraps("sentry_metrics.indexer.construct_quotas")
    def _construct_quotas(self, use_case_id: UseCaseID) -> Sequence[Quota]:
        """
        Construct write limit's quotas based on current sentry options.

        This value can potentially cached globally as long as it is invalidated
        when sentry.options are.
        """
        if use_case_id in USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTION_NAME:
            return [
                Quota(prefix_override=self._build_quota_key(), **args)
                for args in options.get(
                    f"{USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTION_NAME[use_case_id]}.global"
                )
            ] + [
                Quota(prefix_override=None, **args)
                for args in options.get(
                    f"{USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTION_NAME[use_case_id]}.per-org"
                )
            ]
        raise ValueError(use_case_id)

    @metrics.wraps("sentry_metrics.indexer.construct_quota_requests")
    def _construct_quota_requests(
        self, use_case_id: UseCaseID, keys: KeyCollection
    ) -> Tuple[Sequence[OrgId], Sequence[RequestedQuota]]:
        org_ids = []
        requests = []
        quotas = self._construct_quotas(use_case_id)

        if quotas:
            for org_id, strings in keys.mapping.items():
                org_ids.append(org_id)
                requests.append(
                    RequestedQuota(
                        prefix=self._build_quota_key(org_id),
                        requested=len(strings),
                        quotas=quotas,
                    )
                )

        return org_ids, requests

    def _check_use_case_writes_limits(
        self, use_case_id: UseCaseID, key_collection: KeyCollection
    ) -> Tuple[
        Timestamp,
        Sequence[RequestedQuota],
        Sequence[GrantedQuota],
        Sequence[DroppedString],
        dict[OrgId, Set[str]],
    ]:
        org_ids, requests = self._construct_quota_requests(
            use_case_id,
            key_collection,
        )
        timestamp, grants = self.rate_limiter.check_within_quotas(requests)

        accepted_keys = dict(key_collection.mapping)
        dropped_strings = []

        for org_id, grant in zip(org_ids, grants):
            if len(accepted_keys[org_id]) <= grant.granted:
                continue

            allowed_strings = set(accepted_keys[org_id])

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

            accepted_keys[org_id] = allowed_strings

        return timestamp, requests, grants, dropped_strings, accepted_keys

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
        timestamps = []
        all_requests = []
        all_grants = []
        all_dropped_strings: List[DroppedString] = []
        all_accepted_keys = {}
        for use_case_id, key_collection in use_case_keys.mapping.items():
            (
                timestamp,
                requests,
                grants,
                dropped_strings,
                accepted_keys,
            ) = self._check_use_case_writes_limits(use_case_id, key_collection)

            all_requests.append(requests)
            all_grants.append(grants)
            timestamps.append(timestamp)
            all_dropped_strings.extend(dropped_strings)
            all_accepted_keys[use_case_id] = accepted_keys

        state = RateLimitState(
            _writes_limiter=self,
            _namespace=self.namespace,
            _requests=all_requests,
            _grants=all_grants,
            _timestamps=timestamps,
            accepted_keys=UseCaseKeyCollection(all_accepted_keys),
            dropped_strings=all_dropped_strings,
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
