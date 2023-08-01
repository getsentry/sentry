"""
Transform that resolves indexed metric names, tag keys, and tag values in metric
queries.
"""

from typing import Set

from sentry.sentry_metrics.use_case_id_registry import UseCaseID

from .transform import QueryVisitor
from .types import Filter, Function, InvalidMetricsQuery, MetricName, SeriesQuery, parse_mri


def get_use_case(query: SeriesQuery) -> UseCaseID:
    """
    Get the single use case referenced by a query. Raises a ``ValueError`` if
    the query references multiple use cases.
    """

    use_cases = UseCaseExtractor().visit(query)
    if len(use_cases) != 1:
        raise ValueError("All metrics in a query must belong to the same use case")

    return use_cases.pop()


class UseCaseExtractor(QueryVisitor[Set[UseCaseID]]):
    """
    Extracts all use cases referenced by MRIs in a query.
    """

    def _visit_query(self, query: SeriesQuery) -> Set[UseCaseID]:
        use_cases = set()
        for expression in query.expressions:
            use_cases |= self.visit(expression)
        return use_cases

    def _visit_filter(self, filt: Filter) -> Set[UseCaseID]:
        if len(filt.parameters) > 0:
            return self.visit(filt.parameters[0])
        else:
            return set()

    def _visit_aggregation(self, aggregation: Function) -> Set[UseCaseID]:
        return self._visit_function(aggregation)

    def _visit_arithmetic(self, arithmetic: Function) -> Set[UseCaseID]:
        return self._visit_function(arithmetic)

    def _visit_condition(self, condition: Function) -> Set[UseCaseID]:
        return set()

    def _visit_function(self, function: Function) -> Set[UseCaseID]:
        use_cases = set()
        for parameter in function.parameters:
            use_cases |= self.visit(parameter)
        return use_cases

    def _visit_metric(self, metric: MetricName) -> Set[UseCaseID]:
        mri = parse_mri(metric.name)

        try:
            return {UseCaseID(mri.namespace)}
        except ValueError:
            raise InvalidMetricsQuery(f"Unknown use case (namespace): `{mri.namespace}`")

    def _visit_tag(self, tag: MetricName) -> Set[UseCaseID]:
        return set()

    def _visit_variable(self, variable: MetricName) -> Set[UseCaseID]:
        return set()

    def _visit_str(self, string: str) -> Set[UseCaseID]:
        return set()

    def _visit_int(self, value: int) -> Set[UseCaseID]:
        return set()

    def _visit_float(self, value: float) -> Set[UseCaseID]:
        return set()
