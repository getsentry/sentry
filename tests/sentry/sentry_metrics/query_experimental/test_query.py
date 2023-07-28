from datetime import datetime

from sentry.sentry_metrics.query_experimental import get_series
from sentry.sentry_metrics.query_experimental.types import (
    FILTER,
    AggregationFn,
    ArithmeticFn,
    Column,
    Condition,
    Function,
    MetricQueryScope,
    Op,
    SeriesQuery,
)


def __example_to_remove():
    """
    sum(transactions{status="error"}) / sum(transactions)
    """

    expr = Function(
        ArithmeticFn.DIVIDE.value,
        [
            Function(
                AggregationFn.SUM.value,
                [
                    Function(
                        FILTER,
                        [
                            Column("transactions"),
                            Condition(
                                lhs=Column("status"),
                                op=Op.EQ,
                                rhs="error",
                            ),
                        ],
                    )
                ],
            ),
            Function(AggregationFn.SUM.value, [Column("transactions")]),
        ],
    )

    query = SeriesQuery(
        scope=MetricQueryScope(org_id=1),
        expressions=[expr],
        filters=[],
        groups=[],
        start=datetime(2023, 1, 1),
        end=datetime(2023, 1, 2),
        interval=3600,
    )

    result = get_series(query)
    assert result


def test_basic():
    expr = Function(
        AggregationFn.AVG.value,
        [Column("d:transactions/duration@millisecond")],
    )

    query = SeriesQuery(
        scope=MetricQueryScope(org_id=1),
        expressions=[expr],
        filters=[],
        groups=[],
        start=datetime(2023, 1, 1),
        end=datetime(2023, 1, 2),
    )

    result = get_series(query)
    assert result


# TODO: filter
# TODO: arithmetic
