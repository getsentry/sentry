import logging
import re
from collections.abc import Iterable, Mapping, Sequence
from concurrent.futures import Future
from datetime import UTC, datetime
from typing import Annotated, NotRequired, TypedDict

from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType as ProtoTraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    ExtrapolationMode,
    Function,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ExistsFilter, TraceItemFilter

from sentry import options
from sentry.api.endpoints.organization_trace_item_attributes import (
    StoredRef,
    get_column_definitions,
)
from sentry.api.endpoints.organization_trace_item_attributes_merged import MAX_QUERY_WORKERS
from sentry.apidocs.descriptions import ApiDescription
from sentry.search.eap import constants
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.rpc_utils import anyvalue_to_python, or_trace_item_filters
from sentry.search.eap.types import ColumnType, SearchResolverConfig, SupportedTraceItemType
from sentry.search.events.types import SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import RPCBase, TableQuery, cap_end_timestamp_at_now
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.utils import metrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.snuba_rpc import attribute_names_rpc, table_rpc

logger = logging.getLogger(__name__)

DATASET_CLASSES: dict[str, type[RPCBase]] = {
    SupportedTraceItemType.SPANS.value: Spans,
    SupportedTraceItemType.LOGS.value: OurLogs,
    SupportedTraceItemType.TRACEMETRICS.value: TraceMetrics,
}

CARDINALITY_ATTRIBUTE_TYPES: frozenset[ColumnType] = frozenset({"string", "number"})


class TraceItemAttributeDatasetStats(TypedDict):
    lastSeen: Annotated[
        str | None,
        ApiDescription("When the attribute was last seen in the dataset within the time window"),
    ]
    cardinality: Annotated[
        int | None,
        ApiDescription("Approximate number of distinct values the attribute had in the window"),
    ]
    modifiedCount: NotRequired[
        Annotated[
            int | None,
            ApiDescription(
                "Number of stored spans in the window where Relay modified the attribute's "
                "value, e.g. by truncating or scrubbing it. Only present for spans. Relay's "
                "metadata is keyed by name alone, so attributes of different types that share "
                "a name share this count"
            ),
        ]
    ]


def _resolver(
    dataset: str, snuba_params: SnubaParams, config: SearchResolverConfig | None = None
) -> SearchResolver:
    return SearchResolver(
        params=snuba_params,
        config=config or SearchResolverConfig(),
        definitions=get_column_definitions(SupportedTraceItemType(dataset)),
    )


def _exists_filter(keys: Iterable[AttributeKey]) -> TraceItemFilter | None:
    return or_trace_item_filters(
        *(TraceItemFilter(exists_filter=ExistsFilter(key=key)) for key in keys)
    )


def _escape_like(name: str) -> str:
    return re.sub(r"([\\%_])", r"\\\1", name)


def _query_last_seen_from_table(
    dataset: str, refs: Sequence[StoredRef], resolver: SearchResolver
) -> datetime | None:
    name = f"{dataset}:last_seen"
    result = DATASET_CLASSES[dataset].run_bulk_table_queries(
        [
            TableQuery(
                query_string="",
                selected_columns=["timestamp"],
                orderby=["-timestamp"],
                offset=0,
                limit=1,
                referrer=Referrer.API_TRACE_ITEM_ATTRIBUTE_LAST_SEEN_FALLBACK.value,
                name=name,
                extra_conditions=_exists_filter(
                    AttributeKey(name=ref.name, type=ref.proto_type) for ref in refs
                ),
                sampling_mode="HIGHEST_ACCURACY",
                resolver=resolver,
            )
        ]
    )
    rows = result[name]["data"]
    if not rows:
        return None
    return datetime.fromisoformat(rows[0]["timestamp"]).astimezone(UTC).replace(microsecond=0)


def query_last_seen(
    dataset: str, refs: Sequence[StoredRef], snuba_params: SnubaParams
) -> datetime | None:
    resolver = _resolver(dataset, snuba_params)
    meta = resolver.resolve_meta(referrer=Referrer.API_TRACE_ITEM_ATTRIBUTE_LAST_SEEN.value)
    meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
        SupportedTraceItemType(dataset), ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
    )
    window_start = meta.start_timestamp.ToDatetime(tzinfo=UTC)

    limit = options.get("explore.trace-items.keys.max")
    # The names RPC has no environment filter, but the details page sends no environment.
    last_seen: datetime | None = None
    for ref in refs:
        try:
            response = attribute_names_rpc(
                TraceItemAttributeNamesRequest(
                    meta=meta,
                    limit=limit,
                    type=ref.proto_type,
                    value_substring_match=_escape_like(ref.name),
                    order_by=TraceItemAttributeNamesRequest.OrderBy(
                        column=TraceItemAttributeNamesRequest.OrderBy.COLUMN_LAST_SEEN,
                        descending=True,
                    ),
                )
            )
        except Exception:
            logger.exception(
                "trace_item_attribute_stats.names_rpc_failed", extra={"dataset": dataset}
            )
            return _query_last_seen_from_table(dataset, refs, resolver)

        rows = [attribute for attribute in response.attributes if attribute.name == ref.name]
        if not rows:
            if len(response.attributes) >= limit:
                return _query_last_seen_from_table(dataset, refs, resolver)
            continue
        # Snuba answers windows before 2026-07-27 from its v1 table, which has no last_seen.
        if not all(row.HasField("last_seen") for row in rows):
            return _query_last_seen_from_table(dataset, refs, resolver)
        for row in rows:
            row_last_seen = row.last_seen.ToDatetime(tzinfo=UTC).replace(microsecond=0)
            if last_seen is None or row_last_seen > last_seen:
                last_seen = row_last_seen

    # The rollup buckets dates by week (toMonday), so it can predate the window.
    if last_seen is None or last_seen < window_start:
        return None
    return last_seen


