from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, NotRequired, TypedDict

from snuba_sdk import (
    And,
    Column,
    Condition,
    Direction,
    Function,
    Limit,
    Op,
    Or,
    OrderBy,
    Query,
    Request,
    Storage,
)

from sentry import options
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.profile_functions import ProfileFunctionsQueryBuilder
from sentry.search.events.fields import resolve_datetime64
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba import spans_rpc
from sentry.snuba.dataset import Dataset, StorageKey
from sentry.snuba.referrer import Referrer
from sentry.utils.iterators import chunked
from sentry.utils.snuba import bulk_snuba_queries


class TransactionProfileCandidate(TypedDict):
    project_id: int
    profile_id: str


class ContinuousProfileCandidate(TypedDict):
    project_id: int
    profiler_id: str
    chunk_id: str
    thread_id: NotRequired[str]
    start: NotRequired[str]
    end: NotRequired[str]
    transaction_id: NotRequired[str]


class ProfileCandidates(TypedDict):
    transaction: list[TransactionProfileCandidate]
    continuous: list[ContinuousProfileCandidate]
    generate_metrics: NotRequired[bool]


@dataclass(frozen=True)
class ProfilerMeta:
    project_id: int
    profiler_id: str
    thread_id: str
    start: float
    end: float
    transaction_id: str | None = None

    def as_condition(self) -> Condition:
        return And(
            conditions=[
                Condition(Column("project_id"), Op.EQ, self.project_id),
                Condition(Column("profiler_id"), Op.EQ, self.profiler_id),
                Condition(
                    Column("end_timestamp"),
                    Op.GTE,
                    resolve_datetime64(self.start),
                ),
                Condition(
                    Column("start_timestamp"),
                    Op.LT,
                    resolve_datetime64(self.end),
                ),
            ]
        )


