from __future__ import annotations

import dataclasses
from collections import defaultdict
from typing import Dict, Mapping, MutableMapping, Optional, Sequence, TypedDict

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
from sentry.sentry_metrics.consumers.indexer.batch import PartitionIdxOffset
from sentry.utils import metrics
from sentry.utils.hashlib import hash_values
from sentry.utils.options import sample_modulo

OrgId = int


@dataclasses.dataclass(frozen=True)
class CardinalityLimiterState:
    _cardinality_limiter: CardinalityLimiter
    _use_case_id: UseCaseKey
    _grants: Optional[Sequence[GrantedQuota]]
    _timestamp: Optional[Timestamp]
    keys_to_remove: Sequence[PartitionIdxOffset]


def _build_quota_key(namespace: str, org_id: Optional[OrgId]) -> str:
    if org_id is not None:
        return f"metrics-indexer-cardinality-{namespace}-org-{org_id}"
    else:
        return f"metrics-indexer-cardinality-{namespace}-global"


@metrics.wraps("sentry_metrics.indexer.construct_quotas")
def _construct_quotas(use_case_id: UseCaseKey) -> Optional[Quota]:
    """
    Construct write limit's quotas based on current sentry options.

    This value can potentially cached globally as long as it is invalidated
    when sentry.options are.
    """
    if use_case_id == UseCaseKey.PERFORMANCE:
        quota_args = options.get("sentry-metrics.cardinality-limiter.limits.performance.per-org")
    elif use_case_id == UseCaseKey.RELEASE_HEALTH:
        quota_args = options.get("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org")
    else:
        raise ValueError(use_case_id)

    if quota_args:
        if len(quota_args) > 1:
            raise ValueError("multiple quotas are actually unsupported")

        return Quota(**quota_args[0])

    return None


class InboundMessage(TypedDict):
    # Note: This is only the subset of fields we access in this file.
    org_id: int
    name: str
    tags: Dict[str, str]


class TimeseriesCardinalityLimiter:
    def __init__(self, namespace: str, rate_limiter: CardinalityLimiter) -> None:
        self.namespace = namespace
        self.backend: CardinalityLimiter = rate_limiter

    def check_cardinality_limits(
        self, use_case_id: UseCaseKey, messages: Mapping[PartitionIdxOffset, InboundMessage]
    ) -> CardinalityLimiterState:
        request_hashes = defaultdict(set)
        hash_to_offset = {}

        if use_case_id == UseCaseKey.PERFORMANCE:
            rollout_option = "sentry-metrics.cardinality-limiter.orgs-rollout-rate"
        elif use_case_id == UseCaseKey.RELEASE_HEALTH:
            rollout_option = "sentry-metrics.cardinality-limiter-rh.orgs-rollout-rate"

        for key, message in messages.items():
            org_id = message["org_id"]
            if not sample_modulo(rollout_option, org_id):
                continue

            message_hash = int(
                hash_values(
                    [
                        message["name"],
                        message["tags"],
                    ]
                ),
                16,
            )
            prefix = _build_quota_key(self.namespace, org_id)
            hash_to_offset[prefix, message_hash] = key
            request_hashes[prefix].add(message_hash)

        requested_quotas = []
        configured_quota = _construct_quotas(use_case_id)

        grants = None
        timestamp = None

        if configured_quota is None:
            keys_to_remove = {}
        else:
            for prefix, hashes in request_hashes.items():
                requested_quotas.append(
                    RequestedQuota(prefix=prefix, unit_hashes=hashes, quota=configured_quota)
                )

            timestamp, grants = self.backend.check_within_quotas(requested_quotas)

            keys_to_remove = hash_to_offset
            # make sure that hash_to_offset is no longer used, as the underlying
            # dict will be mutated
            del hash_to_offset

            for grant in grants:
                for hash in grant.granted_unit_hashes:
                    del keys_to_remove[grant.request.prefix, hash]

        return CardinalityLimiterState(
            _cardinality_limiter=self.backend,
            _use_case_id=use_case_id,
            _grants=grants,
            _timestamp=timestamp,
            keys_to_remove=list(keys_to_remove.values()),
        )

    def apply_cardinality_limits(self, state: CardinalityLimiterState) -> None:
        if state._grants is not None and state._timestamp is not None:
            state._cardinality_limiter.use_quotas(state._grants, state._timestamp)


class TimeseriesCardinalityLimiterFactory:
    """
    The TimeseriesCardinalityLimiterFactory is in charge of initializing the
    TimeseriesCardinalityLimiter based on a configuration's namespace and
    options. Ideally this logic would live in the initialization of the
    backends (postgres, etc) but since each backend supports
    multiple use cases dynamically we just keep the mapping of rate limiters in
    this factory.

    [Copied from sentry.sentry_metrics.indexer.limiters.writes]
    """

    def __init__(self) -> None:
        self.rate_limiters: MutableMapping[str, TimeseriesCardinalityLimiter] = {}

    def get_ratelimiter(self, config: MetricsIngestConfiguration) -> TimeseriesCardinalityLimiter:
        namespace = config.cardinality_limiter_namespace
        if namespace not in self.rate_limiters:
            limiter = TimeseriesCardinalityLimiter(
                namespace, RedisCardinalityLimiter(**config.cardinality_limiter_cluster_options)
            )
            self.rate_limiters[namespace] = limiter

        return self.rate_limiters[namespace]


cardinality_limiter_factory = TimeseriesCardinalityLimiterFactory()
