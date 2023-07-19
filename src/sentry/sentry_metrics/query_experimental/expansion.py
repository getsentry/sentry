"""
Expansion for derived metrics in query expressions.
"""

from typing import Dict, Optional, Union

from sentry.sentry_metrics.query_experimental.transform import QueryTransform
from sentry.sentry_metrics.query_experimental.types import (
    Column,
    Condition,
    Expression,
    InvalidMetricsQuery,
    SeriesQuery,
)

# TODO: Support dynamic lookup for measurements


class ExpressionRegistry:
    """
    Registry for derived metric expressions.

    Every derived metric has a unique MRI that can be referenced in queries. It
    stands for a query expression that is expanded during query execution.
    """

    def __init__(self):
        self._metrics: Dict[str, Expression] = {}

    def register(self, mri: str, expression: Expression):
        """
        Register a public name for translation to an MRI.
        """

        if mri in self._metrics:
            raise ValueError(f"Derived metric `{mri}` already registered")

        # TODO: Validate MRI
        # TODO: Validate expression

        self._metrics[mri] = expression

    def resolve(self, mri: str) -> Expression:
        expression = self.try_resolve(mri)
        if expression is None:
            raise InvalidMetricsQuery(f"Derived metric `{mri}` not registered")
        return expression

    def try_resolve(self, mri: str) -> Optional[Expression]:
        return self._metrics.get(mri)


_REGISTRY: ExpressionRegistry = ExpressionRegistry()


def register_derived_metric(mri: str, expression: Expression):
    """
    Register a derived metric that will be expanded in queries.
    """
    _REGISTRY.register(mri, expression)


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
    def __init__(self, registry: ExpressionRegistry):
        self.registry = registry

    def _visit_condition(self, condition: Condition) -> Condition:
        # Do not process filter conditions, as neither the tag keys nor tag
        # value expressions can contain derived metrics.
        return condition

    def _visit_column(self, column: Column) -> Union[Column, Expression]:
        # Do not try to expand variables
        if column.name.startswith("$"):
            # TODO: Should we error here? These should probably be replaced
            # before, or else we could cause bugs in the execution pipeline.
            return column

        expression = self.registry.resolve(column.name)
        if expression is None:
            return column

        # Recurse into the resolved expression to resolve nested derived metrics
        return self.visit(expression)
