from typing import Literal, NotRequired, TypedDict

# Assumed ingestion delay for timeseries, this is a static number for now just to match how the frontend was doing it
INGESTION_DELAY = 90
INGESTION_DELAY_MESSAGE = "INCOMPLETE_BUCKET"


class Annotation(TypedDict):
    """A system annotation explaining that data over a time range was affected by
    an external factor. One annotation per (bucket, outcome, reason) drop."""

    type: Literal["system"]
    category: str
    reason: str
    start: float
    end: float
    droppedCount: float
    label: str
    # Only present for datasets with a paired byte category (logs today).
    droppedBytes: NotRequired[float]


class BucketAccepted(TypedDict):
    """Accepted volume for a single time bucket. Accepted is a property of the
    bucket (baseline traffic), not of any one drop, so it lives here rather than
    being repeated on every annotation. A consumer computes a drop's share as
    droppedCount / (acceptedCount + total dropped) by joining on ``start``."""

    start: float
    end: float
    acceptedCount: float
    # Only present for datasets with a paired byte category (logs today).
    acceptedBytes: NotRequired[float]


class StatsMeta(TypedDict):
    dataset: str
    start: float
    end: float
    annotations: NotRequired[list[Annotation]]
    # Per-bucket accepted volume, aligned to ``annotations`` by ``start``.
    acceptedByBucket: NotRequired[list[BucketAccepted]]
    estimatedIngestionDelaySeconds: NotRequired[float]


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
    value: str | float | None


class TimeSeries(TypedDict):
    values: list[Row]
    yAxis: str
    groupBy: NotRequired[list[GroupBy]]
    meta: SeriesMeta


class StatsResponse(TypedDict):
    meta: NotRequired[StatsMeta]
    timeSeries: list[TimeSeries]


EMPTY_STATS_RESPONSE: StatsResponse = {
    "timeSeries": [],
}
