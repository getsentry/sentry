from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, ClassVar

from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
)
from sentry.web.frontend.debug.charts.metric_detector_open_periods import (
    AnomalyBand,
    OpenPeriodIdentity,
    ThresholdCondition,
    build_open_periods,
    evaluate_anomaly_priorities,
    evaluate_percent_priorities,
    evaluate_threshold_priorities,
)
from sentry.web.frontend.debug.charts.metric_detector_payloads import (
    MetricQuery,
    build_anomaly_threshold_payloads,
    build_chart_data_payload,
    build_detector_payload,
    build_span_query,
)
from sentry.web.frontend.debug.charts.metric_detector_series import (
    Bump,
    SeriesShape,
    build_expected_values,
    build_series_values,
    build_timeseries_points,
    get_bucket_starts_ms,
)
from sentry.workflow_engine.types import DetectorPriorityLevel

CHART_END = datetime(2026, 11, 9, 18, 0, tzinfo=UTC)

FIVE_MINUTES = 300

FIFTEEN_MINUTES = 900

ONE_HOUR = 3600

ONE_DAY = 86400

ONE_WEEK = 604800

NOISE_MULTIPLES_BY_SENSITIVITY = {
    AnomalyDetectionSensitivity.LOW: 5,
    AnomalyDetectionSensitivity.MEDIUM: 4,
    AnomalyDetectionSensitivity.HIGH: 3,
}


@dataclass(frozen=True)
class EvaluatedSeries:
    values: Sequence[float]
    priorities: Sequence[DetectorPriorityLevel]
    comparison_values: Sequence[float] = ()
    anomaly_band: AnomalyBand | None = None


@dataclass(frozen=True)
class MetricDetectorExample:
    key: str
    title: str
    chart_data: dict[str, Any]


def build_threshold_condition_payloads(
    conditions: Sequence[ThresholdCondition],
) -> list[dict[str, Any]]:
    return [
        {
            "type": condition.type,
            "comparison": condition.comparison,
            "conditionResult": condition.priority.value,
        }
        for condition in conditions
    ]


@dataclass(frozen=True)
class StaticExample:
    kind: ClassVar[str] = "static"

    title: str
    query: MetricQuery
    conditions: Sequence[ThresholdCondition]
    shape: SeriesShape

    def evaluate(self) -> EvaluatedSeries:
        values = build_series_values(self.shape, self.query.time_window)

        priorities = evaluate_threshold_priorities(self.conditions, values)

        return EvaluatedSeries(values=values, priorities=priorities)

    def build_condition_payloads(self) -> list[dict[str, Any]]:
        return build_threshold_condition_payloads(self.conditions)

    def build_config(self) -> dict[str, Any]:
        return {"detectionType": "static"}


@dataclass(frozen=True)
class PercentExample:
    kind: ClassVar[str] = "percent"

    title: str
    query: MetricQuery
    conditions: Sequence[ThresholdCondition]
    shape: SeriesShape
    comparison_delta: int

    def evaluate(self) -> EvaluatedSeries:
        comparison_point_count = self.comparison_delta // self.query.time_window

        values_with_history = build_series_values(
            self.shape, self.query.time_window, history_point_count=comparison_point_count
        )

        values = values_with_history[comparison_point_count:]

        comparison_values = values_with_history[: len(values)]

        priorities = evaluate_percent_priorities(self.conditions, values, comparison_values)

        return EvaluatedSeries(
            values=values, priorities=priorities, comparison_values=comparison_values
        )

    def build_condition_payloads(self) -> list[dict[str, Any]]:
        return build_threshold_condition_payloads(self.conditions)

    def build_config(self) -> dict[str, Any]:
        return {"detectionType": "percent", "comparisonDelta": self.comparison_delta}


