from __future__ import annotations

from typing import MutableMapping, Sequence, Any, Optional

import dataclasses
from collections import defaultdict

from sentry.sentry_metrics.configuration import UseCaseKey, get_ingest_config

from sentry.ratelimits.cardinality import CardinalityLimiter, GrantedQuota, RequestedQuota, Timestamp, Quota
from sentry.sentry_metrics.consumers.indexer.batch import InboundMessage
from sentry.utils import metrics
from sentry.utils.hashlib import hash_values
from sentry import options

OrgId = int

@dataclasses.dataclass(frozen=True)
class CardinalityLimiterState:
    _cardinality_limiter: CardinalityLimiter
    _use_case_id: UseCaseKey
    _namespace: str
    _requests: Sequence[RequestedQuota]
    _grants: Sequence[GrantedQuota]
    _timestamp: Timestamp


def _build_quota_key(namespace: str, org_id: Optional[OrgId] = None) -> str:
    if org_id is not None:
        return f"metrics-indexer-cardinality-{namespace}-org-{org_id}"
    else:
        return f"metrics-indexer-cardinality-{namespace}-global"


@metrics.wraps("sentry_metrics.indexer.construct_quotas")
def _construct_quotas(use_case_id: UseCaseKey, namespace: str) -> Sequence[Quota]:
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

    def _get_rate_limiter( self, use_case_id: UseCaseKey) -> CardinalityLimiter:
        if use_case_id not in self.rate_limiters:
            options = get_ingest_config(use_case_id).cardinality_limiter_cluster_options
            # TODO: Replace with real implementation
            self.rate_limiters[use_case_id] = CardinalityLimiter(**options)

        return self.rate_limiters[use_case_id]

    def check_cardinality_limits(self, use_case_id: UseCaseKey, namespace: str, messages: MutableMapping[object, InboundMessage]) -> CardinalityLimiterState:
        limiter = self._get_rate_limiter(use_case_id)
        message_keys = []
        request_hashes = defaultdict(set)
        for key, message in messages.items():
            org_id = message['org_id']
            message_hash = hash_values([
                message['name'],
                message['type'],
                message['tags'],
            ])
            request_hashes[org_id].add(message_hash)

        requested_quotas = []
        configured_quotas = _construct_quotas(use_case_id, namespace)
        for org_id, hashes in request_hashes.items():
            requested_quotas.append(RequestedQuota(
                prefix=_build_quota_key(namespace, org_id),
                unit_hashes=hashes,
                quotas=configured_quotas
            ))

        timestamp, grants = limiter.check_within_quotas(requested_quotas)

        return CardinalityLimiterState(
            _cardinality_limiter=limiter,
            _use_case_id=use_case_id,
            _namespace=namespace,
            _requests=requested_quotas,
            _grants=grants,
            _timestamp=timestamp
        )

    def apply_cardinality_limits(self, state: CardinalityLimiterState) -> None:
        state._cardinality_limiter.use_quotas(state._requests, state._grants, state._timestamp)


cardinality_limiter = TimeseriesCardinalityLimiter()
