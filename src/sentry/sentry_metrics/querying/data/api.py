from datetime import datetime
from typing import Optional, Sequence

from snuba_sdk import MetricsQuery, MetricsScope, Rollup

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.execution import QueryExecutor
from sentry.sentry_metrics.querying.data.parsing import QueryParser
from sentry.sentry_metrics.querying.data.transformation import QueryTransformer
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.utils import metrics


def run_metrics_query(
    fields: Sequence[str],
    interval: int,
    start: datetime,
    end: datetime,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
    referrer: str,
    query: Optional[str] = None,
    group_bys: Optional[Sequence[str]] = None,
    order_by: Optional[str] = None,
    limit: Optional[int] = None,
):
    # We build the basic query that contains the metadata.
    base_query = MetricsQuery(
        start=start,
        end=end,
        scope=MetricsScope(
            org_ids=[organization.id],
            project_ids=[project.id for project in projects],
        ),
    )

    # We prepare the executor, that will be responsible for scheduling the execution multiple queries.
    executor = QueryExecutor(organization=organization, referrer=referrer)

    # We parse the input and iterating over each timeseries.
    parser = QueryParser(projects=projects, fields=fields, query=query, group_bys=group_bys)

    applied_order_by = False
    for field, timeseries in parser.generate_queries(environments=environments):
        query = base_query.set_query(timeseries).set_rollup(Rollup(interval=interval))

        # We will apply the order by if it only matches the field. This is done since for now we don't support a custom
        # since for order bys.
        query_order_by = None
        if order_by and field == order_by.removeprefix("-"):
            query_order_by = order_by
            applied_order_by = True

        # The identifier of the query is the field which it tries to fetch. It has been chosen as the identifier since
        # it's stable and uniquely identifies the query.
        executor.schedule(
            identifier=field, query=query, group_bys=group_bys, order_by=query_order_by, limit=limit
        )

    if order_by and not applied_order_by:
        raise InvalidMetricsQueryError(
            f"The supplied orderBy {order_by} is not matching with any field of the query"
        )

    with metrics.timer(
        key="ddm.metrics_api.queries_execution_time",
        tags={"with_order_by": (order_by is not None), "with_group_by": (group_bys is not None)},
    ):
        # Iterating over each result.
        results = []
        for result in executor.execute():
            results.append(result)

    # We transform the result into a custom format which for now it's statically defined.
    transformer = QueryTransformer(results)
    return transformer.transform()
