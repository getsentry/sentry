from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from snuba_sdk import Request as SnubaRequest
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Query

from sentry.snuba.dataset import Dataset
from sentry.utils import snuba


def get_errors_counts_timeseries_by_project_and_release(
    end: datetime,
    organization_id: int,
    project_id_list: List[int],
    release_value_list: List[str],
    start: datetime,
    environments_list: List[str] | None = None,
) -> List[Dict[str, Any]]:
    additional_conditions = []
    if environments_list:
        additional_conditions.append(Condition(Column("environment"), Op.IN, environments_list))
    query = Query(
        match=Entity("events"),  # synonymous w/ discover dataset
        select=[Function("count", [])],
        groupby=[
            Column("release"),
            Column("project_id"),
            Column("environment"),
            Column("time"),  # groupby 'time' gives us a timeseries
        ],
        orderby=[
            OrderBy(Column("time"), Direction.DESC),
        ],
        granularity=Granularity(60),
        where=[
            Condition(Column("type"), Op.EQ, "error"),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("project_id"), Op.IN, project_id_list),
            Condition(Column("release"), Op.IN, release_value_list),
            *additional_conditions,
        ],
    )
    request = SnubaRequest(
        dataset=Dataset.Events.value,
        app_id="default",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )
    data = snuba.raw_snql_query(
        request=request, referrer="snuba.sessions.check_releases_have_health_data"
    )["data"]

    return data
