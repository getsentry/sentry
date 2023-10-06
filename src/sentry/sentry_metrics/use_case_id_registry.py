from __future__ import annotations

import re
from enum import Enum
from typing import Mapping, Optional

from sentry_kafka_schemas.codecs import ValidationError

from sentry.sentry_metrics.configuration import UseCaseKey

MRI_RE_PATTERN = re.compile("^([c|s|d|g|e]):([a-zA-Z0-9_]+)/.*$")


class UseCaseID(Enum):
    SPANS = "spans"
    TRANSACTIONS = "transactions"
    SESSIONS = "sessions"
    ESCALATING_ISSUES = "escalating_issues"
    CUSTOM = "custom"


# UseCaseKey will be renamed to MetricPathKey
METRIC_PATH_MAPPING: Mapping[UseCaseID, UseCaseKey] = {
    UseCaseID.SPANS: UseCaseKey.PERFORMANCE,
    UseCaseID.TRANSACTIONS: UseCaseKey.PERFORMANCE,
    UseCaseID.SESSIONS: UseCaseKey.RELEASE_HEALTH,
    UseCaseID.ESCALATING_ISSUES: UseCaseKey.PERFORMANCE,
    UseCaseID.CUSTOM: UseCaseKey.PERFORMANCE,
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
    UseCaseID.CUSTOM: "sentry-metrics.cardinality-limiter.limits.custom.per-org",
}

USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS = {
    UseCaseID.SPANS: "sentry-metrics.writes-limiter.limits.spans",
    UseCaseID.TRANSACTIONS: "sentry-metrics.writes-limiter.limits.performance",
    UseCaseID.SESSIONS: "sentry-metrics.writes-limiter.limits.releasehealth",
    UseCaseID.CUSTOM: "sentry-metrics.writes-limiter.limits.custom",
}


def get_use_case_key(use_case_id: UseCaseID) -> Optional[UseCaseKey]:
    return METRIC_PATH_MAPPING.get(use_case_id)


def extract_use_case_id(mri: str) -> UseCaseID:
    """
    Returns the use case ID given the MRI, returns None if MRI is invalid.
    """
    if matched := MRI_RE_PATTERN.match(mri):
        use_case_str = matched.group(2)
        if use_case_str in {id.value for id in UseCaseID}:
            return UseCaseID(use_case_str)
    raise ValidationError(f"Invalid mri: {mri}")
