from typing import Literal, TypedDict

from pydantic import ConfigDict, Field


class Alert(TypedDict):
    id: int


class TimeSeriesPoint(TypedDict):
    timestamp: float
    value: float


class ADConfig(TypedDict):
    time_period: Literal[15, 30, 60] = Field(
        ...,
        description="Aggregation window used in the time period, in minutes",
    )
    sensitivity: Literal["low", "medium", "high"] = Field(
        ...,
        description="Low means more anomalies will be detected while high means less anomalies will be detected.",
    )
    direction: Literal["up", "down", "both"] = Field(
        ...,
        description="Identifies the type of deviation(s) to detect. Up means only anomalous values above normal values are identified while down means values lower than normal values are identified. Passing both will identify both above and below normal values.",
    )
    expected_seasonality: Literal["hourly", "daily", "weekly", "auto"] = Field(
        ...,
        description="Underlying cyclicality in the time series. Auto means the system will detect by itself.",
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class StoreDataRequest(TypedDict):
    organization_id: int
    project_id: int
    alert: Alert
    config: ADConfig
    timeseries: list[TimeSeriesPoint]
