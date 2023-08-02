"""
Expansion for derived metrics in query expressions.

To register a derived metric, use ``register_derived_metric``. Expressions can
be provided in MQL synatx for brevity. Derived metrics can be used in queries
like any other metric and behave like the expression would in their place. This
means:

- If the derived metric applies filters but no aggregation, it has the same type
  as the inner metric. When querying the derived metric, an aggregation must be
  used like in the outer metric.
- If the derived metric applies an aggregation, it has an evaluated type and
  cannot be aggregated again.

Derived metrics registered globally are expanded automatically by
``get_series``.

Example::

    from sentry.sentry_metrics.query_experimental import get_series, Q, register_derived_metric

    # Global registration of derived metrics
    register_derived_metric("e:usecase/derived@none", 'sum(`c:usecase/metric@none`{tag="value"})')

    def load_my_metrics():
        query = (
            Q()
            # Query the derived metric, which will expand internally
            .expr("`e:usecase/derived@none`")
            # Add scoping, time range, ...
            .build()
        )

        # Query the series from the public namespace
        return get_series(query)
"""

from typing import Dict, Optional, Union

from .dsl import parse_expression
from .pipeline import QueryLayer
from .transform import QueryTransform
from .types import Expression, InvalidMetricsQuery, MetricName, SeriesQuery, parse_mri


class ExpressionRegistry:
    """
    Registry for derived metric expressions.

    Every derived metric has a unique MRI that can be referenced in queries. It
    stands for a query expression that is expanded during query execution.
    """

    def __init__(self):
        self._metrics: Dict[str, Expression] = {}

    def register(self, mri: str, expression: Union[Expression, str]):
        """
        Register a public name for translation to an MRI.

        The expression can be an MQL string, in which case it will be parsed
        on-the-fly. This can raise ``InvalidMetricsQuery`` if it is malformed.
        """

        if mri in self._metrics:
            raise ValueError(f"Derived metric `{mri}` already registered")

        if isinstance(expression, str):
            expression = parse_expression(expression)

        parse_mri(mri)  # Validate and discard result
        self._metrics[mri] = expression

    def resolve(self, mri: str) -> Expression:
        expression = self.try_resolve(mri)
        if expression is None:
            raise InvalidMetricsQuery(f"Derived metric `{mri}` not registered")
        return expression

    def try_resolve(self, mri: str) -> Optional[Expression]:
        return self._metrics.get(mri)


_REGISTRY: ExpressionRegistry = ExpressionRegistry()


def register_derived_metric(mri: str, expression: Union[Expression, str]):
    """
    Register a derived metric that will be expanded in queries.

    The expression can be an MQL string, in which case it will be parsed
    on-the-fly. This can raise ``InvalidMetricsQuery`` if it is malformed.

    Use ``expand_derived_metrics`` to expand derived metrics in a query. This is
    done automatically by ``get_series``.
    """
    _REGISTRY.register(mri, expression)


class ExpansionLayer(QueryLayer):
    """
    Layer for the query pipeline that recursively expands references to derived
    metrics in queries with their backing expressions.

    Use ``register_derived_metric`` to register derived metrics.
    """

    def __init__(self, registry: Optional[ExpressionRegistry] = None):
        self.registry = registry

    def transform_query(self, query: SeriesQuery) -> SeriesQuery:
        return expand_derived_metrics(query, registry=self.registry)


def expand_derived_metrics(
    query: SeriesQuery, registry: Optional[ExpressionRegistry] = None
) -> SeriesQuery:
    """
    Recursively replace references to derived metrics in queries with their
    backing expressions.
    """

    transform = ExpandTransform(_REGISTRY if registry is None else registry)
    return transform.visit(query)


class ExpandTransform(QueryTransform):
    """
    Transform for recursively expanding derived metrics in queries.
    """

    def __init__(self, registry: ExpressionRegistry):
        self.registry = registry

    def _visit_metric(self, metric: MetricName) -> Union[MetricName, Expression]:
        expression = self.registry.try_resolve(metric.name)
        if expression is None:
            return metric

        # Recurse into the resolved expression to resolve nested derived metrics
        return self.visit(expression)
