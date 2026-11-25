"""Build minute or hourly series and derive rates within a project and environment."""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import datetime

from sentry.anomaly_detection.contracts import Metric, SeriesKey, SeriesRow, Signal

Series = dict[datetime, float | None]

# Service rates derived from each project and environment's unsliced request totals;
# rate_parts names the series each one divides.
_RATE_EVENTS = {Signal.ERROR_RATE: Signal.ERRORS, Signal.FAILED_RATE: Signal.FAILED_REQUESTS}
_DERIVED_RATES = (
    (Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST),
    (Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST),
)


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
    events = _RATE_EVENTS.get(key.signal)
    if events is None:
        return None
    p, e = key.project_id, key.env
    return (
        SeriesKey(p, e, events, Metric.COUNT),
        SeriesKey(p, e, Signal.REQUESTS, Metric.COUNT),
        SeriesKey(p, e, Signal.REQUESTS, Metric.COUNT_SAMPLE),
    )


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
    services = {
        (key.project_id, key.env)
        for key in series
        if key.signal == Signal.REQUESTS and not key.dim_value
    }
    for project_id, env in services:
        for signal, metric in _DERIVED_RATES:
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
