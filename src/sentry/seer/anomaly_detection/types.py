from enum import Enum
from typing import TypedDict


class AlertInSeer(TypedDict):
    id: int


class TimeSeriesPoint(TypedDict):
    timestamp: float
    value: float


class AnomalyDetectionConfig(TypedDict):
    time_period: int
    sensitivity: str
    direction: str
    expected_seasonality: str


class StoreDataRequest(TypedDict):
    organization_id: int
    project_id: int
    alert: AlertInSeer
    config: AnomalyDetectionConfig
    timeseries: list[TimeSeriesPoint]


class AnomalyType(Enum):
    HIGH_CONFIDENCE = "anomaly_higher_confidence"
    LOW_CONFIDENCE = "anomaly_lower_confidence"
    NONE = "none"
    NO_DATA = "no_data"


class DynamicAlertRuleData(TypedDict):
    alert_rule_id: int
    seasonality: str
    sensitivity: str
    threshold_type: str


class SnubaQueryData(TypedDict):
    query: str
    time_window: int
    dataset: str
    aggregate: str
