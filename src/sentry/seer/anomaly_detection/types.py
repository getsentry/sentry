from enum import IntEnum, StrEnum
from typing import NotRequired, TypedDict


class Anomaly(TypedDict):
    anomaly_type: str
    anomaly_score: float


class TimeSeriesPoint(TypedDict):
    timestamp: float
    value: float
    anomaly: NotRequired[Anomaly]
    yhat_lower: NotRequired[float]
    yhat_upper: NotRequired[float]


class DataSourceType(IntEnum):
    SNUBA_QUERY_SUBSCRIPTION = 1


class AlertInSeer(TypedDict):
    id: int | None
    source_id: NotRequired[  # For source_type = SNUBA_QUERY_SUBSCRIPTION, the query subscription ID.
        int
    ]  # during our dual processing rollout, some requests will be sending ID and some will send source_id/source_type
    source_type: NotRequired[DataSourceType]
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


class StoreDataResponse(TypedDict):
    success: bool
    message: NotRequired[str]


class DetectAnomaliesRequest(TypedDict):
    organization_id: int
    project_id: int
    config: AnomalyDetectionConfig
    context: AlertInSeer | list[TimeSeriesPoint]


class DetectHistoricalAnomaliesContext(TypedDict):
    history: list[TimeSeriesPoint]
    current: list[TimeSeriesPoint]


class DetectHistoricalAnomaliesRequest(TypedDict):
    organization_id: int
    project_id: int
    config: AnomalyDetectionConfig
    context: DetectHistoricalAnomaliesContext


class DeleteAlertDataRequest(TypedDict):
    organization_id: int
    project_id: NotRequired[int]
    alert: AlertInSeer


class DetectAnomaliesResponse(TypedDict):
    success: bool
    message: NotRequired[str]
    timeseries: list[TimeSeriesPoint]


class AnomalyType(StrEnum):
    HIGH_CONFIDENCE = "anomaly_higher_confidence"
    LOW_CONFIDENCE = "anomaly_lower_confidence"
    NONE = "none"
    NO_DATA = "no_data"


class AnomalyDetectionSensitivity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AnomalyDetectionSeasonality(StrEnum):
    """All combinations of multi select fields for anomaly detection alerts
    We do not anticipate adding more
    """

    AUTO = "auto"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    HOURLY_DAILY = "hourly_daily"
    HOURLY_WEEKLY = "hourly_weekly"
    HOURLY_DAILY_WEEKLY = "hourly_daily_weekly"
    DAILY_WEEKLY = "daily_weekly"


class AnomalyDetectionThresholdType(IntEnum):
    ABOVE = 0
    BELOW = 1
    ABOVE_AND_BELOW = 2


class AnomalyThresholdDataPoint(TypedDict):
    external_alert_id: int
    timestamp: float
    value: float
    yhat_lower: float
    yhat_upper: float


class SeerDetectorDataResponse(TypedDict):
    success: bool
    message: str | None
    data: list[AnomalyThresholdDataPoint]
