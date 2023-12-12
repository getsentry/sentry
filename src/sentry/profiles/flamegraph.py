from datetime import datetime
from typing import Any, Dict, List, Optional

from snuba_sdk import Column, Condition, Entity, Function, Limit, Op, Query, Request

from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import ParamsType
from sentry.snuba import functions
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def query_profiles_data(
    params: ParamsType,
    referrer: str,
    selected_columns: List[str],
    query: Optional[str] = None,
    additional_conditions: Optional[List[Condition]] = None,
) -> List[Dict[str, Any]]:
    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        query=query,
        selected_columns=selected_columns,
        limit=100,
    )

    builder.add_conditions(
        [
            Condition(Column("type"), Op.EQ, "transaction"),
            Condition(Column("profile_id"), Op.IS_NOT_NULL),
        ]
    )
    if additional_conditions is not None:
        builder.add_conditions(additional_conditions)

    snql_query = builder.get_snql_query()
    return raw_snql_query(
        snql_query,
        referrer,
    )["data"]


def get_profile_ids(
    params: ParamsType,
    query: Optional[str] = None,
) -> Dict[str, List[str]]:
    data = query_profiles_data(
        params,
        Referrer.API_PROFILING_PROFILE_FLAMEGRAPH.value,
        selected_columns=["profile.id"],
        query=query,
    )
    return {"profile_ids": [row["profile.id"] for row in data]}


def get_profile_ids_with_spans(
    organization_id: int,
    project_id: int,
    params: ParamsType,
    span_group: str,
):
    query = Query(
        match=Entity(EntityKey.Spans.value),
        select=[
            Column("profile_id"),
            Function(
                "groupArray(100)",
                parameters=[
                    Function(
                        "tuple",
                        [
                            Column("start_timestamp"),
                            Column("start_ms"),
                            Column("end_timestamp"),
                            Column("end_ms"),
                        ],
                    )
                ],
                alias="intervals",
            ),
        ],
        groupby=[
            Column("profile_id"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.GTE, params["start"]),
            Condition(Column("timestamp"), Op.LT, params["end"]),
            Condition(Column("group"), Op.EQ, span_group),
            Condition(Column("profile_id"), Op.IS_NOT_NULL),
        ],
        limit=Limit(100),
    )
    request = Request(
        dataset=Dataset.SpansIndexed.value,
        app_id="default",
        query=query,
        tenant_ids={
            "referrer": Referrer.API_STARFISH_PROFILE_FLAMEGRAPH.value,
            "organization_id": organization_id,
        },
    )
    data = raw_snql_query(
        request,
        referrer=Referrer.API_STARFISH_PROFILE_FLAMEGRAPH.value,
    )["data"]
    profile_ids = []
    spans = []
    for row in data:
        transformed_intervals = []
        profile_ids.append(row["profile_id"].replace("-", ""))
        for interval in row["intervals"]:
            start_timestamp, start_ms, end_timestamp, end_ms = interval
            start_ns = (int(datetime.fromisoformat(start_timestamp).timestamp()) * 10**9) + (
                start_ms * 10**6
            )
            end_ns = (int(datetime.fromisoformat(end_timestamp).timestamp()) * 10**9) + (
                end_ms * 10**6
            )
            transformed_intervals.append({"start": str(start_ns), "end": str(end_ns)})
        spans.append(transformed_intervals)
    return {"profile_ids": profile_ids, "spans": spans}


def get_profiles_with_function(
    organization_id: int,
    project_id: int,
    function_fingerprint: int,
    params: ParamsType,
    query: str,
):
    conditions = [query, f"fingerprint:{function_fingerprint}"]

    result = functions.query(
        selected_columns=["unique_examples(100)"],
        query=" ".join(cond for cond in conditions if cond),
        params=params,
        limit=1,
        referrer=Referrer.API_PROFILING_FUNCTION_SCOPED_FLAMEGRAPH.value,
        auto_aggregations=True,
        use_aggregate_conditions=True,
        transform_alias_to_input_format=True,
    )

    return {"profile_ids": result["data"][0]["unique_examples(100)"]}
