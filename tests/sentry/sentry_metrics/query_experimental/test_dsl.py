from sentry.sentry_metrics.query_experimental.dsl import parse_expression
from sentry.sentry_metrics.query_experimental.types import (
    Filter,
    Function,
    MetricName,
    Tag,
    Variable,
)


def test_quoted_name():
    dsl = "sum(`d:transactions/duration@millisecond`)"
    expr = Function("sum", [MetricName("d:transactions/duration@millisecond")])
    assert parse_expression(dsl) == expr


def test_unquoted_name():
    dsl = "sum(foo)"
    expr = Function("sum", [MetricName("foo")])
    assert parse_expression(dsl) == expr


def test_nested_expression():
    dsl = "(sum(foo))"
    expr = Function("sum", [MetricName("foo")])
    assert parse_expression(dsl) == expr

    dsl = "sum((foo))"
    expr = Function("sum", [MetricName("foo")])
    assert parse_expression(dsl) == expr


def test_filter():
    dsl = 'foo{bar="baz"}'
    expr = Filter([MetricName("foo"), Function("equals", [Tag("bar"), "baz"])])
    assert parse_expression(dsl) == expr


def test_in_filter():
    dsl = 'foo{bar IN ("baz", "qux")}'
    expr = Filter([MetricName("foo"), Function("in", [Tag("bar"), ["baz", "qux"]])])
    assert parse_expression(dsl) == expr


def test_filter_in_function():
    dsl = 'sum(foo{bar="baz"})'
    expr = Function("sum", [Filter([MetricName("foo"), Function("equals", [Tag("bar"), "baz"])])])
    assert parse_expression(dsl) == expr


def test_function_in_filter():
    dsl = 'sum(foo){bar="baz"}'
    expr = Filter([Function("sum", [MetricName("foo")]), Function("equals", [Tag("bar"), "baz"])])
    assert parse_expression(dsl) == expr


def test_terms():
    dsl = "foo * bar / baz"
    expr = Function(
        "divide",
        [
            Function(
                "multiply",
                [
                    MetricName("foo"),
                    MetricName("bar"),
                ],
            ),
            MetricName("baz"),
        ],
    )
    assert parse_expression(dsl) == expr


def test_expressions():
    dsl = "foo - bar + baz"
    expr = Function(
        "plus",
        [
            Function(
                "minus",
                [
                    MetricName("foo"),
                    MetricName("bar"),
                ],
            ),
            MetricName("baz"),
        ],
    )
    assert parse_expression(dsl) == expr


def test_precedence():
    dsl = "foo + bar * baz"
    expr = Function(
        "plus",
        [
            MetricName("foo"),
            Function(
                "multiply",
                [
                    MetricName("bar"),
                    MetricName("baz"),
                ],
            ),
        ],
    )
    assert parse_expression(dsl) == expr


def test_parens():
    dsl = "(foo + bar) * baz"
    expr = Function(
        "multiply",
        [
            Function(
                "plus",
                [
                    MetricName("foo"),
                    MetricName("bar"),
                ],
            ),
            MetricName("baz"),
        ],
    )
    assert parse_expression(dsl) == expr


def test_numbers():
    dsl = "1 + 2"
    expr = Function("plus", [1, 2])
    assert parse_expression(dsl) == expr


def test_metric_variable():
    dsl = "$foo"
    expr = Variable("foo")
    assert parse_expression(dsl) == expr


def test_tag_key_variable():
    dsl = 'foo{$bar="baz"}'
    expr = Filter([MetricName("foo"), Function("equals", [Variable("bar"), "baz"])])
    assert parse_expression(dsl) == expr


def test_tag_value_variable():
    dsl = "foo{bar=$baz}"
    expr = Filter([MetricName("foo"), Function("equals", [Tag("bar"), Variable("baz")])])
    assert parse_expression(dsl) == expr


def test_failure_rate():
    dsl = 'count(transactions{status NOT IN ("ok", "cancelled", "unknown")}) / count(transactions)'
    expr = Function(
        "divide",
        [
            Function(
                "count",
                [
                    Filter(
                        [
                            MetricName("transactions"),
                            Function("notIn", [Tag("status"), ["ok", "cancelled", "unknown"]]),
                        ]
                    )
                ],
            ),
            Function("count", [MetricName("transactions")]),
        ],
    )
    assert parse_expression(dsl) == expr


def test_apdex():
    dsl = '(count(transactions{satisfaction="satisfied"}) + count(transactions{satisfaction="tolerable"}) / 2) / count(transactions)'
    expr = Function(
        "divide",
        [
            Function(
                "plus",
                [
                    Function(
                        "count",
                        [
                            Filter(
                                [
                                    MetricName("transactions"),
                                    Function("equals", [Tag("satisfaction"), "satisfied"]),
                                ]
                            )
                        ],
                    ),
                    Function(
                        "divide",
                        [
                            Function(
                                "count",
                                [
                                    Filter(
                                        [
                                            MetricName("transactions"),
                                            Function("equals", [Tag("satisfaction"), "tolerable"]),
                                        ]
                                    )
                                ],
                            ),
                            2.0,
                        ],
                    ),
                ],
            ),
            Function("count", [MetricName("transactions")]),
        ],
    )
    assert parse_expression(dsl) == expr


def test_user_misery():
    dsl = '(count_unique(user{satisfaction="frustrated"}) + $alpha) / (count_unique(user) + $alpha + $beta)'
    expr = Function(
        "divide",
        [
            Function(
                "plus",
                [
                    Function(
                        "count_unique",
                        [
                            Filter(
                                [
                                    MetricName("user"),
                                    Function("equals", [Tag("satisfaction"), "frustrated"]),
                                ]
                            )
                        ],
                    ),
                    Variable("alpha"),
                ],
            ),
            Function(
                "plus",
                [
                    Function(
                        "plus", [Function("count_unique", [MetricName("user")]), Variable("alpha")]
                    ),
                    Variable("beta"),
                ],
            ),
        ],
    )
    assert parse_expression(dsl) == expr


def test_newlines():
    dsl = r"""
    $foo /
    $bar
"""
    expr = Function("divide", [Variable("foo"), Variable("bar")])
    assert parse_expression(dsl) == expr
