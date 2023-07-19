"""
Query executor for metrics queries.
"""

from sentry.sentry_metrics.query_experimental.backend import default_backend
from sentry.sentry_metrics.query_experimental.calculation import generate_calculation
from sentry.sentry_metrics.query_experimental.expansion import expand_derived_metrics
from sentry.sentry_metrics.query_experimental.indexes import map_query_indexes, map_result_indexes
from sentry.sentry_metrics.query_experimental.naming import map_query_names, map_result_names
from sentry.sentry_metrics.query_experimental.types import SeriesQuery, SeriesResult

# TODO: Request class
# TODO: projects as function args or as filters/expressions in SeriesQuery?


def get_series_public(query: SeriesQuery, org_id: int) -> SeriesResult:
    resolved = map_query_names(query)
    result = get_series_internal(resolved, org_id)
    return map_result_names(result)


def get_series_internal(query: SeriesQuery, org_id: int) -> SeriesResult:
    query = expand_derived_metrics(query)
    query = map_query_indexes(query, org_id)

    calculation = generate_calculation(query)
    for subquery in calculation.queries:
        result = default_backend.run_query(subquery)
        calculation.add_result(subquery, result)

    result = calculation.evaluate()
    result = map_result_indexes(result)
    return result
