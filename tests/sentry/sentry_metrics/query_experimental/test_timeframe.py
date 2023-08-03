from datetime import datetime

import pytest

from sentry.sentry_metrics.query_experimental.timeframe import normalize_timeframe
from sentry.sentry_metrics.query_experimental.types import (
    Function,
    MetricName,
    MetricScope,
    SeriesQuery,
    SeriesRollup,
    TimeRange,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID, get_query_config

CASES = [
    # Valid interval
    (
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        3600,
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        3600,
    ),
    # Expand interval to granularity
    (
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        3599,
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        3600,
    ),
    # Expand multiple of granularity
    (
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        7199,
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        7200,
    ),
    # Contract interval to granularity
    (
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        3601,
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        3600,
    ),
    # Contract to multiple of granularity
    (
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        7201,
        "2023-01-01T00:00:00Z",
        "2023-01-02T00:00:00Z",
        7200,
    ),
    # Move start to interval boundary
    (
        "2023-01-01T00:03:00Z",
        "2023-01-01T00:10:00Z",
        120,
        "2023-01-01T00:02:00Z",
        "2023-01-01T00:10:00Z",
        120,
    ),
    # Move end to interval boundary
    (
        "2023-01-01T00:00:00Z",
        "2023-01-01T00:09:00Z",
        120,
        "2023-01-01T00:00:00Z",
        "2023-01-01T00:10:00Z",
        120,
    ),
    # 1 hour: Infer minute interval
    (
        "2023-01-01T00:00:00Z",
        "2023-01-01T01:00:00Z",
        "auto",
        "2023-01-01T00:00:00Z",
        "2023-01-01T01:00:00Z",
        60,
    ),
    # 12 hours: Infer multi-minute interval
    (
        "2023-01-01T00:00:00Z",
        "2023-01-01T12:00:00Z",
        "auto",
        "2023-01-01T00:00:00Z",
        "2023-01-01T12:00:00Z",
        120,
    ),
    # 15 days: Infer hour interval
    (
        "2023-01-01T00:00:00Z",
        "2023-01-15T00:00:00Z",
        "auto",
        "2023-01-01T00:00:00Z",
        "2023-01-15T00:00:00Z",
        3600,
    ),
    # 1 month: Infer 5-hour interval
    (
        "2023-01-01T00:00:00Z",
        "2023-02-01T00:00:00Z",
        "auto",
        "2023-01-01T00:00:00Z",
        "2023-02-01T01:00:00Z",  # TODO: 5h doesn't divide cleanly with one day
        5 * 3600,  # Could fit 2h in a 30d month
    ),
    # 1 year: Infer 2-day interval
    (
        "2023-01-01T00:00:00Z",
        "2024-01-01T00:00:00Z",
        "auto",
        "2023-01-01T00:00:00Z",
        "2024-01-02T00:00:00Z",  # expanded to a multiple of 2 calendar days
        2 * 86400,
    ),
    # 90 days: Infer 10h interval
    (
        "2023-01-01T00:00:00Z",
        "2023-04-01T00:00:00Z",
        "auto",
        "2023-01-01T00:00:00Z",
        "2023-04-01T00:00:00Z",
        10 * 3600,
    ),
    # Infer capped interval
    (
        "2023-01-01T00:00:00Z",
        "2033-01-01T00:00:00Z",
        "auto",
        "2023-01-01T00:00:00Z",
        "2033-01-08T00:00:00Z",  # expanded to a multiple of 20 calendar days
        20 * 86400,
    ),
]


def _d(isoformat: str) -> datetime:
    # Before python 3.11, datetime.fromisoformat does not support the "Z" suffix.
    return datetime.fromisoformat(isoformat.replace("Z", "+00:00"))


@pytest.mark.parametrize("start,end,interval,nstart,nend,ninterval", CASES)
def test_normalize(start, end, interval, nstart, nend, ninterval):
    # This queries the transactions use case, which has granularities [60, 3600, 86400].
    # IMPORTANT: Update the test cases if this assertion fails:
    assert get_query_config(UseCaseID.TRANSACTIONS).granularities == [60, 3600, 86400]

    query = SeriesQuery(
        scope=MetricScope(org_id=1, project_ids=[1]),
        range=TimeRange(_d(start), _d(end)),
        expressions=[Function("avg", [MetricName("d:transactions/duration@millisecond")])],
        rollup=SeriesRollup(interval),
    )

    normalized = normalize_timeframe(query)
    assert normalized.range == TimeRange(_d(nstart), _d(nend))
    assert normalized.rollup == SeriesRollup(ninterval)
