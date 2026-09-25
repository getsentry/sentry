from dataclasses import dataclass
from enum import StrEnum
from typing import Literal, NotRequired, TypedDict

from sentry.ingestion_delay.meta import IngestionMeta

# Assumed ingestion delay for timeseries, this is a static number for now just to match how the frontend was doing it
INGESTION_DELAY = 90
INGESTION_DELAY_MESSAGE = "INCOMPLETE_BUCKET"


class IncompleteReason(StrEnum):
    """Why a bucket holds less data than its width suggests."""

    NOT_ELAPSED = "NOT_ELAPSED"
    INGESTION_PENDING = "INGESTION_PENDING"
    OUTSIDE_RETENTION = "OUTSIDE_RETENTION"


@dataclass(frozen=True)
class BucketBoundaries:
    now: float
    complete_through: float
    retention_start: float | None = None

    def incomplete_reason(self, bucket_start: float, rollup: int) -> IncompleteReason | None:
        bucket_end = bucket_start + rollup
        if bucket_end > self.now:
            return IncompleteReason.NOT_ELAPSED

        if self.retention_start is not None and bucket_start < self.retention_start:
            return IncompleteReason.OUTSIDE_RETENTION

        if bucket_end >= self.complete_through:
            return IncompleteReason.INGESTION_PENDING

        return None


class Annotation(TypedDict):
    """One time bucket's volume for a system data-fidelity annotation."""

    type: Literal["system"]
    category: str
    outcome: str
    reason: str
    start: float
    end: float
    eventCount: float
    # Only present for datasets with a paired byte category (logs today).
    byteSize: NotRequired[float]


class StatsMeta(TypedDict):
    dataset: str
    start: float
    end: float
    droppedAnnotations: NotRequired[list[Annotation]]
    acceptedAnnotations: NotRequired[list[Annotation]]
    ingestion: NotRequired[IngestionMeta]


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
