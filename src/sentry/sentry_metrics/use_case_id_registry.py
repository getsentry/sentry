from __future__ import annotations

from enum import Enum
from typing import Mapping

from sentry.sentry_metrics.configuration import UseCaseKey


class UseCaseID(Enum):
    PERFORMANCE = "performance"
    RELEASE_HEALTH = "release-health"


# UseCaseKey will be renamed to MetricPathKey
METRIC_PATH_MAPPING: Mapping[UseCaseID, UseCaseKey] = {
    UseCaseID.RELEASE_HEALTH: UseCaseKey.RELEASE_HEALTH,
    UseCaseID.PERFORMANCE: UseCaseKey.PERFORMANCE,
}


def get_metric_path_from_usecase(use_case: UseCaseID) -> UseCaseKey:
    return METRIC_PATH_MAPPING[use_case]


NAMESPACE_MAPPING: Mapping[UseCaseID, str] = {
    UseCaseID.RELEASE_HEALTH: "sessions",
    UseCaseID.PERFORMANCE: "transactions",
}


def get_namespace_from_usecase(use_case: UseCaseID) -> str:
    if use_case in NAMESPACE_MAPPING:
        return NAMESPACE_MAPPING[use_case]

    return use_case.value


def get_usecase_from_namespace(namespace: str) -> UseCaseID:
    for use_case in NAMESPACE_MAPPING:
        if NAMESPACE_MAPPING[use_case] == namespace:
            return use_case

    return UseCaseID(namespace)
