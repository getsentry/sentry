"""Build minute or hourly series and derive rates within a project and environment."""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import datetime

from sentry.anomaly_detection.contracts import Metric, SeriesKey, SeriesRow, Signal

Series = dict[datetime, float | None]

# Request totals that, with their numerators, derive a service rate.
RATES = {
    Metric.COUNT: (Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST),
    Metric.COUNT_SAMPLE: (Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST),
}


def build(rows: Iterable[SeriesRow]) -> dict[SeriesKey, Series]:
    series: dict[SeriesKey, Series] = defaultdict(dict)
    for row in rows:
        series[row.key][row.ts] = row.value
    _mask_empty_spans(series)
    _derive_rates(series)
    return dict(series)


def is_share(key: SeriesKey) -> bool:
    """Whether the aggregate directly measures a share of the slice's sampled spans."""
    return key.metric == Metric.FAILURE_RATE


def rate_parts(key: SeriesKey) -> tuple[SeriesKey, SeriesKey, SeriesKey] | None:
    """Return a service rate's events, denominator, and samples behind that denominator."""
    p, e = key.project_id, key.env
    samples = SeriesKey(p, e, Signal.REQUESTS, Metric.COUNT_SAMPLE)
    if key.signal == Signal.ERROR_RATE:
        return (
            SeriesKey(p, e, Signal.ERRORS, Metric.COUNT),
            SeriesKey(p, e, Signal.REQUESTS, Metric.COUNT),
            samples,
        )
    if key.signal == Signal.FAILED_RATE:
        return SeriesKey(p, e, Signal.FAILED_REQUESTS, Metric.COUNT_SAMPLE), samples, samples
    return None


def samples_key(key: SeriesKey) -> SeriesKey:
    return SeriesKey(key.project_id, key.env, key.signal, Metric.COUNT_SAMPLE, key.dim_value)


def _mask_empty_spans(series: dict[SeriesKey, Series]) -> None:
    # A percentile or share of no spans is missing, not zero latency or zero failures.
    for key, values in series.items():
        if key.metric == Metric.P95_DURATION or is_share(key):
            volumes = series.get(samples_key(key))
            if volumes is None:
                volumes = series.get(
                    SeriesKey(key.project_id, key.env, key.signal, Metric.COUNT, key.dim_value), {}
                )
            for ts in values:
                if not volumes.get(ts):
                    values[ts] = None


def _derive_rates(series: dict[SeriesKey, Series]) -> None:
    for key in list(series):
        rate_spec = RATES.get(key.metric)
        if key.signal != Signal.REQUESTS or key.dim_value or rate_spec is None:
            continue
        rate = SeriesKey(key.project_id, key.env, *rate_spec)
        parts = rate_parts(rate)
        assert parts is not None
        num, den, _ = parts
        if num in series:
            numerator = series[num]
            series[rate] = {
                ts: count / value if value and (count := numerator.get(ts)) is not None else None
                for ts, value in series[den].items()
            }


def has_traffic(series: Mapping[SeriesKey, Series], project_id: int, env: str) -> bool:
    return SeriesKey(project_id, env, Signal.REQUESTS, Metric.COUNT) in series
