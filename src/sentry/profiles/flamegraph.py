from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from rest_framework.exceptions import ParseError
from snuba_sdk import Column, Condition, Entity, Function, Op, Query, Request

from sentry import eventstore
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


def get_span_intervals(
    project_id: int,
    span_filter: Condition,
    transaction_ids: List[str],
    organization_id: int,
    params: ParamsType,
) -> List[Dict[str, Any]]:
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
            Condition(Column("timestamp"), Op.GTE, params["start"]),
            Condition(Column("timestamp"), Op.LT, params["end"]),
            span_filter,
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
    data = raw_snql_query(
        request,
        referrer=Referrer.API_STARFISH_PROFILE_FLAMEGRAPH.value,
    )["data"]
    spans_interval = []
    for row in data:
        start_ns = (int(datetime.fromisoformat(row["start_timestamp"]).timestamp()) * 10**9) + (
            row["start_ms"] * 10**6
        )
        end_ns = (int(datetime.fromisoformat(row["end_timestamp"]).timestamp()) * 10**9) + (
            row["end_ms"] * 10**6
        )
        interval = {}
        interval["transaction_id"] = row["transaction_id"]
        interval["start_ns"] = str(start_ns)
        interval["end_ns"] = str(end_ns)
        spans_interval.append(interval)
    return spans_interval


def get_span_intervals_from_nodestore(
    project_id: int,
    span_group: str,
    transaction_ids: List[str],
) -> List[Dict[str, Any]]:
    spans_interval = []
    for id in transaction_ids:
        nodestore_event = eventstore.backend.get_event_by_id(project_id, id)
        data = nodestore_event.data
        for span in data.get("spans", []):
            if span["hash"] == span_group:

                start_sec, start_us = map(int, str(span["start_timestamp"]).split("."))
                end_sec, end_us = map(int, str(span["timestamp"]).split("."))

                start_ns = (start_sec * 10**9) + (start_us * 10**3)
                end_ns = (end_sec * 10**9) + (end_us * 10**3)

                interval = {}
                interval["transaction_id"] = id
                interval["start_ns"] = str(start_ns)
                interval["end_ns"] = str(end_ns)

                spans_interval.append(interval)
    return spans_interval


def get_profile_ids_with_spans(
    organization_id: int,
    project_id: int,
    params: ParamsType,
    span_group: str,
    backend: str,
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

    transaction_to_prof: Dict[str, Tuple[str, List[Dict[str, str]]]] = {
        row["id"]: (row["profile.id"], []) for row in data
    }

    if backend == "nodestore":
        data = get_span_intervals_from_nodestore(
            project_id,
            span_group,
            list(transaction_to_prof.keys()),
        )
    elif backend == "indexed_spans":
        data = get_span_intervals(
            project_id,
            Condition(Column("group_raw"), Op.EQ, span_group),
            list(transaction_to_prof.keys()),
            organization_id,
            params,
        )
    else:
        raise ParseError(
            detail="Backend not supported: choose between 'indexed_spans' or 'nodestore'."
        )

    for row in data:
        transaction_to_prof[row["transaction_id"]][1].append(
            {"start": row["start_ns"], "end": row["end_ns"]}
        )

    profile_ids = [tup[0] for tup in transaction_to_prof.values()]
    spans = [tup[1] for tup in transaction_to_prof.values()]

    return {"profile_ids": profile_ids, "spans": spans}


def get_profile_ids_for_span_op(
    organization_id: int,
    project_id: int,
    params: ParamsType,
    span_op: str,
    backend: str,
    query: Optional[str] = None,
):
    data = query_profiles_data(
        params,
        Referrer.API_STARFISH_PROFILE_FLAMEGRAPH.value,
        selected_columns=["id", "profile.id"],
        query=query,
        additional_conditions=[
            # Check if span op is in the the indexed transactions spans.op array
            Condition(Function("has", [Column("spans.op"), span_op]), Op.EQ, 1)
        ],
    )

    # map {transaction_id: (profile_id, [span intervals])}

    transaction_to_prof: Dict[str, Tuple[str, List[Dict[str, str]]]] = {
        row["id"]: (row["profile.id"], []) for row in data
    }

    if not transaction_to_prof:
        return {"profile_ids": [], "spans": []}

    # Note: "op" is not a part of the indexed spans orderby so this is
    # is probably not a very efficient filter. This is just to
    # build a little PoC for now, if it needs to be used more extensively
    # in production, we can optimize it.
    data = get_span_intervals(
        project_id,
        Condition(Column("op"), Op.EQ, span_op),
        list(transaction_to_prof.keys()),
        organization_id,
        params,
    )

    for row in data:
        transaction_to_prof[row["transaction_id"]][1].append(
            {"start": row["start_ns"], "end": row["end_ns"]}
        )

    profile_ids = [tup[0] for tup in transaction_to_prof.values()]
    spans = [tup[1] for tup in transaction_to_prof.values()]

    return {"profile_ids": profile_ids, "spans": spans}
