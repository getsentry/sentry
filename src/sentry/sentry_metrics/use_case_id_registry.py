from __future__ import annotations

from collections.abc import Mapping
from enum import Enum

from sentry_kafka_schemas.codecs import ValidationError

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics import parse_mri


class UseCaseIDVisibility(Enum):
    # Available to users to query via public endpoints.
    PUBLIC = 0
    # Available only internally.
    PRIVATE = 1


class UseCaseID(Enum):
    SPANS = "spans"
    TRANSACTIONS = "transactions"
    SESSIONS = "sessions"
    ESCALATING_ISSUES = "escalating_issues"
    CUSTOM = "custom"
    PROFILES = "profiles"
    BUNDLE_ANALYSIS = "bundle_analysis"
    METRIC_STATS = "metric_stats"


USE_CASE_ID_VISIBILITIES: Mapping[UseCaseID, UseCaseIDVisibility] = {
    UseCaseID.SPANS: UseCaseIDVisibility.PUBLIC,
    UseCaseID.TRANSACTIONS: UseCaseIDVisibility.PUBLIC,
    UseCaseID.SESSIONS: UseCaseIDVisibility.PUBLIC,
    UseCaseID.ESCALATING_ISSUES: UseCaseIDVisibility.PRIVATE,
    UseCaseID.CUSTOM: UseCaseIDVisibility.PUBLIC,
    UseCaseID.PROFILES: UseCaseIDVisibility.PRIVATE,
    UseCaseID.BUNDLE_ANALYSIS: UseCaseIDVisibility.PRIVATE,
    UseCaseID.METRIC_STATS: UseCaseIDVisibility.PRIVATE,
}

# UseCaseKey will be renamed to MetricPathKey
METRIC_PATH_MAPPING: Mapping[UseCaseID, UseCaseKey] = {
    UseCaseID.SPANS: UseCaseKey.PERFORMANCE,
    UseCaseID.TRANSACTIONS: UseCaseKey.PERFORMANCE,
    UseCaseID.SESSIONS: UseCaseKey.RELEASE_HEALTH,
    UseCaseID.ESCALATING_ISSUES: UseCaseKey.PERFORMANCE,
    UseCaseID.CUSTOM: UseCaseKey.PERFORMANCE,
    UseCaseID.BUNDLE_ANALYSIS: UseCaseKey.PERFORMANCE,
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

USE_CASE_ID_CARDINALITY_LIMIT_QUOTA_OPTIONS = {
    UseCaseID.TRANSACTIONS: "sentry-metrics.cardinality-limiter.limits.performance.per-org",
    UseCaseID.SESSIONS: "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
    UseCaseID.SPANS: "sentry-metrics.cardinality-limiter.limits.spans.per-org",
    UseCaseID.CUSTOM: "sentry-metrics.cardinality-limiter.limits.custom.per-org",
    UseCaseID.PROFILES: "sentry-metrics.cardinality-limiter.limits.profiles.per-org",
}

USE_CASE_ID_WRITES_LIMIT_QUOTA_OPTIONS = {
    UseCaseID.SPANS: "sentry-metrics.writes-limiter.limits.spans",
    UseCaseID.TRANSACTIONS: "sentry-metrics.writes-limiter.limits.performance",
    UseCaseID.SESSIONS: "sentry-metrics.writes-limiter.limits.releasehealth",
    UseCaseID.CUSTOM: "sentry-metrics.writes-limiter.limits.custom",
}


def get_use_case_id_visibility(use_case_id: UseCaseID) -> UseCaseIDVisibility:
    """
    Returns the visibility of a use case and defaults to private in case no visibility is provided.

    The rationale for defaulting to private visibility is that we do not want to leak by mistake any internal metrics
    that users should not have access to.
    """
    return USE_CASE_ID_VISIBILITIES.get(use_case_id, UseCaseIDVisibility.PRIVATE)


def extract_use_case_id(mri: str) -> UseCaseID:
    """
    Returns the use case ID given the MRI, throws an error if MRI is invalid or the use case doesn't exist.
    """
    parsed_mri = parse_mri(mri)
    if parsed_mri is not None:
        if parsed_mri.namespace in {id.value for id in UseCaseID}:
            return UseCaseID(parsed_mri.namespace)

        raise ValidationError(f"The use case of the MRI {parsed_mri.namespace} does not exist")

    raise ValidationError(f"The MRI {mri} is not valid")
