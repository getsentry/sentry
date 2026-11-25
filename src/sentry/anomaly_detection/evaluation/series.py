"""Build minute or hourly series and derive rates within a project and environment."""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import datetime

from sentry.anomaly_detection.contracts import Metric, SeriesKey, SeriesRow, SeriesSlice, Signal

Series = dict[datetime, float | None]

# Service rates derived from each project and environment's unsliced request totals: each
# divides its events by requests (see rate_parts) and is stored under its metric.
_DERIVED_RATES = {
    Signal.ERROR_RATE: (Signal.ERRORS, Metric.ERRORS_PER_REQUEST),
    Signal.FAILED_RATE: (Signal.FAILED_REQUESTS, Metric.FAILED_PER_REQUEST),
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


def uses_trials(key: SeriesKey) -> bool:
    """Whether the series counts failures out of sampled trials rather than plain events."""
    return key.signal == Signal.FAILED_RATE or is_share(key)


def rate_parts(key: SeriesKey) -> tuple[SeriesKey, SeriesKey, SeriesKey] | None:
    """Return a service rate's events, denominator, and samples behind that denominator.

    Rates divide extrapolated counts, never sampled ones: sampled failures over sampled
    requests misstate the failed share whenever sample rates differ between them.
    """
    if key.signal not in _DERIVED_RATES:
        return None
    events, _ = _DERIVED_RATES[key.signal]
    requests = SeriesSlice(key.project_id, key.env, Signal.REQUESTS)
    return (
        SeriesSlice(key.project_id, key.env, events).series(Metric.COUNT),
        requests.series(Metric.COUNT),
        requests.series(Metric.COUNT_SAMPLE),
    )


def samples_key(key: SeriesKey) -> SeriesKey:
    return key.slice.series(Metric.COUNT_SAMPLE)


def _mask_empty_spans(series: dict[SeriesKey, Series]) -> None:
    # A percentile or share of no spans is missing, not zero latency or zero failures.
    for key, values in series.items():
        if key.metric == Metric.P95_DURATION or is_share(key):
            volumes = series.get(samples_key(key))
            if volumes is None:
                volumes = series.get(key.slice.series(Metric.COUNT), {})
            for ts in values:
                if not volumes.get(ts):
                    values[ts] = None


def _derive_rates(series: dict[SeriesKey, Series]) -> None:
    services = {
        (key.project_id, key.env)
        for key in series
        if key.signal == Signal.REQUESTS and not key.dim_value
    }
    for project_id, env in services:
        for signal, (_, metric) in _DERIVED_RATES.items():
            rate = SeriesKey(project_id, env, signal, metric)
            parts = rate_parts(rate)
            assert parts is not None
            numerator_key, denominator_key, _ = parts
            if numerator_key not in series or denominator_key not in series:
                continue
            numerator = series[numerator_key]
            series[rate] = {
                ts: count / value if value and (count := numerator.get(ts)) is not None else None
                for ts, value in series[denominator_key].items()
            }


def has_traffic(series: Mapping[SeriesKey, Series], project_id: int, env: str) -> bool:
    return SeriesKey(project_id, env, Signal.REQUESTS, Metric.COUNT) in series
