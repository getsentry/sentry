from datetime import datetime

from snuba_sdk import Column, Condition, Direction, Function, Op, OrderBy, Query, Request, Storage

from sentry import options
from sentry.search.events.types import ParamsType
from sentry.snuba.dataset import Dataset, StorageKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def get_chunk_ids(
    params: ParamsType,
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
                resolve_datetime64(params.get("start")),
            ),
            Condition(
                Column("start_timestamp"),
                Op.LT,
                resolve_datetime64(params.get("end")),
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
            "organization_id": params["organization_id"],
        },
    )

    result = raw_snql_query(
        request,
        referrer=Referrer.API_PROFILING_CONTINUOUS_PROFILING_FLAMECHART.value,
    )

    return [row["chunk_id"] for row in result["data"]]


def resolve_datetime64(
    raw_value: datetime | str | float | None, precision: int = 6
) -> Function | None:
    # This is normally handled by the snuba-sdk but it assumes that the underlying
    # table uses DateTime. Because we use DateTime64(6) as the underlying column,
    # we need to cast to the same type or we risk truncating the timestamp which
    # can lead to subtle errors.

    value: str | float | None = None

    if isinstance(raw_value, datetime):
        if raw_value.tzinfo is not None:
            # This is adapted from snuba-sdk
            # See https://github.com/getsentry/snuba-sdk/blob/2f7f014920b4f527a87f18c05b6aa818212bec6e/snuba_sdk/visitors.py#L168-L172
            delta = raw_value.utcoffset()
            assert delta is not None
            raw_value -= delta
            raw_value = raw_value.replace(tzinfo=None)
        value = raw_value.isoformat()
    elif isinstance(raw_value, float):
        value = raw_value

    if value is None:
        return None

    return Function("toDateTime64", [value, precision])
