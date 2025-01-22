from __future__ import annotations

from collections.abc import Mapping
from enum import Enum

from sentry.sentry_metrics.configuration import UseCaseKey


class UseCaseIDAPIAccess(Enum):
    """
    Represents the access levels of a UseCaseID for sentry's APIs.
    """

    PUBLIC = 0
    PRIVATE = 1


class UseCaseID(Enum):
    SPANS = "spans"
    TRANSACTIONS = "transactions"
    SESSIONS = "sessions"
    ESCALATING_ISSUES = "escalating_issues"
    CUSTOM = "custom"
    PROFILES = "profiles"
    METRIC_STATS = "metric_stats"


USE_CASE_ID_API_ACCESSES: Mapping[UseCaseID, UseCaseIDAPIAccess] = {
    UseCaseID.SPANS: UseCaseIDAPIAccess.PUBLIC,
    UseCaseID.TRANSACTIONS: UseCaseIDAPIAccess.PUBLIC,
    UseCaseID.SESSIONS: UseCaseIDAPIAccess.PUBLIC,
    UseCaseID.ESCALATING_ISSUES: UseCaseIDAPIAccess.PRIVATE,
    UseCaseID.CUSTOM: UseCaseIDAPIAccess.PUBLIC,
    UseCaseID.PROFILES: UseCaseIDAPIAccess.PRIVATE,
    UseCaseID.METRIC_STATS: UseCaseIDAPIAccess.PRIVATE,
}

# UseCaseKey will be renamed to MetricPathKey
METRIC_PATH_MAPPING: Mapping[UseCaseID, UseCaseKey] = {
    UseCaseID.SPANS: UseCaseKey.PERFORMANCE,
    UseCaseID.TRANSACTIONS: UseCaseKey.PERFORMANCE,
    UseCaseID.SESSIONS: UseCaseKey.RELEASE_HEALTH,
    UseCaseID.ESCALATING_ISSUES: UseCaseKey.PERFORMANCE,
    UseCaseID.CUSTOM: UseCaseKey.PERFORMANCE,
    UseCaseID.PROFILES: UseCaseKey.PERFORMANCE,
    UseCaseID.METRIC_STATS: UseCaseKey.PERFORMANCE,
}

# TODO: Remove this as soon as the entire indexer system is use case aware
# as this is temporary and eventually UseCaseKey will have a 1:N relationship
# with UseCaseID
REVERSE_METRIC_PATH_MAPPING: Mapping[UseCaseKey, UseCaseID] = {
    UseCaseKey.RELEASE_HEALTH: UseCaseID.SESSIONS,
    UseCaseKey.PERFORMANCE: UseCaseID.TRANSACTIONS,
}

# Temporary allowlist until all use cases have cardinality limit options
CARDINALITY_LIMIT_USE_CASES = (
    UseCaseID.TRANSACTIONS,
    UseCaseID.SESSIONS,
    UseCaseID.SPANS,
    UseCaseID.CUSTOM,
)

USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS = {
    UseCaseID.SPANS: "sentry-metrics.writes-limiter.limits.spans",
    UseCaseID.TRANSACTIONS: "sentry-metrics.writes-limiter.limits.performance",
    UseCaseID.SESSIONS: "sentry-metrics.writes-limiter.limits.releasehealth",
    UseCaseID.CUSTOM: "sentry-metrics.writes-limiter.limits.custom",
}


def get_use_case_id_api_access(use_case_id: UseCaseID) -> UseCaseIDAPIAccess:
    """
    Returns the api access visibility of a use case and defaults to private in case no api access is provided.

    The rationale for defaulting to private visibility is that we do not want to leak by mistake any internal metrics
    that users should not have access to.
    """
    return USE_CASE_ID_API_ACCESSES.get(use_case_id, UseCaseIDAPIAccess.PRIVATE)
