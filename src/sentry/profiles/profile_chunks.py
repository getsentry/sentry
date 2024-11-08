from snuba_sdk import Column, Condition, Direction, Op, OrderBy, Query, Request, Storage

from sentry import options
from sentry.search.events.fields import resolve_datetime64
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset, StorageKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def get_chunk_ids(
    snuba_params: SnubaParams,
    profiler_id: str,
    project_id: int,
) -> list[str]:
    max_chunks = options.get("profiling.continuous-profiling.chunks-set.size")

    query = Query(
        match=Storage(StorageKey.ProfileChunks.value),
        select=[
            Column("chunk_id"),
        ],
        where=[
            Condition(
                Column("end_timestamp"),
                Op.GTE,
                resolve_datetime64(snuba_params.start),
            ),
            Condition(
                Column("start_timestamp"),
                Op.LT,
                resolve_datetime64(snuba_params.end),
            ),
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("profiler_id"), Op.EQ, profiler_id),
        ],
        # We want the generate the flamegraph using the newest data
        orderby=[OrderBy(Column("start_timestamp"), Direction.DESC)],
    ).set_limit(max_chunks)

    request = Request(
        dataset=Dataset.Profiles.value,
        app_id="default",
        query=query,
        tenant_ids={
            "referrer": Referrer.API_PROFILING_CONTINUOUS_PROFILING_FLAMECHART.value,
            "organization_id": snuba_params.organization_id,
        },
    )

    result = raw_snql_query(
        request,
        referrer=Referrer.API_PROFILING_CONTINUOUS_PROFILING_FLAMECHART.value,
    )

    return [row["chunk_id"] for row in result["data"]]