def query_cardinality(dataset: str, ref: StoredRef, snuba_params: SnubaParams) -> int | None:
    resolver = _resolver(dataset, snuba_params)
    meta = resolver.resolve_meta(
        referrer=Referrer.API_TRACE_ITEM_ATTRIBUTE_CARDINALITY.value,
        sampling_mode="HIGHEST_ACCURACY",
    )
    cap_end_timestamp_at_now(meta)
    response = table_rpc(
        [
            TraceItemTableRequest(
                meta=meta,
                filter=resolver.resolve_query("")[0],
                columns=[
                    Column(
                        label="cardinality",
                        aggregation=AttributeAggregation(
                            aggregate=Function.FUNCTION_UNIQ,
                            key=AttributeKey(name=ref.name, type=ref.proto_type),
                            label="cardinality",
                            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
                        ),
                    )
                ],
                limit=1,
            )
        ]
    )[0]
    for column in response.column_values:
        for result in column.results:
            if not result.is_null:
                return int(anyvalue_to_python(result))
    return None


def query_modified_count(refs: Sequence[StoredRef], snuba_params: SnubaParams) -> int | None:
    name = "spans:modified"
    result = Spans.run_bulk_table_queries(
        [
            TableQuery(
                query_string="",
                selected_columns=["count()"],
                orderby=None,
                offset=0,
                limit=1,
                referrer=Referrer.API_TRACE_ITEM_ATTRIBUTE_MODIFIED_COUNT.value,
                name=name,
                # Meta is stored as a string under the stored name, whatever the attribute's type.
                extra_conditions=_exists_filter(
                    AttributeKey(
                        name=f"{constants.META_ATTRIBUTE_PREFIX}.{ref.name}",
                        type=AttributeKey.Type.TYPE_STRING,
                    )
                    for ref in refs
                ),
                sampling_mode="HIGHEST_ACCURACY",
                resolver=_resolver(
                    SupportedTraceItemType.SPANS.value,
                    snuba_params,
                    SearchResolverConfig(disable_aggregate_extrapolation=True),
                ),
            )
        ]
    )
    rows = result[name]["data"]
    if not rows or rows[0]["count()"] is None:
        return None
    return int(rows[0]["count()"])


def _result_or_none[T](future: Future[T], dataset: str, stat: str) -> T | None:
    try:
        return future.result()
    except Exception:
        logger.exception(
            "trace_item_attribute_stats.failed", extra={"dataset": dataset, "stat": stat}
        )
        metrics.incr("trace_item_attribute_stats.failed", tags={"dataset": dataset, "stat": stat})
        return None


def query_attribute_stats(
    attribute_type: ColumnType,
    refs_by_dataset: Mapping[str, Sequence[StoredRef]],
    snuba_params: SnubaParams,
) -> tuple[dict[str, TraceItemAttributeDatasetStats], datetime | None]:
    queryable = {
        dataset: refs
        for dataset, refs in refs_by_dataset.items()
        if refs and not any(ref.is_proxy for ref in refs)
    }
    cardinality_refs = {
        dataset: refs[0]
        for dataset, refs in queryable.items()
        if attribute_type in CARDINALITY_ATTRIBUTE_TYPES and len(refs) == 1
    }

    spans_refs = queryable.get(SupportedTraceItemType.SPANS.value)

    stats: dict[str, TraceItemAttributeDatasetStats] = {
        dataset: {"lastSeen": None, "cardinality": None} for dataset in refs_by_dataset
    }
    if SupportedTraceItemType.SPANS.value in stats:
        stats[SupportedTraceItemType.SPANS.value]["modifiedCount"] = None
    last_seen: datetime | None = None
    with ContextPropagatingThreadPoolExecutor(
        thread_name_prefix=__name__,
        max_workers=max(
            min(len(queryable) + len(cardinality_refs) + bool(spans_refs), MAX_QUERY_WORKERS), 1
        ),
    ) as pool:
        last_seen_futures = {
            dataset: pool.submit(query_last_seen, dataset, refs, snuba_params)
            for dataset, refs in queryable.items()
        }
        cardinality_futures = {
            dataset: pool.submit(query_cardinality, dataset, ref, snuba_params)
            for dataset, ref in cardinality_refs.items()
        }
        modified_count_future = (
            pool.submit(query_modified_count, spans_refs, snuba_params) if spans_refs else None
        )
        for dataset, last_seen_future in last_seen_futures.items():
            dataset_last_seen = _result_or_none(last_seen_future, dataset, "last_seen")
            if dataset_last_seen is not None:
                stats[dataset]["lastSeen"] = dataset_last_seen.isoformat()
                if last_seen is None or dataset_last_seen > last_seen:
                    last_seen = dataset_last_seen
        for dataset, cardinality_future in cardinality_futures.items():
            stats[dataset]["cardinality"] = _result_or_none(
                cardinality_future, dataset, "cardinality"
            )
        if modified_count_future is not None:
            stats[SupportedTraceItemType.SPANS.value]["modifiedCount"] = _result_or_none(
                modified_count_future, SupportedTraceItemType.SPANS.value, "modified_count"
            )
    return stats, last_seen
