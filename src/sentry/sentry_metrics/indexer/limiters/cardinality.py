from __future__ import annotations

import dataclasses
from collections import defaultdict
from typing import Generic, Mapping, MutableMapping, Optional, Sequence, TypeVar

from sentry import options
from sentry.ratelimits.cardinality import (
    CardinalityLimiter,
    GrantedQuota,
    Quota,
    RedisCardinalityLimiter,
    RequestedQuota,
    Timestamp,
)
from sentry.sentry_metrics.configuration import UseCaseKey, get_ingest_config
from sentry.sentry_metrics.consumers.indexer.batch import InboundMessage
from sentry.utils import metrics
from sentry.utils.hashlib import hash_values

OrgId = int

T = TypeVar("T")


@dataclasses.dataclass(frozen=True)
class CardinalityLimiterState(Generic[T]):
    _cardinality_limiter: CardinalityLimiter
    _use_case_id: UseCaseKey
    _requests: Sequence[RequestedQuota]
    _grants: Sequence[GrantedQuota]
    _timestamp: Timestamp
    keys_to_remove: Sequence[T]


def _build_quota_key(use_case_id: UseCaseKey, org_id: Optional[OrgId]) -> str:
    if org_id is not None:
        return f"metrics-indexer-cardinality-{use_case_id}-org-{org_id}"
    else:
        return f"metrics-indexer-cardinality-{use_case_id}-global"


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


class TimeseriesCardinalityLimiter:
    def __init__(self) -> None:
        self.rate_limiters: MutableMapping[UseCaseKey, CardinalityLimiter] = {}

    def _get_rate_limiter(self, use_case_id: UseCaseKey) -> CardinalityLimiter:
        if use_case_id not in self.rate_limiters:
            options = get_ingest_config(use_case_id).cardinality_limiter_cluster_options
            self.rate_limiters[use_case_id] = RedisCardinalityLimiter(**options)

        return self.rate_limiters[use_case_id]

    def check_cardinality_limits(
        self, use_case_id: UseCaseKey, messages: Mapping[T, InboundMessage]
    ) -> CardinalityLimiterState[T]:
        limiter = self._get_rate_limiter(use_case_id)
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
            prefix = _build_quota_key(use_case_id, org_id)
            keys_to_remove[prefix, message_hash] = key
            request_hashes[prefix].add(message_hash)

        requested_quotas = []
        configured_quotas = _construct_quotas(use_case_id)
        for prefix, hashes in request_hashes.items():
            requested_quotas.append(
                RequestedQuota(prefix=prefix, unit_hashes=hashes, quotas=configured_quotas)
            )

        timestamp, grants = limiter.check_within_quotas(requested_quotas)

        for grant in grants:
            for hash in grant.granted_unit_hashes:
                del keys_to_remove[prefix, hash]

        return CardinalityLimiterState(
            _cardinality_limiter=limiter,
            _use_case_id=use_case_id,
            _requests=requested_quotas,
            _grants=grants,
            _timestamp=timestamp,
            keys_to_remove=list(keys_to_remove.values()),
        )

    def apply_cardinality_limits(self, state: CardinalityLimiterState) -> None:
        state._cardinality_limiter.use_quotas(state._requests, state._grants, state._timestamp)


cardinality_limiter = TimeseriesCardinalityLimiter()
