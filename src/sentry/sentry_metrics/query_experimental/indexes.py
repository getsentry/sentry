"""
Transform that resolves indexed metric names, tag keys, and tag values in metric
queries.
"""

from typing import Set

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.query_experimental.transform import QueryTransform, QueryVisitor
from sentry.sentry_metrics.query_experimental.types import (
    Column,
    Condition,
    Function,
    InvalidMetricsQuery,
    SeriesQuery,
    SeriesResult,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import parse_mri

#: Special integer used to represent a string missing from the indexer
# TODO: Import or move from sentry.snuba.metrics.utils
STRING_NOT_FOUND = -1


def map_query_indexes(query: SeriesQuery, org_id: int) -> SeriesQuery:
    """
    Map public metric names in a series query to MRIs and map tag names.
    """

    use_cases = UseCaseExtractor().visit(query)
    if len(use_cases) != 1:
        raise ValueError("All metrics in a query must belong to the same use case")

    use_case = use_cases.pop()
    return IndexerTransform(use_case, org_id).visit(query)


def map_result_indexes(result: SeriesResult) -> SeriesResult:
    """
    Map MRIs in a series result to public metric names and map tag names.
    """

    raise NotImplementedError()


class UseCaseExtractor(QueryVisitor[Set[UseCaseID]]):
    """
    Extracts all use cases referenced by MRIs in a query.
    """

    def _visit_query(self, query: SeriesQuery) -> Set[UseCaseID]:
        use_cases = set()
        for expression in query.expressions:
            use_cases |= self.visit(expression)
        return use_cases

    def _visit_filter(self, filt: Function) -> Set[UseCaseID]:
        if len(filt.parameters) > 0:
            return self.visit(filt.parameters[0])
        else:
            return set()

    def _visit_condition(self, condition: Condition) -> Set[UseCaseID]:
        return set()

    def _visit_function(self, function: Function) -> Set[UseCaseID]:
        use_cases = set()
        for parameter in function.parameters:
            use_cases |= self.visit(parameter)
        return use_cases

    def _visit_column(self, column: Column) -> Set[UseCaseID]:
        mri = parse_mri(column.name)
        if mri is None:
            raise InvalidMetricsQuery(f"Expected MRI, got `{column.name}`")

        try:
            return {UseCaseID(mri.namespace)}
        except ValueError:
            raise InvalidMetricsQuery(f"Unknown use case (namespace): `{mri.namespace}`")

    def _visit_str(self, string: str) -> Set[UseCaseID]:
        return set()

    def _visit_int(self, value: int) -> Set[UseCaseID]:
        return set()

    def _visit_float(self, value: float) -> Set[UseCaseID]:
        return set()


class IndexerTransform(QueryTransform):
    def __init__(self, use_case: UseCaseID, org_id: int):
        self.use_case = use_case
        self.org_id = org_id

    def _visit_column(self, column: Column) -> Column:
        resolved = indexer.resolve(self.use_case, self.org_id, column.name)
        if resolved is None:
            resolved = STRING_NOT_FOUND

        # TODO: Skip tag values based on the flag? -> _visit_condition

        # TODO: New type for resolved column names?
        return Column(name=str(resolved))
