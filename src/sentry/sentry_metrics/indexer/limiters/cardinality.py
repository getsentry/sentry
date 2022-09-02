from __future__ import annotations

import dataclasses
from collections import defaultdict
from typing import Any, Generic, Mapping, MutableMapping, Optional, Sequence, TypedDict, TypeVar

from sentry import options
from sentry.ratelimits.cardinality import (
    CardinalityLimiter,
    GrantedQuota,
    Quota,
    RedisCardinalityLimiter,
    RequestedQuota,
    Timestamp,
)
from sentry.sentry_metrics.configuration import MetricsIngestConfiguration, UseCaseKey
from sentry.utils import metrics
from sentry.utils.hashlib import hash_values

OrgId = int

TMessageKey = TypeVar("TMessageKey")


@dataclasses.dataclass(frozen=True)
class CardinalityLimiterState(Generic[TMessageKey]):
    _cardinality_limiter: CardinalityLimiter
    _use_case_id: UseCaseKey
    _grants: Sequence[GrantedQuota]
    _timestamp: Timestamp
    keys_to_remove: Sequence[TMessageKey]


def _build_quota_key(namespace: str, org_id: Optional[OrgId]) -> str:
    if org_id is not None:
        return f"metrics-indexer-cardinality-{namespace}-org-{org_id}"
    else:
        return f"metrics-indexer-cardinality-{namespace}-global"


@metrics.wraps("sentry_metrics.indexer.construct_quotas")
def _construct_quotas(use_case_id: UseCaseKey) -> Sequence[Quota]:
    """
    Construct write limit's quotas based on current sentry options.

    This value can potentially cached globally as long as it is invalidated
    when sentry.options are.
    """
    if use_case_id == UseCaseKey.PERFORMANCE:
        return [
            Quota(**args)
            for args in options.get("sentry-metrics.writes-limiter.limits.performance.per-org")
        ]
    elif use_case_id == UseCaseKey.RELEASE_HEALTH:
        return [
            Quota(**args)
            for args in options.get("sentry-metrics.writes-limiter.limits.releasehealth.per-org")
        ]
    else:
        raise ValueError(use_case_id)


class InboundMessage(TypedDict):
    # Note: This is only the subset of fields we access in this file.
    org_id: int
    name: str
    type: str
    tags: Mapping[str, str]


class TimeseriesCardinalityLimiter:
    def __init__(self, namespace: str, rate_limiter: CardinalityLimiter) -> None:
        self.namespace = namespace
        self.rate_limiter: CardinalityLimiter = rate_limiter

    def check_cardinality_limits(
        self, use_case_id: UseCaseKey, messages: Mapping[TMessageKey, InboundMessage]
    ) -> CardinalityLimiterState[TMessageKey]:
        request_hashes = defaultdict(set)
        keys_to_remove = {}
        for key, message in messages.items():
            org_id = message["org_id"]
            message_hash = hash_values(
                [
                    message["name"],
                    message["type"],
                    message["tags"],
                ]
            )
            prefix = _build_quota_key(self.namespace, org_id)
            keys_to_remove[prefix, message_hash] = key
            request_hashes[prefix].add(message_hash)

        requested_quotas = []
        configured_quotas = _construct_quotas(use_case_id)
        for prefix, hashes in request_hashes.items():
            requested_quotas.append(
                RequestedQuota(prefix=prefix, unit_hashes=hashes, quotas=configured_quotas)
            )

        timestamp, grants = self.rate_limiter.check_within_quotas(requested_quotas)

        for grant in grants:
            for hash in grant.granted_unit_hashes:
                del keys_to_remove[prefix, hash]

        return CardinalityLimiterState(
            _cardinality_limiter=self.rate_limiter,
            _use_case_id=use_case_id,
            _grants=grants,
            _timestamp=timestamp,
            keys_to_remove=list(keys_to_remove.values()),
        )

    def apply_cardinality_limits(self, state: CardinalityLimiterState[Any]) -> None:
        state._cardinality_limiter.use_quotas(state._grants, state._timestamp)


class TimeseriesCardinalityLimiterFactory:
    """
    The TimeseriesCardinalityLimiterFactory is in charge of initializing the
    TimeseriesCardinalityLimiter based on a configuration's namespace and
    options. Ideally this logic would live in the initialization of the
    backends (postgres, cloudspanner etc) but since each backend supports
    multiple use cases dynamically we just keep the mapping of rate limiters in
    this factory.

    [Copied from sentry.sentry_metrics.indexer.limiters.writes]
    """

    def __init__(self) -> None:
        self.rate_limiters: MutableMapping[str, TimeseriesCardinalityLimiter] = {}

    def get_ratelimiter(self, config: MetricsIngestConfiguration) -> TimeseriesCardinalityLimiter:
        namespace = config.writes_limiter_namespace
        if namespace not in self.rate_limiters:
            writes_rate_limiter = TimeseriesCardinalityLimiter(
                namespace, RedisCardinalityLimiter(**config.writes_limiter_cluster_options)
            )
            self.rate_limiters[namespace] = writes_rate_limiter

        return self.rate_limiters[namespace]


cardinality_limiter_factory = TimeseriesCardinalityLimiterFactory()
