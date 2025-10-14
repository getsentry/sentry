from typing import Literal, NotRequired, TypedDict


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
    value: str


class TimeSeries(TypedDict):
    values: list[Row]
    yAxis: str
    groupBy: NotRequired[list[GroupBy]]
    meta: SeriesMeta


class StatsResponse(TypedDict):
    meta: StatsMeta
    timeSeries: list[TimeSeries]
