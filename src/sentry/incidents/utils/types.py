from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict

# TODO: Remove this re-export once getsentry imports the constant from
# `sentry.incidents.utils.constants`.
from sentry.incidents.utils.constants import (
    DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION as DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
)
from sentry.workflow_engine.handlers.detector.base import EvidenceData
from sentry.workflow_engine.models.data_source import DataPacket


class QuerySubscriptionUpdateValues(TypedDict):
    data: list[dict[str, Any]]


class QuerySubscriptionUpdate(TypedDict):
    entity: str
    subscription_id: str
    values: QuerySubscriptionUpdateValues
    timestamp: datetime


class StaticDetectorEvaluationValues(TypedDict):
    value: float


class PercentDetectorEvaluationValues(TypedDict):
    value: float  # `current` as a percentage of `baseline`
    current: float
    baseline: float


class AnomalyDetectionEvaluationValues(TypedDict):
    value: float
    source_id: str
    subscription_id: str
    timestamp: datetime


@dataclass
class MetricDetectorProcessedSubscriptionUpdateBase[ValuesType]:
    """
    A processed subscription update, ready to be sent to a metric detector. Subclassed by detection
    type, so the detector handler can tell them apart.
    """

    entity: str
    subscription_id: str
    values: ValuesType
    timestamp: datetime


@dataclass
class StaticDetectorProcessedSubscriptionUpdate(
    MetricDetectorProcessedSubscriptionUpdateBase[StaticDetectorEvaluationValues]
):
    pass


@dataclass
class PercentDetectorProcessedSubscriptionUpdate(
    MetricDetectorProcessedSubscriptionUpdateBase[PercentDetectorEvaluationValues]
):
    pass


@dataclass
class AnomalyDetectionProcessedSubscriptionUpdate(
    MetricDetectorProcessedSubscriptionUpdateBase[AnomalyDetectionEvaluationValues]
):
    pass


MetricDetectorProcessedSubscriptionUpdate = (
    StaticDetectorProcessedSubscriptionUpdate
    | PercentDetectorProcessedSubscriptionUpdate
    | AnomalyDetectionProcessedSubscriptionUpdate
)


MetricDetectorDataPacket = DataPacket[MetricDetectorProcessedSubscriptionUpdate]
StaticDetectorDataPacket = DataPacket[StaticDetectorProcessedSubscriptionUpdate]
PercentDetectorDataPacket = DataPacket[PercentDetectorProcessedSubscriptionUpdate]
AnomalyDetectionDataPacket = DataPacket[AnomalyDetectionProcessedSubscriptionUpdate]


MetricResult = float | AnomalyDetectionEvaluationValues


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
