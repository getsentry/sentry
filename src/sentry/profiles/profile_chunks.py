from snuba_sdk import Column, Condition, Direction, Op, OrderBy, Query, Request, Storage

from sentry.search.events.types import ParamsType
from sentry.snuba.dataset import Dataset, StorageKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def get_chunk_ids(
    params: ParamsType,
    profiler_id: str,
    project_id: int,
) -> list[dict[str, str]]:
    query = Query(
        match=Storage(StorageKey.ProfileChunks.value),
        select=[
            Column("chunk_id"),
        ],
        where=[
            Condition(Column("start_timestamp"), Op.GTE, params.get("start")),
            Condition(Column("end_timestamp"), Op.LT, params.get("end")),
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("profiler_id"), Op.EQ, profiler_id),
        ],
        orderby=[OrderBy(Column("start_timestamp"), Direction.DESC)],
    ).set_limit(50)
    request = Request(
        dataset=Dataset.Profiles.value,
        app_id="default",
        query=query,
        tenant_ids={
            "referrer": Referrer.API_PROFILING_PROFILE_SUMMARY_TABLE.value,
            "organization_id": 8,
        },
    )
    return raw_snql_query(
        request,
        referrer=Referrer.API_PROFILING_PROFILE_SUMMARY_TABLE.value,
    )["data"]
