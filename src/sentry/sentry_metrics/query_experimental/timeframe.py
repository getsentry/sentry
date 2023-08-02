import math
from dataclasses import replace
from datetime import datetime, timedelta
from itertools import zip_longest
from typing import Iterable, Sequence, Tuple

from snuba_sdk import Granularity

from sentry.sentry_metrics.use_case_id_registry import get_query_config

from .pipeline import QueryLayer
from .types import MetricRange, SeriesQuery
from .use_case import get_use_case

# Maximum number of points to return in a query with inferred interval.
# `normalize_timeframe` will choose a granularity that returns at most this
# number of datapoints based on the chosen timeframe.
MAX_POINTS = 360


class TimeframeLayer(QueryLayer):
    """
    Layer for the query pipeline that normalizes the interval and timeframe of
    a query to align with the available granularities and ensures the timeframe
    covers the interval.
    """

    def transform_query(self, query: SeriesQuery) -> SeriesQuery:
        return normalize_timeframe(query)


def resolve_granularity(query: SeriesQuery) -> Granularity:
    """
    Resolves the nearest granularity that resolves the interval.
    """

    config = get_query_config(get_use_case(query))
    return config.granularity(query.range.interval)


def normalize_timeframe(query: SeriesQuery) -> SeriesQuery:
    """
    Normalizes the interval and timeframe of a query to align with the
    available granularities and ensures the timeframe covers the interval.
    """

    config = get_query_config(get_use_case(query))

    interval = query.range.interval
    if interval == 0:
        interval = _infer_interval(query.range.start, query.range.end, config.granularities)
    granularity = config.granularity(interval).granularity

    # Ensure the interval is a multiple of the granularity and align the timeframe
    interval = round(interval / granularity) * granularity
    (start, end) = _align_timeframe(query.range.start, query.range.end, interval)

    return replace(query, range=MetricRange(start=start, end=end, interval=interval))


def _infer_interval(start: datetime, end: datetime, granularities: Sequence[int]) -> int:
    """
    Infers an appropriate interval in seconds for the given timeframe based on
    the available granularities.
    """

    window = (end - start).total_seconds()

    last = granularities[0]
    for interval in _iter_intervals(granularities):
        if window / interval <= MAX_POINTS:
            return interval
        last = interval

    return last


def _iter_intervals(granularities: Sequence[int]) -> Iterable[int]:
    """
    Iterates over the available intervals for the given granularities. It starts
    with the smallest granularity, then iterates over multiples of the
    granularity, and then proceeds with the next granularity.

    For example, given the granularities `[1m, 1h, 1d]`, this function will
    yield the following intervals: `1m, 2m, 5m, 10m, 20m, 30m, 1h, ...`.
    """
    for granularity, next_granularity in zip_longest(granularities, granularities[1:]):
        for factor in (1, 2, 5, 10, 20):
            interval = granularity * factor
            if next_granularity is None or interval < next_granularity / 2:
                yield interval
            else:
                break

        if next_granularity is not None:
            yield int(next_granularity / 2)


def _align_timeframe(start: datetime, end: datetime, interval: int) -> Tuple[datetime, datetime]:
    """
    Expands the timeframe to cover the interval and aligns the start and end
    to the interval.
    """

    m = datetime.min.replace(tzinfo=start.tzinfo)
    delta = timedelta(seconds=interval)

    start = m + math.floor((start - m) / delta) * delta
    end = m + math.ceil((end - m) / delta) * delta

    return (start, end)
