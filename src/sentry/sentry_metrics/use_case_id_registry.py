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
    PROFILES = "profiles"
    METRIC_STATS = "metric_stats"


USE_CASE_ID_API_ACCESSES: Mapping[UseCaseID, UseCaseIDAPIAccess] = {
    UseCaseID.SPANS: UseCaseIDAPIAccess.PUBLIC,
    UseCaseID.TRANSACTIONS: UseCaseIDAPIAccess.PUBLIC,
    UseCaseID.SESSIONS: UseCaseIDAPIAccess.PUBLIC,
    UseCaseID.PROFILES: UseCaseIDAPIAccess.PRIVATE,
    UseCaseID.METRIC_STATS: UseCaseIDAPIAccess.PRIVATE,
}

METRIC_PATH_MAPPING: Mapping[UseCaseID, UseCaseKey] = {
    UseCaseID.SESSIONS: UseCaseKey.RELEASE_HEALTH,
}

REVERSE_METRIC_PATH_MAPPING: Mapping[UseCaseKey, UseCaseID] = {
    UseCaseKey.RELEASE_HEALTH: UseCaseID.SESSIONS,
}

CARDINALITY_LIMIT_USE_CASES = (UseCaseID.SESSIONS,)

USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS = {
    UseCaseID.SESSIONS: "sentry-metrics.writes-limiter.limits.releasehealth",
}


def get_use_case_id_api_access(use_case_id: UseCaseID) -> UseCaseIDAPIAccess:
    """
    Returns the api access visibility of a use case and defaults to private in case no api access is provided.

    The rationale for defaulting to private visibility is that we do not want to leak by mistake any internal metrics
    that users should not have access to.
    """
    return USE_CASE_ID_API_ACCESSES.get(use_case_id, UseCaseIDAPIAccess.PRIVATE)
