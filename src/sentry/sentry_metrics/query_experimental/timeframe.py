import math
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Sequence, Tuple

from snuba_sdk import Granularity

from sentry.sentry_metrics.use_case_id_registry import get_query_config

from .pipeline import QueryLayer
from .types import SeriesQuery
from .use_case import get_use_case


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
    return config.granularity(query.interval)


def normalize_timeframe(query: SeriesQuery) -> SeriesQuery:
    """
    Normalizes the interval and timeframe of a query to align with the
    available granularities and ensures the timeframe covers the interval.
    """

    config = get_query_config(get_use_case(query))

    interval = query.interval
    if interval == 0:
        interval = _infer_interval(query.start, query.end, config.granularities)
    granularity = config.granularity(interval).granularity

    # Ensure the interval is a multiple of the granularity and align the timeframe
    interval = round(interval / granularity) * granularity
    (start, end) = _align_timeframe(query.start, query.end, interval)

    return replace(
        query,
        start=start,
        end=end,
        interval=interval,
    )


def _infer_interval(start: datetime, end: datetime, granularities: Sequence[int]) -> int:
    """
    Infers an appropriate interval in seconds for the given timeframe based on
    the available granularities.
    """

    window = (end - start).total_seconds()
    return min(g for g in granularities if window / g <= 360) or max(granularities)


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
