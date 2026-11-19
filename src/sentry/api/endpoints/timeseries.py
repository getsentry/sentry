from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated, Literal, NotRequired, TypedDict

from sentry.apidocs.descriptions import ApiDescription
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


class StatsMeta(TypedDict):
    dataset: Annotated[str, ApiDescription("Dataset that was queried")]
    start: Annotated[
        float,
        ApiDescription("Start of the queried time range, in milliseconds since the Unix epoch"),
    ]
    end: Annotated[
        float, ApiDescription("End of the queried time range, in milliseconds since the Unix epoch")
    ]
    ingestion: NotRequired[IngestionMeta]


class Row(TypedDict):
    timestamp: Annotated[
        float, ApiDescription("Start of the bucket, in milliseconds since the Unix epoch")
    ]
    value: Annotated[
        float | None,
        ApiDescription("Value of the aggregate for this bucket, or null if there is no data"),
    ]
    incomplete: Annotated[bool, ApiDescription("Whether this bucket may hold incomplete data")]
    comparisonValue: NotRequired[
        Annotated[
            float | None,
            ApiDescription("Value of the aggregate for the same bucket in the comparison period"),
        ]
    ]
    filled: NotRequired[
        Annotated[bool, ApiDescription("Whether this value was filled in by a fill transformation")]
    ]
    smoothed: NotRequired[
        Annotated[
            bool, ApiDescription("Whether this value was produced by a smoothing transformation")
        ]
    ]
    comparisonFilled: NotRequired[
        Annotated[
            bool,
            ApiDescription("Whether the comparison value was filled in by a fill transformation"),
        ]
    ]
    comparisonSmoothed: NotRequired[
        Annotated[
            bool,
            ApiDescription(
                "Whether the comparison value was produced by a smoothing transformation"
            ),
        ]
    ]
    sampleCount: NotRequired[
        Annotated[float, ApiDescription("Number of sampled rows that make up this bucket")]
    ]
    sampleRate: NotRequired[
        Annotated[
            float | None,
            ApiDescription(
                "Sampling rate of the data in this bucket, or null if the bucket has no data"
            ),
        ]
    ]
    confidence: NotRequired[
        Annotated[
            Literal["low", "high"] | None,
            ApiDescription("Confidence in the extrapolated value: `low` or `high`"),
        ]
    ]
    incompleteReason: NotRequired[
        Annotated[
            str,
            ApiDescription(
                "Why the bucket is incomplete: `NOT_ELAPSED`, `INGESTION_PENDING` or `OUTSIDE_RETENTION`"
            ),
        ]
    ]


class SeriesMeta(TypedDict):
    order: NotRequired[
        Annotated[int, ApiDescription("Position of this series among the top events series")]
    ]
    isOther: NotRequired[
        Annotated[
            bool, ApiDescription("Whether this series aggregates all events outside the top events")
        ]
    ]
    valueUnit: Annotated[
        str | None,
        ApiDescription(
            "Unit of the values, such as `millisecond` or `byte`, or null if they have no unit"
        ),
    ]
    dataScanned: NotRequired[
        Annotated[
            Literal["partial", "full"],
            ApiDescription(
                "Whether the query scanned the `full` data set or only a `partial` sample"
            ),
        ]
    ]
    valueType: Annotated[
        str, ApiDescription("Type of the values, such as `integer`, `duration` or `size`")
    ]
    interval: Annotated[float, ApiDescription("Width of each bucket, in milliseconds")]


class GroupBy(TypedDict):
    key: Annotated[str, ApiDescription("Name of the field this series is grouped by")]
    value: Annotated[
        str | float | None, ApiDescription("Value of the grouped field for this series")
    ]


class TimeSeries(TypedDict):
    values: Annotated[list[Row], ApiDescription("Buckets in the series, in time order")]
    yAxis: Annotated[str, ApiDescription("Aggregate this series plots, such as `count()`")]
    groupBy: NotRequired[
        Annotated[
            list[GroupBy],
            ApiDescription("Fields and values that identify this series when results are grouped"),
        ]
    ]
    meta: Annotated[SeriesMeta, ApiDescription("Metadata about the series")]


class StatsResponse(TypedDict):
    meta: NotRequired[Annotated[StatsMeta, ApiDescription("Metadata about the query")]]
    timeSeries: Annotated[
        list[TimeSeries], ApiDescription("Series returned by the query, one per y-axis and group")
    ]


EMPTY_STATS_RESPONSE: StatsResponse = {
    "timeSeries": [],
}
