"""Build minute or hourly series and derive rates within a project and environment."""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import datetime

from sentry.anomaly_detection.contracts import SeriesKey

Series = dict[datetime, float | None]
SeriesRow = tuple[datetime, str, str, str, str, str, float | None]

RATES = {
    "count()": ("error_rate", "errors/requests"),
    "count_sample()": ("failed_rate", "failed_requests/requests"),
}


def build(rows: Iterable[SeriesRow]) -> dict[SeriesKey, Series]:
    series: dict[SeriesKey, Series] = defaultdict(dict)
    for ts, signal, metric, project, env, dim_value, value in rows:
        if project == "Other" or dim_value == "Other":
            continue  # The bucket groups unrelated values, so has no stable baseline.
        series[SeriesKey(project, env, signal, metric, dim_value)][ts] = value
    _mask_empty_spans(series)
    _derive_rates(series)
    return dict(series)


def is_share(key: SeriesKey) -> bool:
    """Whether the aggregate directly measures a share of the slice's sampled spans."""
    return key.metric == "failure_rate()"


def rate_parts(key: SeriesKey) -> tuple[SeriesKey, SeriesKey, SeriesKey] | None:
    """Return a service rate's events, denominator, and samples behind that denominator."""
    p, e = key.project, key.env
    samples = SeriesKey(p, e, "requests", "count_sample()")
    if key.signal == "error_rate":
        return SeriesKey(p, e, "errors", "count()"), SeriesKey(p, e, "requests", "count()"), samples
    if key.signal == "failed_rate":
        return SeriesKey(p, e, "failed_requests", "count_sample()"), samples, samples
    return None


def samples_key(key: SeriesKey) -> SeriesKey:
    return SeriesKey(key.project, key.env, key.signal, "count_sample()", key.dim_value)


def _mask_empty_spans(series: dict[SeriesKey, Series]) -> None:
    # A percentile or share of no spans is missing, not zero latency or zero failures.
    for key, values in series.items():
        if key.metric.startswith("p95") or is_share(key):
            volumes = series.get(samples_key(key))
            if volumes is None:
                volumes = series.get(
                    SeriesKey(key.project, key.env, key.signal, "count()", key.dim_value), {}
                )
            for ts in values:
                if not volumes.get(ts):
                    values[ts] = None


def _derive_rates(series: dict[SeriesKey, Series]) -> None:
    for key in list(series):
        rate_spec = RATES.get(key.metric)
        if key.signal != "requests" or key.dim_value or rate_spec is None:
            continue
        rate = SeriesKey(key.project, key.env, *rate_spec)
        parts = rate_parts(rate)
        assert parts is not None
        num, den, _ = parts
        if num in series:
            numerator = series[num]
            series[rate] = {
                ts: count / value if value and (count := numerator.get(ts)) is not None else None
                for ts, value in series[den].items()
            }


def has_traffic(series: Mapping[SeriesKey, Series], project: str, env: str) -> bool:
    return SeriesKey(project, env, "requests", "count()") in series
