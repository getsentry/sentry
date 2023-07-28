"""
Resolution of indexed metric names, tag keys, and tag values in metric queries
and results.
"""

from typing import Union

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID, get_query_config

from .pipeline import QueryLayer
from .transform import QueryTransform
from .types import Column, SeriesQuery, SeriesResult
from .use_case import get_use_case

#: Special integer used to represent a string missing from the indexer
# TODO: Import or move from sentry.snuba.metrics.utils
STRING_NOT_FOUND = -1


# TODO: Support dynamic lookup for measurements


class IndexLayer(QueryLayer):
    """
    Layer for the query pipeline that resolves indexed metric names, tag keys,
    and tag values in metric queries and maps them back in results.
    """

    def transform_query(self, query: SeriesQuery) -> SeriesQuery:
        return map_query_indexes(query)

    def transform_result(self, result: SeriesResult) -> SeriesResult:
        return map_result_indexes(result)


def map_query_indexes(query: SeriesQuery) -> SeriesQuery:
    """
    Map public metric names in a series query to MRIs and map tag names.

    The resolved indexes are placed in the ``key`` field of all columns. The
    ``name`` field is left unchanged. Unresolved indexes are represented by
    ``STRING_NOT_FOUND``.
    """

    return IndexerTransform(get_use_case(query), query.scope.org_id).visit(query)


def map_result_indexes(result: SeriesResult) -> SeriesResult:
    """
    Map MRIs in a series result to public metric names and map tag names.
    """

    raise NotImplementedError()


class IndexerTransform(QueryTransform):
    """
    Transform that resolves indexed metric names, tag keys, and tag values in
    metric queries.

    The resolved indexes are placed in the ``key`` field of all columns. The
    ``name`` field is left unchanged. Unresolved indexes are represented by
    ``STRING_NOT_FOUND``.
    """

    def __init__(self, use_case: UseCaseID, org_id: int):
        self.config = get_query_config(use_case)
        self.use_case = use_case
        self.org_id = org_id

    def _visit_column(self, column: Column) -> Column:
        resolved = indexer.resolve(self.use_case, self.org_id, column.name)
        if resolved is None:
            resolved = STRING_NOT_FOUND

        # NB: key is a non-init field of a frozen class. It is meant to be used
        # with subscriptible, which is context-dependent. In metrics queries,
        # it is used to store the index of the metric name, tag key, or value.
        super(Column, column).__setattr__("key", str(resolved))
        return column

    def _visit_str(self, string: str) -> Union[str, int]:
        if not self.config.index_values:
            return string

        if resolved := indexer.resolve(self.use_case, self.org_id, string):
            return resolved
        return STRING_NOT_FOUND
