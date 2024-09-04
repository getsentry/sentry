from enum import Enum
from typing import NotRequired, TypedDict


class Anomaly(TypedDict):
    anomaly_type: str
    anomaly_value: float


class TimeSeriesPoint(TypedDict):
    timestamp: float
    value: float


class AlertInSeer(TypedDict):
    id: int
    cur_window: NotRequired[TimeSeriesPoint]


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


class DetectAnomaliesRequest(TypedDict):
    organization_id: int
    project_id: int
    config: AnomalyDetectionConfig
    context: AlertInSeer | list[TimeSeriesPoint]


class AnomalyType(Enum):
    HIGH_CONFIDENCE = "anomaly_higher_confidence"
    LOW_CONFIDENCE = "anomaly_lower_confidence"
    NONE = "none"
    NO_DATA = "no_data"
