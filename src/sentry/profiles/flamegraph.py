from datetime import datetime
from typing import Any, TypedDict

from snuba_sdk import (
    And,
    BooleanCondition,
    Column,
    Condition,
    Entity,
    Function,
    Limit,
    Op,
    Or,
    Query,
    Request,
    Storage,
)

from sentry import options
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import ParamsType
from sentry.snuba import functions
from sentry.snuba.dataset import Dataset, EntityKey, StorageKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def query_profiles_data(
    params: ParamsType,
    referrer: str,
    selected_columns: list[str],
    query: str | None = None,
    additional_conditions: list[Condition] | None = None,
) -> list[dict[str, Any]]:
    builder = DiscoverQueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        query=query,
        selected_columns=selected_columns,
        limit=options.get("profiling.flamegraph.profile-set.size"),
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
    query: str | None = None,
) -> dict[str, list[str]]:
    data = query_profiles_data(
        params,
        Referrer.API_PROFILING_PROFILE_FLAMEGRAPH.value,
        selected_columns=["profile.id"],
        query=query,
    )
    return {"profile_ids": [row["profile.id"] for row in data]}


class StartEnd(TypedDict):
    start: str
    end: str


class ProfileIdsWithSpans(TypedDict):
    profile_ids: list[str]
    spans: list[list[StartEnd]]


def get_profile_ids_with_spans(
    organization_id: int,
    project_id: int,
    params: ParamsType,
    span_group: str,
) -> ProfileIdsWithSpans:
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
        transformed_intervals: list[StartEnd] = []
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


class ProfileIds(TypedDict):
    profile_ids: list[str]


def get_profiles_with_function(
    organization_id: int,
    project_id: int,
    function_fingerprint: int,
    params: ParamsType,
    query: str,
) -> ProfileIds:
    conditions = [query, f"fingerprint:{function_fingerprint}"]

    result = functions.query(
        selected_columns=["timestamp", "unique_examples()"],
        query=" ".join(cond for cond in conditions if cond),
        params=params,
        limit=100,
        orderby=["-timestamp"],
        referrer=Referrer.API_PROFILING_FUNCTION_SCOPED_FLAMEGRAPH.value,
        auto_aggregations=True,
        use_aggregate_conditions=True,
        transform_alias_to_input_format=True,
    )

    def extract_profile_ids() -> list[str]:
        max_profiles = options.get("profiling.flamegraph.profile-set.size")
        profile_ids = []

        for i in range(5):
            for row in result["data"]:
                examples = row["unique_examples()"]
                if i < len(examples):
                    profile_ids.append(examples[i])

                    if len(profile_ids) >= max_profiles:
                        return profile_ids

        return profile_ids

    return {"profile_ids": extract_profile_ids()}


class IntervalMetadata(TypedDict):
    start: str
    end: str
    active_thread_id: str


def get_spans_from_group(
    organization_id: int,
    project_id: int,
    params: ParamsType,
    span_group: str,
) -> dict[str, list[IntervalMetadata]]:
    query = Query(
        match=Entity(EntityKey.Spans.value),
        select=[
            Column("start_timestamp_precise"),
            Column("end_timestamp_precise"),
            Function(
                "arrayElement",
                parameters=[
                    Column("sentry_tags.value"),
                    Function(
                        "indexOf",
                        parameters=[
                            Column("sentry_tags.key"),
                            "profiler_id",
                        ],
                    ),
                ],
                alias="profiler_id",
            ),
            Function(
                "arrayElement",
                parameters=[
                    Column("sentry_tags.value"),
                    Function(
                        "indexOf",
                        parameters=[
                            Column("sentry_tags.key"),
                            "active_thread_id",
                        ],
                    ),
                ],
                alias="active_thread_id",
            ),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.GTE, params["start"]),
            Condition(Column("timestamp"), Op.LT, params["end"]),
            Condition(Column("group"), Op.EQ, span_group),
            Condition(Column("profiler_id"), Op.NEQ, ""),
        ],
        limit=Limit(100),
    )
    request = Request(
        dataset=Dataset.SpansIndexed.value,
        app_id="default",
        query=query,
        tenant_ids={
            "referrer": Referrer.API_PROFILING_PROFILE_FLAMEGRAPH.value,
            "organization_id": organization_id,
        },
    )
    data = raw_snql_query(
        request,
        referrer=Referrer.API_PROFILING_PROFILE_FLAMEGRAPH.value,
    )["data"]
    spans: dict[str, list[IntervalMetadata]] = {}
    for row in data:
        if row["profiler_id"] in spans:
            spans[row["profiler_id"]].append(
                {
                    "active_thread_id": row["group"],
                    "start": row["start_timestamp_precise"],
                    "end": row["end_timestamp_precise"],
                }
            )
        else:
            spans[row["profiler_id"]] = [
                {
                    "active_thread_id": row["group"],
                    "start": row["start_timestamp_precise"],
                    "end": row["end_timestamp_precise"],
                }
            ]
    return spans


class SpanMetadata(TypedDict):
    profiler_id: list[IntervalMetadata]


def get_chunk_snuba_conditions_from_spans_metadata(
    spans: dict[str, list[IntervalMetadata]],
) -> list[BooleanCondition | Condition]:
    cond = []
    for profiler_id, intervals in spans.items():
        chunk_range_cond = []
        for interval in intervals:
            start = interval.get("start")
            end = interval.get("end")
            chunk_range_cond.append(
                And(
                    [
                        Condition(Column("end_timestamp"), Op.GTE, start),
                        Condition(Column("start_timestamp"), Op.LT, end),
                    ],
                )
            )
        cond.append(
            And(
                [
                    Condition(Column("profiler_id"), Op.EQ, profiler_id),
                    Or(chunk_range_cond) if len(chunk_range_cond) >= 2 else chunk_range_cond[0],
                ]
            )
        )
    return [Or(cond)] if len(cond) >= 2 else cond


def get_chunks_from_spans_metadata(
    organization_id: int,
    project_id: int,
    spans: dict[str, list[IntervalMetadata]],
) -> list[dict[str, Any]]:
    query = Query(
        match=Storage(StorageKey.ProfileChunks.value),
        select=[
            Column("profiler_id"),
            Column("chunk_id"),
        ],
        where=[Condition(Column("project_id"), Op.EQ, project_id)]
        + get_chunk_snuba_conditions_from_spans_metadata(spans),
        limit=Limit(100),
    )
    request = Request(
        dataset=Dataset.Profiles.value,
        app_id="default",
        query=query,
        tenant_ids={
            "referrer": Referrer.API_PROFILING_PROFILE_FLAMEGRAPH.value,
            "organization_id": organization_id,
        },
    )
    data = raw_snql_query(
        request,
        referrer=Referrer.API_PROFILING_PROFILE_FLAMEGRAPH.value,
    )["data"]
    chunks = []
    for row in data:
        intervals = [
            {
                "start": int(datetime.fromisoformat(el["start"]).timestamp() * 10**9),
                "end": int(datetime.fromisoformat(el["end"]).timestamp() * 10**9),
                "active_thread_id": el["active_thread_id"],
            }
            for el in spans[row["profiler_id"]]
        ]
        chunks.append(
            {
                "profiler_id": row["profiler_id"],
                "chunk_id": row["chunk_id"],
                "span_intervals": intervals,
            }
        )
    return chunks
