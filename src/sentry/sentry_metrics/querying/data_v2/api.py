from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from snuba_sdk import MetricsQuery, MetricsScope, Rollup

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.data_v2.execution import QueryExecutor
from sentry.sentry_metrics.querying.data_v2.parsing import QueryParser
from sentry.sentry_metrics.querying.data_v2.plan import MetricsQueriesPlan
from sentry.sentry_metrics.querying.data_v2.transformation import QueryTransformer
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.snuba.metrics_layer.query import compute_smallest_valid_interval
from sentry.utils import metrics


def run_metrics_queries_plan(
    metrics_queries_plan: MetricsQueriesPlan,
    start: datetime,
    end: datetime,
    interval: int,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
    referrer: str,
) -> Mapping[str, Any]:
    # For now, if the query plan is empty, we return an empty dictionary. In the future, we might want to default
    # to a better data type.
    if metrics_queries_plan.is_empty():
        return {}

    # We build the basic query that contains the metadata which will be shared across all queries.
    base_query = MetricsQuery(
        start=start,
        end=end,
        scope=MetricsScope(
            org_ids=[organization.id],
            project_ids=[project.id for project in projects],
        ),
    )

    # We prepare the executor, that will be responsible for scheduling the execution of multiple queries.
    executor = QueryExecutor(organization=organization, projects=projects, referrer=referrer)

    # We parse the query plan and obtain a series of queries.
    parser = QueryParser(
        projects=projects, environments=environments, metrics_queries_plan=metrics_queries_plan
    )

    # We compute a list of queries to execute, by decomposing the result of the parser. It could be done better with
    # proper typing, but it's good enough considering it's only used here.
    queries = list(
        map(
            lambda q: (
                base_query.set_query(q[0]).set_rollup(Rollup(interval=interval)),
                q[1],
                q[2],
            ),
            parser.generate_queries(),
        )
    )

    # We try to find the smallest valid interval.
    smallest_valid_interval = compute_smallest_valid_interval(map(lambda q: q[0], queries))
    if smallest_valid_interval is None:
        raise InvalidMetricsQueryError(
            f"Impossible to determine a valid interval for the query given the supplied "
            f"interval {interval}"
        )

    for metrics_query, query_order, query_limit in queries:
        metrics_query = metrics_query.set_rollup(Rollup(interval=smallest_valid_interval))
        executor.schedule(query=metrics_query, order=query_order, limit=query_limit)

    with metrics.timer(key="ddm.metrics_api.metrics_queries_plan.execution_time"):
        # Iterating over each result.
        results = executor.execute()

    # We transform the result into a custom format which for now it's statically defined.
    transformer = QueryTransformer(results)
    return transformer.transform()
