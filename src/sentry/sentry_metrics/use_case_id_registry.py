from __future__ import annotations

from enum import Enum
from typing import Mapping

from sentry.sentry_metrics.configuration import MetricPathKey


class UseCaseID(Enum):
    SPANS = "spans"
    TRANSACTIONS = "transactions"
    SESSIONS = "sessions"


# UseCaseKey will be renamed to MetricPathKey
METRIC_PATH_MAPPING: Mapping[UseCaseID, MetricPathKey] = {
    UseCaseID.SPANS: MetricPathKey.PERFORMANCE,
    UseCaseID.TRANSACTIONS: MetricPathKey.PERFORMANCE,
    UseCaseID.SESSIONS: MetricPathKey.RELEASE_HEALTH,
}

# TODO: Remove this as soon as the entire indexer system is use case aware
# as this is temporary and eventually UseCaseKey will have a 1:N relationship
# with UseCaseID
REVERSE_METRIC_PATH_MAPPING: Mapping[MetricPathKey, UseCaseID] = {
    MetricPathKey.RELEASE_HEALTH: UseCaseID.SESSIONS,
    MetricPathKey.PERFORMANCE: UseCaseID.TRANSACTIONS,
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


def get_metric_path_from_usecase(use_case: UseCaseID) -> MetricPathKey:
    return METRIC_PATH_MAPPING[use_case]
