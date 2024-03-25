from collections.abc import Sequence
from datetime import datetime
from typing import cast

from snuba_sdk import MetricsQuery, MetricsScope, Rollup

from sentry import features
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.data_v2.execution import QueryExecutor, QueryResult
from sentry.sentry_metrics.querying.data_v2.parsing import QueryParser
from sentry.sentry_metrics.querying.data_v2.plan import MetricsQueriesPlan, MetricsQueriesPlanResult
from sentry.sentry_metrics.querying.data_v2.preparation.base import (
    IntermediateQuery,
    run_preparation_steps,
)
from sentry.sentry_metrics.querying.data_v2.preparation.units_normalization import (
    UnitNormalizationStep,
)
from sentry.sentry_metrics.querying.types import QueryType


def run_metrics_queries_plan(
    metrics_queries_plan: MetricsQueriesPlan,
    start: datetime,
    end: datetime,
    interval: int,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
    referrer: str,
    query_type: QueryType = QueryType.TOTALS_AND_SERIES,
) -> MetricsQueriesPlanResult:
    """
    Runs a MetricsQueriesPlan which is converted into a series of queries that are executed in Snuba.

    Returns:
        A MetricsQueriesPlanResult object which encapsulates the results of the plan and allows a QueryTransformer
        to be run on the data.
    """
    # For now, if the query plan is empty, we return an empty dictionary. In the future, we might want to default
    # to a better data type.
    if metrics_queries_plan.is_empty():
        return MetricsQueriesPlanResult([])

    # We build the basic query that contains the metadata which will be shared across all queries.
    base_query = MetricsQuery(
        start=start,
        end=end,
        scope=MetricsScope(
            org_ids=[organization.id],
            project_ids=[project.id for project in projects],
        ),
    )

    intermediate_queries = []
    # We parse the query plan and obtain a series of queries.
    parser = QueryParser(
        projects=projects, environments=environments, metrics_queries_plan=metrics_queries_plan
    )
    for query_expression, query_order, query_limit in parser.generate_queries():
        intermediate_queries.append(
            IntermediateQuery(
                metrics_query=base_query.set_query(query_expression).set_rollup(
                    Rollup(interval=interval)
                ),
                order=query_order,
                limit=query_limit,
            )
        )

    preparation_steps = []
    if features.has(
        "organizations:ddm-metrics-api-unit-normalization", organization=organization, actor=None
    ):
        preparation_steps.append(UnitNormalizationStep())

    # We run a series of preparation steps which operate on the entire list of queries.
    intermediate_queries = run_preparation_steps(intermediate_queries, *preparation_steps)

    # We prepare the executor, that will be responsible for scheduling the execution of multiple queries.
    executor = QueryExecutor(organization=organization, projects=projects, referrer=referrer)
    for intermediate_query in intermediate_queries:
        executor.schedule(intermediate_query=intermediate_query, query_type=query_type)

    results = executor.execute()

    # We wrap the result in a class that exposes some utils methods to operate on results.
    return MetricsQueriesPlanResult(cast(list[QueryResult], results))
