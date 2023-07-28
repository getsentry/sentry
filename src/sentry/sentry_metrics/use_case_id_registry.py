from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Mapping, Optional, Sequence

from snuba_sdk import Entity, Granularity

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.dataset import Dataset, EntityKey


class UseCaseID(Enum):
    SPANS = "spans"
    TRANSACTIONS = "transactions"
    SESSIONS = "sessions"
    ESCALATING_ISSUES = "escalating_issues"


# UseCaseKey will be renamed to MetricPathKey
METRIC_PATH_MAPPING: Mapping[UseCaseID, UseCaseKey] = {
    UseCaseID.SPANS: UseCaseKey.PERFORMANCE,
    UseCaseID.TRANSACTIONS: UseCaseKey.PERFORMANCE,
    UseCaseID.SESSIONS: UseCaseKey.RELEASE_HEALTH,
    UseCaseID.ESCALATING_ISSUES: UseCaseKey.PERFORMANCE,
}

# TODO: Remove this as soon as the entire indexer system is use case aware
# as this is temporary and eventually UseCaseKey will have a 1:N relationship
# with UseCaseID
REVERSE_METRIC_PATH_MAPPING: Mapping[UseCaseKey, UseCaseID] = {
    UseCaseKey.RELEASE_HEALTH: UseCaseID.SESSIONS,
    UseCaseKey.PERFORMANCE: UseCaseID.TRANSACTIONS,
}

USE_CASE_ID_CARDINALITY_LIMIT_QUOTA_OPTIONS = {
    UseCaseID.TRANSACTIONS: "sentry-metrics.cardinality-limiter.limits.performance.per-org",
    UseCaseID.SESSIONS: "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
    UseCaseID.SPANS: "sentry-metrics.cardinality-limiter.limits.spans.per-org",
}

USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS = {
    UseCaseID.SPANS: "sentry-metrics.writes-limiter.limits.spans",
    UseCaseID.TRANSACTIONS: "sentry-metrics.writes-limiter.limits.performance",
    UseCaseID.SESSIONS: "sentry-metrics.writes-limiter.limits.releasehealth",
}


def get_use_case_key(use_case_id: UseCaseID) -> Optional[UseCaseKey]:
    return METRIC_PATH_MAPPING.get(use_case_id)


_DATASET_TO_ENTITY = {
    # Legacy metrics used just for release health
    Dataset.Metrics: {
        "c": EntityKey.MetricsCounters,
        "s": EntityKey.MetricsSets,
        "d": EntityKey.MetricsDistributions,
    },
    # Generic metrics
    Dataset.PerformanceMetrics: {
        "c": EntityKey.GenericMetricsCounters,
        "s": EntityKey.GenericMetricsSets,
        "d": EntityKey.GenericMetricsDistributions,
    },
}


@dataclass
class QueryConfig:
    """
    Storage and query configuration for metrics queries. This configuration is
    used by the ``query_experimental`` module to generate queries.
    """

    # The snuba dataset where these metrics are stored.
    dataset: Dataset
    # True if the tag values are indexed in this dataset. Defaults to false,
    # which stores tag values inline.
    index_values: bool
    # Granularities available to query on the dataset.
    granularities: Sequence[int]

    def entity(self, metric_type: str) -> Entity:
        """
        Get the entity key for a metric type obtained via ``parse_mri``.
        """
        key = _DATASET_TO_ENTITY[self.dataset][metric_type]
        return Entity(key.value)

    def granularity(self, interval: int) -> Granularity:
        granularity = max(g for g in self.granularities if g <= interval)
        return Granularity(granularity)


# Query configuration for each use case.
_QUERY_CONFIGS = {
    UseCaseID.SPANS: QueryConfig(
        dataset=Dataset.PerformanceMetrics,
        index_values=False,
        granularities=[60, 3600, 86400],
    ),
    UseCaseID.TRANSACTIONS: QueryConfig(
        dataset=Dataset.PerformanceMetrics,
        index_values=False,
        granularities=[60, 3600, 86400],
    ),
    UseCaseID.SESSIONS: QueryConfig(
        dataset=Dataset.Metrics,
        index_values=True,
        granularities=[10, 60, 3600, 86400],
    ),
    UseCaseID.ESCALATING_ISSUES: QueryConfig(
        dataset=Dataset.PerformanceMetrics,
        index_values=False,
        granularities=[60, 3600, 86400],
    ),
}


def get_query_config(use_case: UseCaseID) -> QueryConfig:
    """
    Get the query configuration for a use case.
    """

    # No optional get because all use cases need to have a config defined.
    return _QUERY_CONFIGS[use_case]
