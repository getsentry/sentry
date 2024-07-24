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