@dataclass(frozen=True)
class AnomalyExample:
    kind: ClassVar[str] = "anomaly"

    title: str
    query: MetricQuery
    shape: SeriesShape
    sensitivity: AnomalyDetectionSensitivity
    direction: AnomalyDetectionThresholdType
    seasonality: AnomalyDetectionSeasonality = AnomalyDetectionSeasonality.AUTO

    def evaluate(self) -> EvaluatedSeries:
        values = build_series_values(self.shape, self.query.time_window)

        band = AnomalyBand(
            expected_values=build_expected_values(self.shape, self.query.time_window),
            tolerance=NOISE_MULTIPLES_BY_SENSITIVITY[self.sensitivity] * self.shape.noise,
            direction=self.direction,
        )

        priorities = evaluate_anomaly_priorities(band, values)

        return EvaluatedSeries(values=values, priorities=priorities, anomaly_band=band)

    def build_condition_payloads(self) -> list[dict[str, Any]]:
        comparison = {
            "sensitivity": self.sensitivity.value,
            "seasonality": self.seasonality.value,
            "thresholdType": self.direction.value,
        }

        return [
            {
                "type": "anomaly_detection",
                "comparison": comparison,
                "conditionResult": DetectorPriorityLevel.HIGH.value,
            }
        ]

    def build_config(self) -> dict[str, Any]:
        return {"detectionType": "dynamic"}


DetectorExample = StaticExample | PercentExample | AnomalyExample

