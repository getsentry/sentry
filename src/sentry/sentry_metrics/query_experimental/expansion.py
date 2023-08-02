"""
Expansion for derived metrics in query expressions.
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
