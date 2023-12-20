from datetime import datetime
from typing import Iterable, Tuple

from snuba_sdk import Column, Condition, Entity, Limit, Op, Query, Request

from sentry.ingest.transaction_clusterer.datasource import (
    TRANSACTION_SOURCE_SANITIZED,
    TRANSACTION_SOURCE_URL,
)
from sentry.models.project import Project
from sentry.utils.snuba import raw_snql_query


def fetch_unique_transaction_names(
    project: Project, time_range: Tuple[datetime, datetime], limit: int
) -> Iterable[str]:
    then, now = time_range
    snuba_request = Request(
        "transactions",
        app_id="transactions",
        query=Query(
            match=Entity("transactions"),
            select=[Column("transaction")],
            where=[
                Condition(Column("project_id"), Op.EQ, project.id),
                Condition(Column("finish_ts"), Op.GTE, then),
                Condition(Column("finish_ts"), Op.LT, now),
                Condition(
                    Column("transaction_source"),
                    Op.IN,
                    [TRANSACTION_SOURCE_URL, TRANSACTION_SOURCE_SANITIZED],
                ),
            ],
            groupby=[Column("transaction")],
            limit=Limit(limit),
        ),
        tenant_ids={"organization_id": project.organization_id},
    )
    snuba_response = raw_snql_query(snuba_request, "src.sentry.ingest.transaction_clusterer")

    return (row["transaction"] for row in snuba_response["data"])
