"""
Query executor for metrics queries.
"""

from typing import List

from .backend import MetricsBackend, default_backend
from .calculation import generate_calculation
from .types import SeriesQuery, SeriesResult

# TODO: Request class?


class QueryLayer:
    """
    Base class for layers that wrap the query pipeline and preprocess queries or
    post process results.
    """

    def transform_query(self, query: SeriesQuery) -> SeriesQuery:
        """
        Transform a query. Default implementation is an identity transform.
        """
        return query

    def transform_result(self, result: SeriesResult) -> SeriesResult:
        """
        Transform a result. Default implementation is an identity transform.
        """
        return result


class QueryPipeline:
    """
    A configurable pipeline for executing metrics queries.

    To construct a pipeline, add layers with :meth:`layer` and then execute
    queries with :meth:`execute`. Layers are applied in the following order:
     - Query preprocessing: outer-most to inner-most
     - Result postprocessing: inner-most to outer-most
    """

    def __init__(self):
        self._layers: List[QueryLayer] = []
        self._backend: MetricsBackend = default_backend

    def backend(self, backend: MetricsBackend) -> "QueryPipeline":
        """
        Set the backend to use for executing queries. Defaults to the default
        backend (Snuba).
        """

        self._backend = backend
        return self

    def layer(self, layer) -> "QueryPipeline":
        """
        Wrap the query pipeline with a layer that transforms queries or results.

        This layer is first to transform the query and last to transform the
        result.
        """

        self._layers.append(layer)
        return self

    def layer_if(self, flag: bool, layer) -> "QueryPipeline":
        """
        Add a conditional query layer to the pipeline that transforms queries or
        results if the given flag is set.

        This is a convenience method that allows chaining optional layers. See
        :meth:`layer` for more information.
        """

        if flag:
            self._layers.append(layer)
        return self

    def execute(self, query: SeriesQuery) -> SeriesResult:
        """
        Execute a series query and return the fully processed result.

        This will run the query through all layers in the pipeline. Layers are
        applied in the following order:
         - Query preprocessing: outer-most to inner-most
         - Result postprocessing: inner-most to outer-most
        """

        for layer in self._layers:
            query = layer.transform_query(query)

        result = _execute_query_raw(query, self._backend)

        for layer in reversed(self._layers):
            result = layer.transform_result(result)

        return result


def _execute_query_raw(query: SeriesQuery, backend: MetricsBackend) -> SeriesResult:
    """
    Execute a series query and return the result.

    The query must be fully validated and processed before calling this
    function. Most importantly, the following must be true:
     - No variables can be used in query expressions or filters
     - No derived metrics can be used in query expressions
     - All metric names must be fully qualified MRIs
     - Indexes for metric names and tags must be annotated on the respective
       columns

    This will call run the metrics query on the backend. If the query must be
    split because it references multiple metric types, this will run multiple
    queries and combine the results in-memory.
    """

    calculation = generate_calculation(query)
    for subquery in calculation.queries:
        result = backend.query(subquery)
        calculation.add_result(subquery, result)
    return calculation.evaluate()
