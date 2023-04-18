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


def get_metric_path_from_usecase(use_case: UseCaseID) -> UseCaseKey:
    return METRIC_PATH_MAPPING[use_case]
