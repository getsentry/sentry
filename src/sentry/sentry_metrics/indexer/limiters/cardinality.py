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
from sentry.sentry_metrics.consumers.indexer.common import BrokerMeta
from sentry.sentry_metrics.use_case_id_registry import (
    USE_CASE_ID_CARDINALITY_LIMIT_QUOTA_OPTIONS,
    UseCaseID,
)
from sentry.utils import metrics
from sentry.utils.hashlib import hash_values
from sentry.utils.options import sample_modulo

OrgId = int


@dataclasses.dataclass(frozen=True)
class CardinalityLimiterState:
    _cardinality_limiter: CardinalityLimiter
    _metric_path_key: UseCaseKey
    _grants: Optional[Sequence[GrantedQuota]]
    _timestamp: Optional[Timestamp]
    keys_to_remove: Sequence[BrokerMeta]


def _build_quota_key(use_case_id: UseCaseID, org_id: OrgId) -> str:
    return f"metrics-indexer-cardinality-{use_case_id.value}-org-{org_id}"


@metrics.wraps("sentry_metrics.indexer.construct_quotas")
def _construct_quotas(use_case_id: UseCaseID) -> Optional[Quota]:
    """
    Construct write limit's quotas based on current sentry options.

    This value can potentially cached globally as long as it is invalidated
    when sentry.options are.
    """

    if use_case_id in USE_CASE_ID_CARDINALITY_LIMIT_QUOTA_OPTIONS:
        quota_args = options.get(USE_CASE_ID_CARDINALITY_LIMIT_QUOTA_OPTIONS[use_case_id])

    else:
        quota_args = options.get(
            "sentry-metrics.cardinality-limiter.limits.generic-metrics.per-org"
        )

    if not quota_args:
        raise ValueError("quotas cannot be empty")
    if len(quota_args) > 1:
        raise ValueError("multiple quotas are actually unsupported")

    return Quota(**quota_args[0])


class InboundMessage(TypedDict):
    # Note: This is only the subset of fields we access in this file.
    org_id: int
    name: str
    tags: Dict[str, str]
    # now that all messages are getting a use_case_id
    # field via message processing, we can add it here
    use_case_id: UseCaseID


class TimeseriesCardinalityLimiter:
    def __init__(self, namespace: str, rate_limiter: CardinalityLimiter) -> None:
        self.namespace = namespace
        self.backend: CardinalityLimiter = rate_limiter

    def check_cardinality_limits(
        self, metric_path_key: UseCaseKey, messages: Mapping[BrokerMeta, InboundMessage]
    ) -> CardinalityLimiterState:
        request_hashes = defaultdict(set)
        hash_to_meta: Mapping[str, Dict[int, BrokerMeta]] = defaultdict(dict)
        prefix_to_quota = {}

        # this works by applying one cardinality limiter rollout option
        # for each metric path. ultimately, this can be moved into the
        # loop below to make rollout options occur on a per use case-basis
        rollout_option = {
            UseCaseKey.PERFORMANCE: "sentry-metrics.cardinality-limiter.orgs-rollout-rate",
            UseCaseKey.RELEASE_HEALTH: "sentry-metrics.cardinality-limiter-rh.orgs-rollout-rate",
        }[metric_path_key]

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
            prefix = _build_quota_key(message["use_case_id"], org_id)
            hash_to_meta[prefix][message_hash] = key
            request_hashes[prefix].add(message_hash)
            configured_quota = _construct_quotas(message["use_case_id"])

            # since we might have some use cases that are covered by
            # a quota and some that are not, only add entries that
            # are covered by a quota
            if configured_quota is not None:
                prefix_to_quota[prefix] = configured_quota

        requested_quotas = []

        grants = None
        timestamp = None

        # if none of the use cases are covered by a quota
        if len(prefix_to_quota) == 0:
            return CardinalityLimiterState(
                _cardinality_limiter=self.backend,
                _metric_path_key=metric_path_key,
                _grants=grants,
                _timestamp=timestamp,
                keys_to_remove=[],
            )

        for prefix, hashes in request_hashes.items():
            quota = prefix_to_quota.get(prefix)

            if quota is not None:
                requested_quotas.append(
                    RequestedQuota(prefix=prefix, unit_hashes=hashes, quota=quota)
                )

        timestamp, grants = self.backend.check_within_quotas(requested_quotas)

        keys_to_remove = hash_to_meta
        # make sure that hash_to_broker_meta is no longer used, as the underlying
        # dict will be mutated
        del hash_to_meta

        for grant in grants:
            for hash in grant.granted_unit_hashes:
                del keys_to_remove[grant.request.prefix][hash]

            substrings = grant.request.prefix.split("-")
            grant_use_case_id = substrings[3]

            metrics.incr(
                "sentry_metrics.indexer.process_messages.dropped_message",
                amount=len(keys_to_remove[grant.request.prefix]),
                tags={
                    "reason": "cardinality_limit",
                    "use_case_id": grant_use_case_id,
                },
            )

        return CardinalityLimiterState(
            _cardinality_limiter=self.backend,
            _metric_path_key=metric_path_key,
            _grants=grants,
            _timestamp=timestamp,
            keys_to_remove=[key for grant in keys_to_remove.values() for key in grant.values()],
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
