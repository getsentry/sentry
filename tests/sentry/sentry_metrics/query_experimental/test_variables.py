from datetime import datetime

import pytest

from sentry.sentry_metrics.query_experimental.types import (
    Filter,
    Function,
    InvalidMetricsQuery,
    MetricName,
    MetricQueryScope,
    MetricRange,
    SeriesQuery,
    Tag,
    Variable,
)
from sentry.sentry_metrics.query_experimental.variables import VariableTransform


def test_expr_simple():
    expr = Variable("foo")
    visitor = VariableTransform({"foo": MetricName("metric")})
    assert visitor.visit(expr) == MetricName("metric")


def test_expr_nested():
    expr = Function("divide", [Variable("a"), Variable("b")])
    visitor = VariableTransform({"a": MetricName("a"), "b": MetricName("b")})
    assert visitor.visit(expr) == Function("divide", [MetricName("a"), MetricName("b")])


def test_expr_tag_key():
    expr = Filter([MetricName("foo"), Function("equals", [Variable("key"), "val"])])
    visitor = VariableTransform({"key": Tag("mytag")})
    assert visitor.visit(expr) == Filter(
        [
            MetricName("foo"),
            Function("equals", [Tag("mytag"), "val"]),
        ]
    )


def test_expr_tag_value():
    expr = Filter([MetricName("foo"), Function("equals", [Tag("key"), Variable("val")])])
    visitor = VariableTransform({"val": "myval"})
    assert visitor.visit(expr) == Filter(
        [
            MetricName("foo"),
            Function("equals", [Tag("key"), "myval"]),
        ]
    )


def test_query_filters():
    query = SeriesQuery(
        scope=MetricQueryScope(org_id=1, project_ids=[1]),
        range=MetricRange.end_at(datetime.utcnow(), hours=1),
        expressions=[Function("avg", [MetricName("foo")])],
        filters=[Function("equals", [Variable("tag"), "value"])],
    )

    visitor = VariableTransform({"tag": Tag("mytag")})
    query = visitor.visit(query)
    assert query.filters == [Function("equals", [Tag("mytag"), "value"])]


def test_query_groups():
    query = SeriesQuery(
        scope=MetricQueryScope(org_id=1, project_ids=[1]),
        range=MetricRange.end_at(datetime.utcnow(), hours=1),
        expressions=[Function("avg", [MetricName("foo")])],
        groups=[Variable("tag")],
    )

    visitor = VariableTransform({"tag": Tag("mytag")})
    query = visitor.visit(query)
    assert query.groups == [Tag("mytag")]


def test_missing_tag():
    expr = Variable("foo")
    visitor = VariableTransform({})

    with pytest.raises(InvalidMetricsQuery):
        visitor.visit(expr)
