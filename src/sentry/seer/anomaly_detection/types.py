from typing import TypedDict


class Alert(TypedDict):
    id: int


class TimeSeriesPoint(TypedDict):
    timestamp: float
    value: float


class ADConfig(TypedDict):
    time_period: int
    sensitivity: str
    direction: str
    expected_seasonality: str


class StoreDataRequest(TypedDict):
    organization_id: int
    project_id: int
    alert: Alert
    config: ADConfig
    timeseries: list[TimeSeriesPoint]
