from typing import Dict, Optional, Union

from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.sentry_metrics.querying.types import QueryExpression
from sentry.snuba.metrics import parse_mri


class ExpressionRegistry:
    """
    Registry for derived metric expressions.
    Every derived metric has a unique MRI that can be referenced in queries. It
    stands for a query expression that is expanded during query execution.
    """

    def __init__(self):
        self._metrics: Dict[str, QueryExpression] = {}

    def register(self, mri: str, expression: QueryExpression):
        """
        Register a public name for translation to an MRI.
        """

        if mri in self._metrics:
            raise ValueError(f"Derived metric `{mri}` already registered")

        # TODO: check if we want to allow expressions to be parsed partially.
        # if isinstance(expression, str):
        #     expression = parse_expression(expression)

        if parse_mri(mri) is None:
            raise ValueError(f"`{mri}` is not a valid mri")

        self._metrics[mri] = expression

    def resolve(self, mri: str) -> QueryExpression:
        expression = self.try_resolve(mri)
        if expression is None:
            raise InvalidMetricsQueryError(f"Derived metric `{mri}` not registered")

        return expression

    def try_resolve(self, mri: str) -> Optional[QueryExpression]:
        return self._metrics.get(mri)


_REGISTRY: ExpressionRegistry = ExpressionRegistry()


def default_expression_registry() -> ExpressionRegistry:
    """
    Returns the default expression registry.
    """
    return _REGISTRY


def register_derived_metric(mri: str, expression: Union[QueryExpression, str]):
    """
    Register a derived metric that will be expanded in queries.
    The expression can be an MQL string, in which case it will be parsed
    on-the-fly. This can raise ``InvalidMetricsQuery`` if it is malformed.
    Use ``expand_derived_metrics`` to expand derived metrics in a query. This is
    done automatically by ``get_series``.
    """
    _REGISTRY.register(mri, expression)
