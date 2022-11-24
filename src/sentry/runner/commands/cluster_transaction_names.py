from datetime import datetime, timedelta
from typing import Tuple

import click
from snuba_sdk import Column, Condition, Entity, Op, Query, Request

from sentry.runner.decorators import configuration


@click.command()
@click.option("--merge-threshold", type=int, default=100)
@click.option("--time-range-seconds", type=int, default=3600)
@configuration
def cluster_transaction_names(merge_threshold: int, time_range_seconds: int):
    from sentry.models import Project
    from sentry.utils.query import RangeQuerySetWrapper

    now = datetime.now()
    then = now - timedelta(seconds=time_range_seconds)

    for project in RangeQuerySetWrapper(Project.objects.all()):
        # FIXME: Check feature flag before proceeding
        _cluster_project(project.id, merge_threshold, (then, now))


def _cluster_project(project_id: int, merge_threshold: int, time_range: Tuple[datetime, datetime]):
    from sentry.ingest.transaction_clusterer.tree import TreeClusterer
    from sentry.utils.snuba import raw_snql_query

    clusterer = TreeClusterer(merge_threshold=merge_threshold)

    dt_min, dt_max = time_range
    snuba_request = Request(
        "transactions",
        app_id="transactions",
        query=Query(
            match=Entity("transactions"),
            select=[Column("transaction")],
            where=[
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column("finish_ts"), Op.GTE, dt_min),
                Condition(Column("finish_ts"), Op.LT, dt_max),
            ],
            groupby=[Column("transaction")],
        ),
    )
    snuba_response = raw_snql_query(
        snuba_request, referrer="sentry.ingest.cluster_transaction_names"
    )

    clusterer.add_input(row["transaction"] for row in snuba_response["data"])

    # TODO: span for clustering
    clusterer.get_rules()
