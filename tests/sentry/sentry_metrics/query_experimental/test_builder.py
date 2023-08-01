from datetime import datetime

import pytest

from sentry.sentry_metrics.query_experimental.builder import E, Q
from sentry.sentry_metrics.query_experimental.types import (
    Filter,
    Function,
    MetricName,
    MetricQueryScope,
    MetricRange,
    Tag,
    Variable,
)


def test_e_variable():
    assert E("$foo").build() == Variable("foo")


def test_e_metric():
    assert E("foo").build() == MetricName("foo")


def test_e_filter():
    assert E("foo").filter("bar", "equals", "baz").build() == Filter(
        [
            MetricName("foo"),
            Function("equals", [Tag("bar"), "baz"]),
        ]
    )


def test_e_invalid_filter():
    with pytest.raises(ValueError):
        E("foo").filter("bar", "UNKNOWN_OP", "baz").build()


def test_e_aggregation():
    assert E("foo").count().build() == Function("count", [MetricName("foo")])


def test_e_invalid_aggregation():
    with pytest.raises(ValueError):
        E("foo").agg("UNKNOWN_FN").build()


def test_e_calculate():
    assert E("$foo").divide("$bar").build() == Function(
        "divide",
        [Variable("foo"), Variable("bar")],
    )


def test_e_calculate_literal():
    assert E("$foo").divide(2).build() == Function(
        "divide",
        [Variable("foo"), 2],
    )


def test_e_invalid_calculation():
    with pytest.raises(ValueError):
        E("foo").count().calc("UNKNOWN_FN", 2).build()


def test_q_failure_rate():
    MRI = "d:transactions/duration@millisecond"
    STATUSES = ("ok", "cancelled", "unknown")

    failure_rate = E(MRI).count().filter("status", "notIn", STATUSES).divide(E(MRI).count())

    query = (
        Q()
        .expr(failure_rate)
        .scope(MetricQueryScope(org_id=1, project_ids=[1]))
        .range(MetricRange.start_at(datetime.utcnow(), hours=1, interval=3600))
        .build()
    )

    EXPECTED = Function(
        "divide",
        [
            Filter(
                [
                    Function("count", [MetricName(MRI)]),
                    Function("notIn", [Tag("status"), STATUSES]),
                ]
            ),
            Function("count", [MetricName(MRI)]),
        ],
    )

    assert query.expressions == [EXPECTED]


def test_q_dsl_with_bind():
    query = (
        Q()
        .expr("$foo / 2")
        .scope(MetricQueryScope(org_id=1, project_ids=[1]))
        .range(MetricRange.start_at(datetime.utcnow(), hours=1, interval=3600))
        .bind(foo=MetricName("failure_rate"))
        .build()
    )

    assert query.expressions == [Function("divide", [MetricName("failure_rate"), 2])]
