import sentry_sdk
from sentry_protos.snuba.v1.downsampled_storage_pb2 import (
    DownsampledStorageConfig,
    DownsampledStorageMeta,
)
from sentry_protos.snuba.v1.request_common_pb2 import ResponseMeta

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.constants import SAMPLING_MODE_MAP
from sentry.search.events.types import SAMPLING_MODES, EventsMeta


def handle_downsample_meta(meta: DownsampledStorageMeta) -> bool:
    return not meta.can_go_to_higher_accuracy_tier


def validate_sampling(sampling_mode: SAMPLING_MODES | None) -> DownsampledStorageConfig:
    if sampling_mode is None:
        return DownsampledStorageConfig(mode=DownsampledStorageConfig.MODE_NORMAL)
    if sampling_mode not in SAMPLING_MODE_MAP:
        raise InvalidSearchQuery(f"sampling mode: {sampling_mode} is not supported")
    else:
        return DownsampledStorageConfig(mode=SAMPLING_MODE_MAP[sampling_mode])


def events_meta_from_rpc_request_meta(meta: ResponseMeta) -> EventsMeta:
    full_scan = handle_downsample_meta(meta.downsampled_storage_meta)
    bytes_scanned = (
        sum(info.stats.progress_bytes for info in meta.query_info) if meta.query_info else None
    )
    storage_meta = meta.downsampled_storage_meta
    enr = storage_meta.estimated_num_rows
    estimated_num_rows: int | None = int(enr) if enr > 0 else None

    query_rows_read: int | None = None
    if meta.query_info:
        query_rows_read = sum(int(info.stats.rows_read) for info in meta.query_info)

    # Heuristic: extrapolate total haystack bytes from row estimate × bytes per scanned row.
    # rows_read and estimated_num_rows may not align 1:1 in semantics; treat as UI hint only.
    estimated_total_bytes: int | None = None
    if (
        estimated_num_rows is not None
        and query_rows_read is not None
        and query_rows_read > 0
        and bytes_scanned is not None
        and bytes_scanned > 0
    ):
        estimated_total_bytes = int(estimated_num_rows * (bytes_scanned / float(query_rows_read)))

    span = sentry_sdk.get_current_span()
    if span:
        span.set_data("data_scanned", "full" if full_scan else "partial")
        span.set_data("bytes_scanned", bytes_scanned)

    result: EventsMeta = EventsMeta(
        fields={},
        full_scan=full_scan,
        bytes_scanned=bytes_scanned,
    )
    if estimated_total_bytes is not None:
        result["estimated_total_bytes"] = estimated_total_bytes
    return result
