from sentry.sentry_metrics.query_experimental.expansion import ExpandTransform, ExpressionRegistry
from sentry.sentry_metrics.query_experimental.types import Filter, Function, MetricName, Tag

MRI = "e:transactions/derived@none"
EXPR = Function("sum", [MetricName("mymetric")])


def test_expand_basic():
    registry = ExpressionRegistry()
    registry.register(MRI, EXPR)

    expr = MetricName(MRI)
    expanded = ExpandTransform(registry).visit(expr)

    assert expanded == EXPR


def test_expand_basic_mql():
    registry = ExpressionRegistry()
    registry.register(MRI, "sum(mymetric)")

    expr = MetricName(MRI)
    expanded = ExpandTransform(registry).visit(expr)

    assert expanded == Function("sum", [MetricName("mymetric")])


def test_expand_filter():
    registry = ExpressionRegistry()
    registry.register(MRI, EXPR)

    expr = Filter([MetricName(MRI), Function("equals", [Tag("foo"), "bar"])])
    expanded = ExpandTransform(registry).visit(expr)

    assert expanded == Filter([EXPR, Function("equals", [Tag("foo"), "bar"])])


def test_expand_nested():
    registry = ExpressionRegistry()
    registry.register(MRI, EXPR)

    expr = Function("divide", [MetricName(MRI), 2])
    expanded = ExpandTransform(registry).visit(expr)

    assert expanded == Function("divide", [EXPR, 2])


def test_transitive_expansion():
    registry = ExpressionRegistry()
    registry.register(
        "e:transactions/failures@none", '`d:transactions/duration@millisecond`{status="failed"}'
    )
    # Refers to derived metric above
    registry.register(
        "e:transactions/failure_rate@none",
        "count(`e:transactions/failures@none`) / count(`d:transactions/duration@millisecond`)",
    )

    expr = MetricName("e:transactions/failure_rate@none")
    expanded = ExpandTransform(registry).visit(expr)

    assert expanded == Function(
        "divide",
        [
            Function(
                "count",
                [
                    Filter(
                        [
                            MetricName("d:transactions/duration@millisecond"),
                            Function("equals", [Tag("status"), "failed"]),
                        ]
                    )
                ],
            ),
            Function("count", [MetricName("d:transactions/duration@millisecond")]),
        ],
    )
