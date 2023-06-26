from datetime import datetime
from typing import Any, Dict, List, Optional

from snuba_sdk import Column, Condition, Entity, Function, Op, Query, Request

from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import ParamsType
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def query_profiles_data(
    params: ParamsType,
    referrer: str,
    selected_columns: List[str],
    query: Optional[str] = None,
    additional_conditions: List[Condition] = None,
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


def get_span_intervals(
    project_id: str,
    span_group: str,
    transaction_ids: List[str],
    organization_id: str,
    params: ParamsType,
) -> Dict[str, Any]:
    query = Query(
        match=Entity(EntityKey.Spans.value),
        select=[
            Column("transaction_id"),
            Column("start_timestamp"),
            Column("start_ms"),
            Column("end_timestamp"),
            Column("end_ms"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("transaction_id"), Op.IN, transaction_ids),
            Condition(Column("group"), Op.EQ, span_group),
            Condition(Column("timestamp"), Op.GTE, params["start"]),
            Condition(Column("timestamp"), Op.LT, params["end"]),
        ],
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
    return raw_snql_query(
        request,
        referrer=Referrer.API_STARFISH_PROFILE_FLAMEGRAPH.value,
    )["data"]


def get_profile_ids_with_spans(
    organization_id: str,
    project_id: str,
    params: ParamsType,
    span_group: str,
    query: Optional[str] = None,
):
    data = query_profiles_data(
        params,
        Referrer.API_STARFISH_PROFILE_FLAMEGRAPH.value,
        selected_columns=["id", "profile.id"],
        query=query,
        additional_conditions=[
            Condition(Function("has", [Column("spans.group"), span_group]), Op.EQ, 1)
        ],
    )
    # map {transaction_id: (profile_id, [span intervals])}
    transaction_to_prof = {row["id"]: (row["profile.id"], []) for row in data}

    data = get_span_intervals(
        project_id,
        span_group,
        list(transaction_to_prof.keys()),
        organization_id,
        params,
    )

    for row in data:
        start_ns = (int(datetime.fromisoformat(row["start_timestamp"]).timestamp()) * 10**9) + (
            row["start_ms"] * 10**6
        )
        end_ns = (int(datetime.fromisoformat(row["end_timestamp"]).timestamp()) * 10**9) + (
            row["end_ms"] * 10**6
        )
        transaction_id = row["transaction_id"]

        transaction_to_prof[transaction_id][1].append({"start": str(start_ns), "end": str(end_ns)})

    profile_ids = [tup[0] for tup in transaction_to_prof.values()]
    spans = [tup[1] for tup in transaction_to_prof.values()]

    return {"profile_ids": profile_ids, "spans": spans}
