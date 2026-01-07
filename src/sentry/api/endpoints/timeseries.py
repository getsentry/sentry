from typing import Any, Literal, NotRequired, TypedDict

# Assumed ingestion delay for timeseries, this is a static number for now just to match how the frontend was doing it
INGESTION_DELAY = 90
INGESTION_DELAY_MESSAGE = "INCOMPLETE_BUCKET"


class StatsMeta(TypedDict):
    dataset: str
    start: float
    end: float


class Row(TypedDict):
    timestamp: float
    value: float
    incomplete: bool
    comparisonValue: NotRequired[float]
    sampleCount: NotRequired[float]
    sampleRate: NotRequired[float | None]
    confidence: NotRequired[Literal["low", "high"] | None]
    incompleteReason: NotRequired[str]


class SeriesMeta(TypedDict):
    order: NotRequired[int]
    isOther: NotRequired[bool]
    valueUnit: str | None
    dataScanned: NotRequired[Literal["partial", "full"]]
    valueType: str
    interval: float


class GroupBy(TypedDict):
    key: str
    value: str | None


class TimeSeries(TypedDict):
    values: list[Row]
    yAxis: str
    groupBy: NotRequired[list[GroupBy]]
    meta: SeriesMeta


class StatsResponse(TypedDict):
    meta: NotRequired[StatsMeta]
    timeSeries: list[TimeSeries]


EMPTY_STATS_RESPONSE: dict[str, Any] = {
    "timeSeries": [],
}
