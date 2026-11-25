from datetime import UTC, datetime, timedelta

import pytest

from sentry.anomaly_detection.contracts import Metric, SeriesKey, Signal
from sentry.anomaly_detection.evaluation import quality
from sentry.anomaly_detection.evaluation.series import Series, samples_key

T0 = datetime(2024, 11, 4, 8, tzinfo=UTC)
MINUTE = timedelta(minutes=1)
FLAPPY = SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.P95_DURATION, "/flappy")


def test_quality_flags_zero_p95_at_the_inclusive_thresholds() -> None:
    series: dict[SeriesKey, Series] = {
        FLAPPY: {T0 + i * MINUTE: 0.0 if i < 15 else 120.0 for i in range(30)},
        samples_key(FLAPPY): {T0 + i * MINUTE: 20.0 for i in range(30)},
    }

    issues = quality.check(series)

    assert set(issues) == {FLAPPY}
    issue = issues[FLAPPY]
    assert issue is not None
    assert "0ms in 50% of minutes despite ~20 sampled spans/min" in issue


@pytest.mark.parametrize(
    ("minute_count", "sample_count", "zeros", "assessment"),
    [(29, 20.0, 29, {}), (30, 19.0, 30, {}), (30, None, 30, {}), (30, 20.0, 14, {FLAPPY: None})],
)
def test_quality_leaves_healthy_or_insufficiently_sampled_series_alone(
    minute_count: int,
    sample_count: float | None,
    zeros: int,
    assessment: dict[SeriesKey, str | None],
) -> None:
    series: dict[SeriesKey, Series] = {
        FLAPPY: {T0 + i * MINUTE: 0.0 if i < zeros else 120.0 for i in range(minute_count)},
        samples_key(FLAPPY): {T0 + i * MINUTE: sample_count for i in range(minute_count)},
    }

    assert quality.check(series) == assessment
