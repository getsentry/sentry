from __future__ import annotations

import dataclasses
from collections.abc import Mapping, MutableMapping, Sequence
from typing import TypedDict

from sentry import options
from sentry.ratelimits.cardinality import (
    CardinalityLimiter,
    GrantedQuota,
    Quota,
    RedisCardinalityLimiter,
    Timestamp,
)
from sentry.sentry_metrics.configuration import MetricsIngestConfiguration, UseCaseKey
from sentry.sentry_metrics.consumers.indexer.common import BrokerMeta
from sentry.sentry_metrics.use_case_id_registry import (
    USE_CASE_ID_CARDINALITY_LIMIT_QUOTA_OPTIONS,
    UseCaseID,
)
from sentry.utils import metrics

OrgId = int


@dataclasses.dataclass(frozen=True)
class CardinalityLimiterState:
    _cardinality_limiter: CardinalityLimiter
    _metric_path_key: UseCaseKey
    _grants: Sequence[GrantedQuota] | None
    _timestamp: Timestamp | None
    keys_to_remove: Sequence[BrokerMeta]


def _build_quota_key(use_case_id: UseCaseID, org_id: OrgId) -> str:
    return f"metrics-indexer-cardinality-{use_case_id.value}-org-{org_id}"


@metrics.wraps("sentry_metrics.indexer.construct_quotas")
def _construct_quotas(use_case_id: UseCaseID) -> Quota | None:
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
    tags: dict[str, str]
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
        return CardinalityLimiterState(
            _cardinality_limiter=self.backend,
            _metric_path_key=metric_path_key,
            _grants=None,
            _timestamp=None,
            keys_to_remove=[],
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
