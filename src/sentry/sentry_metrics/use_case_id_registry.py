from __future__ import annotations

from enum import Enum
from typing import Mapping

from sentry.sentry_metrics.configuration import UseCaseKey


class UseCaseID(Enum):
    TRANSACTIONS = "transactions"
    SESSIONS = "sessions"


# UseCaseKey will be renamed to MetricPathKey
METRIC_PATH_MAPPING: Mapping[UseCaseID, UseCaseKey] = {
    UseCaseID.SESSIONS: UseCaseKey.RELEASE_HEALTH,
    UseCaseID.TRANSACTIONS: UseCaseKey.PERFORMANCE,
}

# TODO: Remove this as soon as the entire indexer system is use case aware
# as this is temporary and eventually UseCaseKey will have a 1:N relationship
# with UseCaseID
REVERSE_METRIC_PATH_MAPPING: Mapping[UseCaseKey, UseCaseID] = {
    UseCaseKey.RELEASE_HEALTH: UseCaseID.SESSIONS,
    UseCaseKey.PERFORMANCE: UseCaseID.TRANSACTIONS,
}


def get_metric_path_from_usecase(use_case: UseCaseID) -> UseCaseKey:
    return METRIC_PATH_MAPPING[use_case]