class FlamegraphExecutor:
    def __init__(
        self,
        *,
        snuba_params: SnubaParams,
        data_source: Literal["functions", "transactions", "profiles", "spans"],
        query: str,
        fingerprint: int | None = None,
    ):
        self.snuba_params = snuba_params
        self.data_source = data_source
        self.query = query
        self.fingerprint = fingerprint

    def get_profile_candidates(self) -> ProfileCandidates:
        if self.data_source == "functions":
            return self.get_profile_candidates_from_functions()
        elif self.data_source == "transactions":
            return self.get_profile_candidates_from_transactions()
        elif self.data_source == "profiles":
            return self.get_profile_candidates_from_profiles()
        elif self.data_source == "spans":
            return self.get_profile_candidates_from_spans()

        raise NotImplementedError

    def get_profile_candidates_from_functions(self) -> ProfileCandidates:
        max_profiles = options.get("profiling.flamegraph.profile-set.size")

        builder = ProfileFunctionsQueryBuilder(
            dataset=Dataset.Functions,
            params={},
            snuba_params=self.snuba_params,
            selected_columns=["project.id", "timestamp", "all_examples()"],
            query=self.query,
            limit=max_profiles,
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        if self.fingerprint is not None:
            builder.add_conditions(
                [Condition(builder.resolve_column("fingerprint"), Op.EQ, self.fingerprint)]
            )

        results = builder.run_query(Referrer.API_PROFILING_FUNCTION_SCOPED_FLAMEGRAPH.value)
        results = builder.process_results(results)

        transaction_profile_candidates: list[TransactionProfileCandidate] = []
        profiler_metas: list[ProfilerMeta] = []

        for row in results["data"]:
            project = row["project.id"]
            for example in row["all_examples()"]:
                if len(transaction_profile_candidates) > max_profiles:
                    break

                if "profile_id" in example:
                    transaction_profile_candidates.append(
                        {
                            "project_id": project,
                            "profile_id": example["profile_id"],
                        }
                    )
                elif "profiler_id" in example:
                    profiler_metas.append(
                        ProfilerMeta(
                            project_id=project,
                            profiler_id=example["profiler_id"],
                            thread_id=example["thread_id"],
                            start=example["start"],
                            end=example["end"],
                        )
                    )
            else:
                # Will go to break if the inner loop breaks
                continue
            break

        max_continuous_profile_candidates = max(
            max_profiles - len(transaction_profile_candidates), 0
        )

        return {
            "transaction": transaction_profile_candidates,
            "continuous": self.get_chunks_for_profilers(
                profiler_metas,
                max_continuous_profile_candidates,
            ),
        }

    def get_profile_candidates_from_transactions(self) -> ProfileCandidates:
        max_profiles = options.get("profiling.flamegraph.profile-set.size")

        builder = self.get_transactions_based_candidate_query(query=self.query, limit=max_profiles)

        results = builder.run_query(
            Referrer.API_PROFILING_PROFILE_FLAMEGRAPH_TRANSACTION_CANDIDATES.value,
        )
        results = builder.process_results(results)

        transaction_profile_candidates: list[TransactionProfileCandidate] = [
            {
                "project_id": row["project.id"],
                "profile_id": row["profile.id"],
            }
            for row in results["data"]
            if row["profile.id"] is not None
        ]

        max_continuous_profile_candidates = max(
            max_profiles - len(transaction_profile_candidates), 0
        )

        return {
            "transaction": transaction_profile_candidates,
            "continuous": self.get_chunks_for_profilers(
                [
                    ProfilerMeta(
                        project_id=row["project.id"],
                        profiler_id=row["profiler.id"],
                        thread_id=row["thread.id"],
                        start=row["precise.start_ts"],
                        end=row["precise.finish_ts"],
                        transaction_id=row["id"],
                    )
                    for row in results["data"]
                    if row["profiler.id"] is not None and row["thread.id"]
                ],
                max_continuous_profile_candidates,
            ),
        }

    def get_transactions_based_candidate_query(
        self, query: str | None, limit: int
    ) -> DiscoverQueryBuilder:
        builder = DiscoverQueryBuilder(
            dataset=Dataset.Discover,
            params={},
            snuba_params=self.snuba_params,
            selected_columns=[
                "id",
                "project.id",
                "precise.start_ts",
                "precise.finish_ts",
                "profile.id",
                "profiler.id",
                "thread.id",
                "timestamp",
            ],
            query=query,
            orderby=["-timestamp"],
            limit=limit,
            config=QueryBuilderConfig(
                transform_alias_to_input_format=True,
            ),
        )

        builder.add_conditions(
            [
                Or(
                    conditions=[
                        Condition(builder.resolve_column("profile.id"), Op.IS_NOT_NULL),
                        And(
                            conditions=[
                                Condition(builder.resolve_column("profiler.id"), Op.IS_NOT_NULL),
                                Condition(
                                    Function("has", [Column("contexts.key"), "trace.thread_id"]),
                                    Op.EQ,
                                    1,
                                ),
                            ],
                        ),
                    ],
                ),
            ],
        )

        return builder

    def get_chunks_for_profilers(
        self, profiler_metas: list[ProfilerMeta], limit: int
    ) -> list[ContinuousProfileCandidate]:
        if len(profiler_metas) == 0:
            return []

        chunk_size = options.get("profiling.continuous-profiling.chunks-query.size")
        queries = [
            self._create_chunks_query(chunk) for chunk in chunked(profiler_metas, chunk_size)
        ]

        results = self._query_chunks_for_profilers(queries)

        profiler_metas_by_profiler = defaultdict(list)
        for profiler_meta in profiler_metas:
            key = (profiler_meta.project_id, profiler_meta.profiler_id)
            profiler_metas_by_profiler[key].append(profiler_meta)

        continuous_profile_candidates: list[ContinuousProfileCandidate] = []

        for result in results:
            for row in result["data"]:
                start = datetime.fromisoformat(row["start_timestamp"]).timestamp()
                end = datetime.fromisoformat(row["end_timestamp"]).timestamp()

                key = (row["project_id"], row["profiler_id"])
                for profiler_meta in profiler_metas_by_profiler[key]:
                    if start > profiler_meta.end or end < profiler_meta.start:
                        continue

                    if len(continuous_profile_candidates) > limit:
                        break

                    candidate: ContinuousProfileCandidate = {
                        "project_id": profiler_meta.project_id,
                        "profiler_id": profiler_meta.profiler_id,
                        "chunk_id": row["chunk_id"],
                        "thread_id": profiler_meta.thread_id,
                        "start": str(int(profiler_meta.start * 1e9)),
                        "end": str(int(profiler_meta.end * 1e9)),
                    }

                    if profiler_meta.transaction_id is not None:
                        candidate["transaction_id"] = profiler_meta.transaction_id

                    continuous_profile_candidates.append(candidate)
                else:
                    # Will go to break if the inner loop breaks
                    continue
                break
            else:
                # Will go to break if the inner loop breaks
                continue
            break

        return continuous_profile_candidates

    def _create_chunks_query(self, profiler_metas: list[ProfilerMeta]) -> Query:
        assert profiler_metas, "profiler_metas cannot be empty"

        profiler_conditions = [profiler_meta.as_condition() for profiler_meta in profiler_metas]

        if len(profiler_conditions) == 1:
            profilers_condition = profiler_conditions[0]
        else:
            profilers_condition = Or(conditions=profiler_conditions)

        project_condition = Condition(
            Column("project_id"),
            Op.IN,
            list({profiler_meta.project_id for profiler_meta in profiler_metas}),
        )
        start_condition = Condition(
            Column("start_timestamp"),
            Op.LT,
            resolve_datetime64(self.snuba_params.end),
        )
        end_condition = Condition(
            Column("end_timestamp"), Op.GTE, resolve_datetime64(self.snuba_params.start)
        )

        return Query(
            match=Storage(StorageKey.ProfileChunks.value),
            select=[
                Column("project_id"),
                Column("profiler_id"),
                Column("chunk_id"),
                Column("start_timestamp"),
                Column("end_timestamp"),
            ],
            where=[
                project_condition,
                start_condition,
                end_condition,
                profilers_condition,
            ],
            # Order by here follows that of the underlying table
            # as a performance optimization
            orderby=[
                OrderBy(Column("project_id"), Direction.DESC),
                OrderBy(Column("profiler_id"), Direction.DESC),
                OrderBy(Column("start_timestamp"), Direction.DESC),
            ],
            limit=Limit(options.get("profiling.continuous-profiling.chunks-set.size")),
        )

    def _query_chunks_for_profilers(self, queries: list[Query]) -> list[Mapping[str, Any]]:
        """This function is split out for mocking as we cannot write to the
        profile chunks dataset in tests today"""

        if self.snuba_params.organization is None:
            raise ValueError("`organization` is required and cannot be `None`")

        referrer = Referrer.API_PROFILING_PROFILE_FLAMEGRAPH_CHUNK_CANDIDATES.value

        requests = [
            Request(
                dataset=Dataset.Profiles.value,
                app_id="default",
                query=query,
                tenant_ids={
                    "referrer": referrer,
                    "organization_id": self.snuba_params.organization.id,
                },
            )
            for query in queries
        ]

        return bulk_snuba_queries(requests, referrer=referrer)

    def get_profile_candidates_from_profiles(self) -> ProfileCandidates:
        if self.snuba_params.organization is None:
            raise ValueError("`organization` is required and cannot be `None`")

        max_profiles = options.get("profiling.flamegraph.profile-set.size")

        referrer = Referrer.API_PROFILING_PROFILE_FLAMEGRAPH_PROFILE_CANDIDATES.value

        transaction_profiles_builder = self.get_transactions_based_candidate_query(
            query=None, limit=max_profiles
        )

        project_condition = Condition(
            Column("project_id"),
            Op.IN,
            self.snuba_params.project_ids,
        )
        start_condition = Condition(
            Column("start_timestamp"),
            Op.LT,
            resolve_datetime64(self.snuba_params.end),
        )
        end_condition = Condition(
            Column("end_timestamp"), Op.GTE, resolve_datetime64(self.snuba_params.start)
        )

        continuous_profiles_query = Query(
            match=Storage(StorageKey.ProfileChunks.value),
            select=[
                Column("project_id"),
                Column("profiler_id"),
                Column("chunk_id"),
                Column("start_timestamp"),
                Column("end_timestamp"),
            ],
            where=[
                project_condition,
                start_condition,
                end_condition,
            ],
            orderby=[OrderBy(Column("start_timestamp"), Direction.DESC)],
            limit=Limit(max_profiles),
        )

        all_results = bulk_snuba_queries(
            [
                transaction_profiles_builder.get_snql_query(),
                Request(
                    dataset=Dataset.Profiles.value,
                    app_id="default",
                    query=continuous_profiles_query,
                    tenant_ids={
                        "referrer": referrer,
                        "organization_id": self.snuba_params.organization.id,
                    },
                ),
            ],
            referrer,
        )

        transaction_profile_results = transaction_profiles_builder.process_results(all_results[0])
        continuous_profile_results = all_results[1]

        transaction_profile_candidates: list[TransactionProfileCandidate] = [
            {
                "project_id": row["project.id"],
                "profile_id": row["profile.id"],
            }
            for row in transaction_profile_results["data"]
            if row["profile.id"] is not None
        ]

        max_continuous_profile_candidates = max(
            max_profiles - len(transaction_profile_candidates), 0
        )

        profiler_metas = [
            ProfilerMeta(
                project_id=row["project.id"],
                profiler_id=row["profiler.id"],
                thread_id=row["thread.id"],
                start=row["precise.start_ts"],
                end=row["precise.finish_ts"],
                transaction_id=row["id"],
            )
            for row in transaction_profile_results["data"]
            if row["profiler.id"] is not None and row["thread.id"]
        ]

        continuous_profile_candidates: list[ContinuousProfileCandidate] = []

        # If there are continuous profiles attached to transactions, we prefer those as
        # the active thread id gives us more user friendly flamegraphs than without.
        if profiler_metas:
            continuous_profile_candidates = self.get_chunks_for_profilers(
                profiler_metas, max_continuous_profile_candidates
            )

        # If we still don't have any continuous profile candidates, we'll fall back to
        # directly using the continuous profiling data
        if not continuous_profile_candidates:
            continuous_profile_candidates = [
                {
                    "project_id": row["project_id"],
                    "profiler_id": row["profiler_id"],
                    "chunk_id": row["chunk_id"],
                    "start": str(
                        int(datetime.fromisoformat(row["start_timestamp"]).timestamp() * 1e9)
                    ),
                    "end": str(int(datetime.fromisoformat(row["end_timestamp"]).timestamp() * 1e9)),
                }
                for row in continuous_profile_results["data"][:max_continuous_profile_candidates]
            ]

        return {
            "transaction": transaction_profile_candidates,
            "continuous": continuous_profile_candidates,
        }

    def get_profile_candidates_from_spans(self) -> ProfileCandidates:
        max_profiles = options.get("profiling.flamegraph.profile-set.size")
        results = self.get_spans_based_candidates(query=self.query, limit=max_profiles)
        transaction_profile_candidates: list[TransactionProfileCandidate] = [
            {
                "project_id": row["project.id"],
                "profile_id": row["profile.id"],
            }
            for row in results["data"]
            if row["profile.id"] is not None and row["profile.id"] != ""
        ]

        max_continuous_profile_candidates = max(
            max_profiles - len(transaction_profile_candidates), 0
        )
        return {
            "transaction": transaction_profile_candidates,
            "continuous": self.get_chunks_for_profilers(
                [
                    ProfilerMeta(
                        project_id=row["project.id"],
                        profiler_id=row["profiler.id"],
                        thread_id=row["thread.id"],
                        start=row["precise.start_ts"],
                        end=row["precise.finish_ts"],
                    )
                    for row in results["data"]
                    if row["profiler.id"] is not None and row["thread.id"]
                ],
                max_continuous_profile_candidates,
            ),
        }

    def get_spans_based_candidates(self, query: str | None, limit: int) -> EAPResponse:
        # add constraints in order to fetch only spans with profiles
        profiling_constraint = "(has:profile.id) or (has:profiler.id has:thread.id)"
        if query is not None and len(query) > 0:
            query = f"{query} and {profiling_constraint}"
        else:
            query = profiling_constraint
        return spans_rpc.run_table_query(
            self.snuba_params,
            query,
            selected_columns=[
                "id",
                "project.id",
                "precise.start_ts",
                "precise.finish_ts",
                "profile.id",
                "profiler.id",
                "thread.id",
                "timestamp",
            ],
            orderby=["-timestamp"],
            offset=0,
            limit=limit,
            referrer=Referrer.API_TRACE_EXPLORER_TRACE_SPANS_CANDIDATES_FLAMEGRAPH.value,
            config=SearchResolverConfig(
                auto_fields=True,
            ),
        )
