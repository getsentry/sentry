"""
Query optimization passes.

Despite the name of the module, these optimizations to not generate the minimal
or optimal query. Instead, they streamline and simplify the query layout to
make it easier to generate the underlying physical query.

The optimizations are:
 - `merge_filters` and `MergeFiltersLayer`: Push all filters to the inner-most
   level around columns, inside aggregation functions.
"""

from typing import List, Union

from .pipeline import QueryLayer
from .transform import QueryTransform
from .types import Column, Filter, Function, InvalidMetricsQuery, SeriesQuery


class MergeFiltersLayer(QueryLayer):
    """
    Layer for the query pipeline that recursively merges filters to the
    inner-most level around columns inside aggregations. Filters are cloned into
    every arm of arithmetic expressions, should they contain references to
    metrics.
    """

    def transform_query(self, query: SeriesQuery) -> SeriesQuery:
        return merge_filters(query)


def merge_filters(query: SeriesQuery) -> SeriesQuery:
    """
    Recursively merge filters to the inner-most level around columns inside
    aggregations. Filters are cloned into every arm of arithmetic expressions,
    should they contain references to metrics.
    """
    return MergeFiltersTransform().visit(query)


class MergeFiltersTransform(QueryTransform):
    """
    A query transform that recursively merges filters to the inner-most level
    around columns inside aggregations. Filters are cloned into every arm of
    arithmetic expressions, should they contain references to metrics.

    Example::

        # Input
        Filter([
            Function("divide", [
                Filter([
                    Function("count", [Column("my_metric")]),
                    Function("equals", [Column("inner"), "inner"]),
                ]),
                Function("count", [Column("my_metric")]),
            ]),
            Function("equals", [Column("outer"), "outer"]),
        ])

        # Output
        Function("divide", [
            Function("count", [
                Filter([
                    Column("my_metric"),
                    Function("equals", [Column("inner"), "inner"]),
                    Function("equals", [Column("outer"), "outer"]),
                ]),
            ]),
            Function("count", [
                Filter([
                    Column("my_metric"),
                    Function("equals", [Column("outer"), "outer"]),
                ]),
            ]),
        ])
    """

    def __init__(self):
        self.stack: List[List[Function]] = []

    def _visit_filter(self, filt: Filter) -> Function:
        if len(filt.parameters) < 1:
            raise InvalidMetricsQuery("Invalid filter expression")

        (inner, *conditions) = filt.parameters
        self.stack.append(conditions)
        inner = self.visit(inner)
        self.stack.pop()

        return inner

    def _visit_column(self, column: Column) -> Union[Function, Column]:
        if not self.stack:
            return column

        conditions = [condition for conditions in self.stack for condition in conditions]
        return Filter([column, *conditions])
