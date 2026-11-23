from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict

# TODO: Remove this re-export once getsentry imports the constant from
# `sentry.incidents.utils.constants`.
from sentry.incidents.utils.constants import (
    DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION as DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
)
from sentry.workflow_engine.handlers.detector.base import EvidenceData


class QuerySubscriptionUpdateValues(TypedDict):
    data: list[dict[str, Any]]


class QuerySubscriptionUpdate(TypedDict):
    entity: str
    subscription_id: str
    values: QuerySubscriptionUpdateValues
    timestamp: datetime


class SubscriptionUpdateValues(TypedDict):
    value: float


class AnomalyDetectionValues(TypedDict):
    value: float
    source_id: str
    subscription_id: str
    timestamp: datetime


@dataclass
class ProcessedSubscriptionUpdate:
    entity: str
    subscription_id: str
    values: SubscriptionUpdateValues
    timestamp: datetime


@dataclass
class AnomalyDetectionUpdate:
    entity: str
    subscription_id: str
    values: AnomalyDetectionValues
    timestamp: datetime


MetricUpdate = ProcessedSubscriptionUpdate | AnomalyDetectionUpdate


MetricResult = float | AnomalyDetectionValues


# Post-serialization: what's stored in evidence data after JSON round-trip.
class StoredAnomalyDetectionResult(TypedDict):
    value: float
    source_id: str
    subscription_id: str
    timestamp: str


StoredMetricResult = float | StoredAnomalyDetectionResult | None


@dataclass
class MetricIssueEvidenceData(EvidenceData[StoredMetricResult]):
    alert_id: int