STATIC_EXAMPLES = [
    StaticExample(
        title="Static: warning and critical, resolve below warning",
        query=build_span_query("Slow search queries", "p95(span.duration)", FIVE_MINUTES),
        conditions=[
            ThresholdCondition("gt", 800, DetectorPriorityLevel.MEDIUM),
            ThresholdCondition("gt", 1500, DetectorPriorityLevel.HIGH),
            ThresholdCondition("lte", 500, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(
            point_count=150,
            level=320,
            daily_swing=60,
            noise=25,
            decimals=1,
            seed=11,
            bumps=[
                Bump(start=70, length=34, height=650, ramp=6),
                Bump(start=80, length=12, height=900, ramp=3),
            ],
        ),
    ),
    StaticExample(
        title="Static: resolve is the same as warning",
        query=MetricQuery(name="Checkout errors", aggregate="count()", time_window=FIFTEEN_MINUTES),
        conditions=[
            ThresholdCondition("gt", 50, DetectorPriorityLevel.MEDIUM),
            ThresholdCondition("gt", 100, DetectorPriorityLevel.HIGH),
            ThresholdCondition("lte", 50, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(
            point_count=150,
            level=22,
            daily_swing=8,
            noise=4,
            seed=12,
            bumps=[
                Bump(start=95, length=40, height=48, ramp=3),
                Bump(start=110, length=14, height=60, ramp=3),
            ],
        ),
    ),
    StaticExample(
        title="Static: critical only, resolve far below critical",
        query=MetricQuery(name="Snuba errors", aggregate="count()", time_window=FIVE_MINUTES),
        conditions=[
            ThresholdCondition("gt", 60, DetectorPriorityLevel.HIGH),
            ThresholdCondition("lte", 20, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(
            point_count=150,
            level=9,
            daily_swing=3,
            noise=3,
            seed=13,
            bumps=[
                Bump(start=60, length=14, height=80, ramp=2),
                Bump(start=60, length=65, height=28, ramp=3),
            ],
        ),
    ),
    StaticExample(
        title="Static: very flappy, resolve is the same as critical",
        query=build_span_query("Discover failure rate", "failure_rate()", FIVE_MINUTES),
        conditions=[
            ThresholdCondition("gt", 0.05, DetectorPriorityLevel.HIGH),
            ThresholdCondition("lte", 0.05, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(
            point_count=150,
            level=0.041,
            daily_swing=0.003,
            noise=0.006,
            decimals=4,
            seed=14,
            bumps=[Bump(start=55, length=50, height=0.006, ramp=8)],
        ),
    ),
    StaticExample(
        title="Static: traffic drops below warning and critical",
        query=build_span_query("Transactions dropping", "count(span.duration)", FIVE_MINUTES),
        conditions=[
            ThresholdCondition("lt", 100, DetectorPriorityLevel.MEDIUM),
            ThresholdCondition("lt", 5, DetectorPriorityLevel.HIGH),
            ThresholdCondition("gte", 100, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(
            point_count=150,
            level=420,
            daily_swing=120,
            noise=25,
            seed=15,
            bumps=[
                Bump(start=85, length=30, scale=0.15, ramp=3),
                Bump(start=92, length=14, scale=0, ramp=1),
            ],
        ),
    ),
]

PERCENT_EXAMPLES = [
    PercentExample(
        title="Percent change: spike against the same time yesterday",
        query=MetricQuery(name="Error volume", aggregate="count()", time_window=ONE_HOUR),
        comparison_delta=ONE_DAY,
        conditions=[
            ThresholdCondition("gt", 150, DetectorPriorityLevel.HIGH),
            ThresholdCondition("lte", 120, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(
            point_count=150,
            level=1200,
            daily_swing=500,
            noise=40,
            seed=21,
            bumps=[Bump(start=118, length=7, scale=2.1, ramp=1)],
        ),
    ),
    PercentExample(
        title="Percent change: warning and critical, resolve is the same as warning",
        query=MetricQuery(name="Payment errors", aggregate="count()", time_window=ONE_HOUR),
        comparison_delta=ONE_DAY,
        conditions=[
            ThresholdCondition("gt", 130, DetectorPriorityLevel.MEDIUM),
            ThresholdCondition("gt", 200, DetectorPriorityLevel.HIGH),
            ThresholdCondition("lte", 130, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(
            point_count=150,
            level=300,
            daily_swing=120,
            noise=10,
            seed=22,
            bumps=[
                Bump(start=100, length=20, scale=1.55, ramp=2),
                Bump(start=106, length=6, scale=1.6, ramp=1),
            ],
        ),
    ),
    PercentExample(
        title="Percent change: very flappy against the previous hour",
        query=MetricQuery(name="Login errors", aggregate="count()", time_window=FIFTEEN_MINUTES),
        comparison_delta=ONE_HOUR,
        conditions=[
            ThresholdCondition("gt", 120, DetectorPriorityLevel.HIGH),
            ThresholdCondition("lte", 120, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(point_count=150, level=80, daily_swing=20, noise=9, seed=23),
    ),
    PercentExample(
        title="Percent change: traffic drops against last week",
        query=build_span_query("Span throughput", "count(span.duration)", ONE_HOUR),
        comparison_delta=ONE_WEEK,
        conditions=[
            ThresholdCondition("lt", 60, DetectorPriorityLevel.HIGH),
            ThresholdCondition("gte", 80, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(
            point_count=150,
            level=5000,
            daily_swing=1800,
            noise=150,
            seed=24,
            bumps=[Bump(start=104, length=10, scale=0.35, ramp=1)],
        ),
    ),
    PercentExample(
        title="Percent change: 4x last week, still open",
        query=build_span_query("MCP tool traffic", "count(span.duration)", ONE_HOUR),
        comparison_delta=ONE_WEEK,
        conditions=[
            ThresholdCondition("gt", 400, DetectorPriorityLevel.HIGH),
            ThresholdCondition("lte", 300, DetectorPriorityLevel.OK),
        ],
        shape=SeriesShape(
            point_count=150,
            level=40,
            daily_swing=15,
            noise=3,
            seed=25,
            bumps=[Bump(start=143, length=20, scale=5, ramp=2)],
        ),
    ),
]

ANOMALY_EXAMPLES = [
    AnomalyExample(
        title="Anomaly: one spike, low sensitivity",
        query=MetricQuery(name="Error spike", aggregate="count()", time_window=FIFTEEN_MINUTES),
        sensitivity=AnomalyDetectionSensitivity.LOW,
        direction=AnomalyDetectionThresholdType.ABOVE,
        shape=SeriesShape(
            point_count=150,
            level=140,
            daily_swing=50,
            noise=10,
            seed=31,
            bumps=[Bump(start=96, length=10, height=180, ramp=2)],
        ),
    ),
    AnomalyExample(
        title="Anomaly: latency just started rising, still open",
        query=build_span_query("API latency", "p95(span.duration)", ONE_HOUR),
        sensitivity=AnomalyDetectionSensitivity.MEDIUM,
        direction=AnomalyDetectionThresholdType.ABOVE,
        shape=SeriesShape(
            point_count=150,
            level=210,
            daily_swing=30,
            noise=8,
            decimals=1,
            seed=32,
            bumps=[Bump(start=143, length=20, height=140, ramp=2)],
        ),
    ),
    AnomalyExample(
        title="Anomaly: very flappy, high sensitivity, above and below",
        query=MetricQuery(name="Worker errors", aggregate="count()", time_window=FIVE_MINUTES),
        sensitivity=AnomalyDetectionSensitivity.HIGH,
        direction=AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
        shape=SeriesShape(
            point_count=150,
            level=60,
            daily_swing=10,
            noise=7,
            seed=33,
            bumps=[
                Bump(start=20, length=2, height=35),
                Bump(start=34, length=3, height=-30),
                Bump(start=51, length=1, height=40),
                Bump(start=66, length=4, height=30),
                Bump(start=80, length=2, height=-35),
                Bump(start=97, length=3, height=45),
                Bump(start=111, length=1, height=32),
                Bump(start=125, length=2, height=-30),
                Bump(start=138, length=3, height=38),
            ],
        ),
    ),
    AnomalyExample(
        title="Anomaly: throughput drops, weekly seasonality",
        query=build_span_query("Span throughput drop", "count(span.duration)", FIFTEEN_MINUTES),
        sensitivity=AnomalyDetectionSensitivity.LOW,
        direction=AnomalyDetectionThresholdType.BELOW,
        seasonality=AnomalyDetectionSeasonality.WEEKLY,
        shape=SeriesShape(
            point_count=150,
            level=2400,
            daily_swing=900,
            noise=90,
            seed=34,
            bumps=[Bump(start=88, length=16, scale=0.45, ramp=2)],
        ),
    ),
    AnomalyExample(
        title="Anomaly: level shift holds the issue open for days",
        query=build_span_query("Changes in TTFB", "p95(measurements.ttfb)", ONE_HOUR),
        sensitivity=AnomalyDetectionSensitivity.MEDIUM,
        direction=AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
        shape=SeriesShape(
            point_count=150,
            level=420,
            daily_swing=40,
            noise=12,
            decimals=1,
            seed=35,
            bumps=[Bump(start=60, length=70, height=110, ramp=4)],
        ),
    ),
]


def build_open_period_identity(example_number: int) -> OpenPeriodIdentity:
    return OpenPeriodIdentity(
        first_open_period_id=612_400_000 + example_number * 100,
        group_id=str(7_012_345_600 + example_number),
        short_id=f"EXAMPLE-{example_number}",
    )


def build_metric_detector_example(
    example: DetectorExample, example_number: int
) -> MetricDetectorExample:
    evaluated_series = example.evaluate()

    time_window = example.query.time_window

    bucket_starts_ms = get_bucket_starts_ms(CHART_END, len(evaluated_series.values), time_window)

    detector_id = 2_810_000 + example_number

    detector = build_detector_payload(
        detector_id=detector_id,
        query=example.query,
        condition_payloads=example.build_condition_payloads(),
        config=example.build_config(),
    )

    open_periods = build_open_periods(
        evaluated_series.priorities,
        bucket_starts_ms,
        time_window,
        build_open_period_identity(example_number),
    )

    anomaly_thresholds = (
        build_anomaly_threshold_payloads(
            evaluated_series.anomaly_band,
            evaluated_series.values,
            bucket_starts_ms,
            alert_id=detector_id,
        )
        if evaluated_series.anomaly_band
        else []
    )

    chart_data = build_chart_data_payload(
        detector=detector,
        aggregate=example.query.aggregate,
        points=build_timeseries_points(evaluated_series.values, bucket_starts_ms),
        open_periods=open_periods,
        comparison_points=build_timeseries_points(
            evaluated_series.comparison_values, bucket_starts_ms
        ),
        anomaly_thresholds=anomaly_thresholds,
    )

    return MetricDetectorExample(
        key=f"{example.kind}-{example_number}",
        title=example.title,
        chart_data=chart_data,
    )


def build_metric_detector_examples() -> list[MetricDetectorExample]:
    examples: list[DetectorExample] = [*STATIC_EXAMPLES, *PERCENT_EXAMPLES, *ANOMALY_EXAMPLES]

    return [
        build_metric_detector_example(example, example_number)
        for example_number, example in enumerate(examples, start=1)
    ]
