from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import StrEnum
from typing import Literal, TypedDict

from sentry import features
from sentry.incidents.handlers.condition import *  # noqa
from sentry.incidents.models.alert_rule import ComparisonDeltaChoices
from sentry.incidents.utils.types import (
    AnomalyDetectionUpdate,
    AnomalyDetectionValues,
    ProcessedSubscriptionUpdate,
)
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.models.organization import Organization
from sentry.ratelimits.sliding_windows import Quota
from sentry.snuba.dataset import Dataset
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector.base import EvidenceData
from sentry.workflow_engine.types import DetectorType

logger = logging.getLogger(__name__)

COMPARISON_DELTA_CHOICES: list[None | int] = [choice.value for choice in ComparisonDeltaChoices]
COMPARISON_DELTA_CHOICES.append(None)

QUERY_AGGREGATION_DISPLAY = {
    "count()": "Number of events",
    "count_unique(tags[sentry:user])": "Number of users affected",
    "percentage(sessions_crashed, sessions)": "Crash free session rate",
    "percentage(users_crashed, users)": "Crash free user rate",
    "failure_rate()": "Failure rate",
    "apdex()": "Apdex score",
}


MetricUpdate = ProcessedSubscriptionUpdate | AnomalyDetectionUpdate

MetricResult = float | AnomalyDetectionValues


# Post-serialization: what's stored in evidence data after JSON round-trip.
class StoredAnomalyDetectionResult(TypedDict):
    value: float
    source_id: str
    subscription_id: str
    timestamp: str


StoredMetricResult = float | StoredAnomalyDetectionResult


@dataclass
class MetricIssueEvidenceData(EvidenceData[StoredMetricResult]):
    alert_id: int


class SessionsAggregate(StrEnum):
    CRASH_FREE_SESSIONS = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
    CRASH_FREE_USERS = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"


# Define all possible alert type values as a literal type
MetricAlertType = Literal[
    "num_errors",
    "users_experiencing_errors",
    "throughput",
    "trans_duration",
    "apdex",
    "failure_rate",
    "lcp",
    "fid",
    "cls",
    "crash_free_sessions",
    "crash_free_users",
    "trace_item_throughput",
    "trace_item_duration",
    "trace_item_apdex",
    "trace_item_failure_rate",
    "trace_item_lcp",
    "custom_transactions",
    "eap_metrics",
]

AggregateIdentifier = Literal[
    "count()",
    "count_unique(user)",
    "transaction.duration",
    "apdex",
    "failure_rate()",
    "measurements.lcp",
    "measurements.fid",
    "measurements.cls",
    "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
    "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
    "count(span.duration)",
    "span.duration",
]

ALERT_TYPE_IDENTIFIERS: dict[Dataset, dict[MetricAlertType, AggregateIdentifier]] = {
    Dataset.Events: {"num_errors": "count()", "users_experiencing_errors": "count_unique(user)"},
    Dataset.Transactions: {
        "throughput": "count()",
        "trans_duration": "transaction.duration",
        "apdex": "apdex",
        "failure_rate": "failure_rate()",
        "lcp": "measurements.lcp",
        "fid": "measurements.fid",
        "cls": "measurements.cls",
    },
    Dataset.PerformanceMetrics: {
        "throughput": "count()",
        "trans_duration": "transaction.duration",
        "apdex": "apdex",
        "failure_rate": "failure_rate()",
        "lcp": "measurements.lcp",
        "fid": "measurements.fid",
        "cls": "measurements.cls",
    },
    Dataset.Sessions: {
        "crash_free_sessions": SessionsAggregate.CRASH_FREE_SESSIONS.value,
        "crash_free_users": SessionsAggregate.CRASH_FREE_USERS.value,
    },
    Dataset.Metrics: {
        "crash_free_sessions": SessionsAggregate.CRASH_FREE_SESSIONS.value,
        "crash_free_users": SessionsAggregate.CRASH_FREE_USERS.value,
    },
    Dataset.EventsAnalyticsPlatform: {
        "trace_item_throughput": "count(span.duration)",
        "trace_item_duration": "span.duration",
        "trace_item_apdex": "apdex",
        "trace_item_failure_rate": "failure_rate()",
        "trace_item_lcp": "measurements.lcp",
    },
}


def get_alert_type_from_aggregate_dataset(
    aggregate: str, dataset: Dataset, organization: Organization | None = None
) -> MetricAlertType:
    """
    Given an aggregate and dataset object, will return the corresponding wizard alert type
    e.g. {'aggregate': 'count()', 'dataset': Dataset.ERRORS} will yield 'num_errors'

    This function is used to format the aggregate value for anomaly detection issues.
    """
    identifier_for_dataset = ALERT_TYPE_IDENTIFIERS.get(dataset, {})

    # Find matching alert type entry
    matching_alert_type: MetricAlertType | None = None
    for alert_type, identifier in identifier_for_dataset.items():
        if identifier in aggregate:
            matching_alert_type = alert_type
            break

    # Special handling for EventsAnalyticsPlatform dataset
    if dataset == Dataset.EventsAnalyticsPlatform:
        if organization and features.has(
            "organizations:discover-saved-queries-deprecation", organization
        ):
            return matching_alert_type if matching_alert_type else "eap_metrics"

        return "eap_metrics"

    return matching_alert_type if matching_alert_type else "custom_transactions"


@dataclass(frozen=True)
class MetricIssue(GroupType):
    type_id = 8001
    slug = "metric_issue"
    description = "Metric issue triggered"
    category = GroupCategory.METRIC_ALERT.value
    category_v2 = GroupCategory.METRIC.value
    creation_quota = Quota(3600, 60, 100)
    default_priority = PriorityLevel.HIGH
    released = True
    enable_auto_resolve = False
    enable_escalation_detection = False
    enable_status_change_workflow_notifications = False
    enable_workflow_notifications = False
    enable_user_status_and_priority_changes = False
    detector_type = DetectorType.METRIC_ISSUE
