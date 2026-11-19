"""Identify series whose measurements cannot support detection."""

from collections.abc import Mapping

from sentry.anomaly_detection.contracts import SeriesKey
from sentry.anomaly_detection.series import Series, samples_key

ZERO_SHARE = 0.5
MIN_MINUTES = 30
MIN_SAMPLES = 20.0


def check(series: Mapping[SeriesKey, Series]) -> dict[SeriesKey, str | None]:
    """Return an issue or None for assessed series; omit series with insufficient samples."""
    assessments: dict[SeriesKey, str | None] = {}
    for key, latency in series.items():
        if not key.metric.startswith("p95"):
            continue
        samples = series.get(samples_key(key), {})
        eligible = []
        for minute, value in latency.items():
            count = samples.get(minute)
            if value is not None and count is not None and count >= MIN_SAMPLES:
                eligible.append((value, count))
        if len(eligible) < MIN_MINUTES:
            continue
        zero = sum(value == 0 for value, _ in eligible) / len(eligible)
        assessments[key] = None
        if zero >= ZERO_SHARE:
            med_samples = sorted(count for _, count in eligible)[len(eligible) // 2]
            assessments[key] = (
                f"p95 is 0ms in {zero:.0%} of minutes despite ~{med_samples:,.0f} sampled "
                "spans/min: durations aren't being measured (e.g. a frozen clock)"
            )
    return assessments
