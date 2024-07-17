from collections import defaultdict
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
from sentry.search.events.builder.profile_functions import ProfileFunctionsQueryBuilder
from sentry.search.events.types import ParamsType, SnubaParams
from sentry.snuba import functions
from sentry.snuba.dataset import Dataset, EntityKey, StorageKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


class StartEnd(TypedDict):
    start: str
    end: str


class ProfileIds(TypedDict):
    profile_ids: list[str]


def get_profile_ids(
    params: ParamsType,
    query: str | None = None,
) -> ProfileIds:
    builder = DiscoverQueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        query=query,
        selected_columns=["profile.id"],
        limit=options.get("profiling.flamegraph.profile-set.size"),
    )

    builder.add_conditions(
        [
            Condition(Column("type"), Op.EQ, "transaction"),
            Condition(Column("profile_id"), Op.IS_NOT_NULL),
        ]
    )

    result = builder.run_query(Referrer.API_PROFILING_PROFILE_FLAMEGRAPH.value)

    return {"profile_ids": [row["profile.id"] for row in result["data"]]}


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
                            "thread.id",
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
            "referrer": Referrer.API_PROFILING_FLAMEGRAPH_SPANS_WITH_GROUP.value,
            "organization_id": organization_id,
        },
    )
    data = raw_snql_query(
        request,
        referrer=Referrer.API_PROFILING_FLAMEGRAPH_SPANS_WITH_GROUP.value,
    )["data"]
    spans: dict[str, list[IntervalMetadata]] = defaultdict(list)
    for row in data:
        spans[row["profiler_id"]].append(
            {
                "active_thread_id": row["active_thread_id"],
                "start": row["start_timestamp_precise"],
                "end": row["end_timestamp_precise"],
            }
        )

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
            "referrer": Referrer.API_PROFILING_FLAMEGRAPH_CHUNKS_FROM_SPANS.value,
            "organization_id": organization_id,
        },
    )
    data = raw_snql_query(
        request,
        referrer=Referrer.API_PROFILING_FLAMEGRAPH_CHUNKS_FROM_SPANS.value,
    )["data"]
    chunks = []
    for row in data:
        intervals = [
            {
                "start": str(int(datetime.fromisoformat(el["start"]).timestamp() * 10**9)),
                "end": str(int(datetime.fromisoformat(el["end"]).timestamp() * 10**9)),
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


class TransactionProfileCandidate(TypedDict):
    project_id: int
    profile_id: str


class ContinuousProfileCandidate(TypedDict):
    project_id: int
    profiler_id: str


ProfileCandidate = TransactionProfileCandidate | ContinuousProfileCandidate


class FlamegraphExecutor:
    def __init__(
        self,
        *,
        snuba_params: SnubaParams,
        dataset: Dataset,
        query: str,
        fingerprint: int | None = None,
    ):
        self.snuba_params = snuba_params
        self.dataset = dataset
        self.query = query
        self.fingerprint = fingerprint

    def get_profile_candidates(self) -> list[ProfileCandidate]:
        if self.dataset == Dataset.Functions:
            return self.get_profile_candidates_from_functions()
        elif self.dataset == Dataset.Discover:
            return self.get_profile_candidates_from_transactions()

        raise NotImplementedError

    def get_profile_candidates_from_functions(self) -> list[ProfileCandidate]:
        # TODO: continuous profiles support
        max_profiles = options.get("profiling.flamegraph.profile-set.size")

        profile_candidates: list[ProfileCandidate] = []

        builder = ProfileFunctionsQueryBuilder(
            dataset=Dataset.Functions,
            params={},
            snuba_params=self.snuba_params,
            selected_columns=["project.id", "timestamp", "unique_examples()"],
            query=self.query,
            limit=max_profiles,
        )

        if self.fingerprint is not None:
            builder.add_conditions(
                [Condition(builder.resolve_column("fingerprint"), Op.EQ, self.fingerprint)]
            )

        result = builder.run_query(Referrer.API_PROFILING_FUNCTION_SCOPED_FLAMEGRAPH.value)

        for row in result["data"]:
            project = row["project.id"]
            examples = row["unique_examples()"]
            for example in examples:
                if len(profile_candidates) > max_profiles:
                    break
                profile_candidates.append(
                    {
                        "project_id": project,
                        "profile_id": example,
                    }
                )

        return profile_candidates

    def get_profile_candidates_from_transactions(self) -> list[ProfileCandidate]:
        # TODO: continuous profiles support
        max_profiles = options.get("profiling.flamegraph.profile-set.size")

        profile_candidates: list[ProfileCandidate] = []

        builder = DiscoverQueryBuilder(
            dataset=Dataset.Discover,
            params={},
            snuba_params=self.snuba_params,
            selected_columns=["project.id", "profile.id"],
            query=self.query,
            limit=max_profiles,
        )

        builder.add_conditions([Condition(Column("profile_id"), Op.IS_NOT_NULL)])

        result = builder.run_query(Referrer.API_PROFILING_PROFILE_FLAMEGRAPH.value)

        for row in result["data"]:
            project = row["project.id"]

            profile_candidates.append(
                {
                    "project_id": project,
                    "profile_id": row["profile.id"],
                }
            )

        return profile_candidates
