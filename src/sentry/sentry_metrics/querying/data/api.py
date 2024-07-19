from collections.abc import Sequence
from datetime import datetime

from snuba_sdk import MetricsQuery, MetricsScope, Rollup

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.execution import QueryExecutor
from sentry.sentry_metrics.querying.data.mapping.base import MapperConfig
from sentry.sentry_metrics.querying.data.mapping.project_mapper import Project2ProjectIDMapper
from sentry.sentry_metrics.querying.data.parsing import QueryParser
from sentry.sentry_metrics.querying.data.postprocessing.base import run_post_processing_steps
from sentry.sentry_metrics.querying.data.postprocessing.remapping import QueryRemappingStep
from sentry.sentry_metrics.querying.data.preparation.base import (
    IntermediateQuery,
    run_preparation_steps,
)
from sentry.sentry_metrics.querying.data.preparation.mapping import QueryMappingStep
from sentry.sentry_metrics.querying.data.preparation.units_normalization import (
    UnitsNormalizationStep,
)
from sentry.sentry_metrics.querying.data.query import MQLQueriesResult, MQLQuery
from sentry.sentry_metrics.querying.types import QueryType

DEFAULT_MAPPINGS: MapperConfig = MapperConfig().add(Project2ProjectIDMapper)


def run_queries(
    mql_queries: Sequence[MQLQuery],
    start: datetime,
    end: datetime,
    interval: int,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
    referrer: str,
    query_type: QueryType = QueryType.TOTALS_AND_SERIES,
) -> MQLQueriesResult:
    """
    Runs a list of MQLQuery(s) that are executed in Snuba.

    Returns:
        A MQLQueriesResult object which encapsulates the results of the plan and allows a QueryTransformer
        to be run on the data.
    """
    # We build the basic query that contains the metadata which will be shared across all queries.
    base_query = MetricsQuery(
        start=start,
        end=end,
        rollup=Rollup(interval),
        scope=MetricsScope(
            org_ids=[organization.id],
            project_ids=[project.id for project in projects],
        ),
    )

    intermediate_queries = []
    # We parse the query plan and obtain a series of queries.
    parser = QueryParser(projects=projects, environments=environments, mql_queries=mql_queries)
    for query_expression, query_order, query_limit in parser.generate_queries():
        intermediate_queries.append(
            IntermediateQuery(
                metrics_query=base_query.set_query(query_expression),
                order=query_order,
                limit=query_limit,
            )
        )

    # We run a series of preparation steps which operate on the entire list of queries.
    intermediate_queries = run_preparation_steps(
        intermediate_queries, UnitsNormalizationStep(), QueryMappingStep(projects, DEFAULT_MAPPINGS)
    )

    # We prepare the executor, that will be responsible for scheduling the execution of multiple queries.
    executor = QueryExecutor(organization=organization, projects=projects, referrer=referrer)
    for intermediate_query in intermediate_queries:
        executor.schedule(intermediate_query=intermediate_query, query_type=query_type)

    results = executor.execute()
    results = run_post_processing_steps(results, QueryRemappingStep(projects))

    # We wrap the result in a class that exposes some utils methods to operate on results.
    return MQLQueriesResult(results)
