from __future__ import annotations

import logging
from collections.abc import Callable
from functools import wraps
from typing import Any, Iterator, Literal

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_trace_items_pb2 import ExportTraceItemsResponse
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, TraceItem

from sentry.data_export.base import ExportError
from sentry.search.eap.constants import PROTOBUF_TYPE_TO_SEARCH_TYPE
from sentry.search.eap.types import SupportedTraceItemType
from sentry.search.eap.utils import can_expose_attribute, translate_internal_to_public_alias
from sentry.search.events.constants import TIMEOUT_ERROR_MESSAGE
from sentry.snuba import discover
from sentry.utils import metrics, snuba
from sentry.utils.sdk import capture_exception
from sentry.utils.snuba_rpc import SnubaRPCRateLimitExceeded

_SCALAR_SEARCH_TYPES: list[Literal["string", "number", "boolean"]] = [
    "string",
    "number",
    "boolean",
]


# Adapted into decorator from 'src/sentry/api/endpoints/organization_events.py'
def handle_snuba_errors(
    logger: logging.Logger,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def wrapper(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        def wrapped(*args: Any, **kwargs: Any) -> Any:
            try:
                return func(*args, **kwargs)
            except discover.InvalidSearchQuery as error:
                metrics.incr("dataexport.error", tags={"error": str(error)}, sample_rate=1.0)
                logger.warning("dataexport.error: %s", str(error))
                capture_exception(error)
                raise ExportError("Invalid query. Please fix the query and try again.")
            except snuba.QueryOutsideRetentionError as error:
                metrics.incr("dataexport.error", tags={"error": str(error)}, sample_rate=1.0)
                logger.warning("dataexport.error: %s", str(error))
                capture_exception(error)
                raise ExportError("Invalid date range. Please try a more recent date range.")
            except snuba.QueryIllegalTypeOfArgument as error:
                metrics.incr("dataexport.error", tags={"error": str(error)}, sample_rate=1.0)
                logger.warning("dataexport.error: %s", str(error))
                capture_exception(error)
                raise ExportError("Invalid query. Argument to function is wrong type.")
            except snuba.SnubaError as error:
                metrics.incr("dataexport.error", tags={"error": str(error)}, sample_rate=1.0)
                logger.warning("dataexport.error: %s", str(error))
                capture_exception(error)
                message = "Internal error. Please try again."
                recoverable = False
                delay_retry = False
                if isinstance(
                    error,
                    (
                        snuba.RateLimitExceeded,
                        snuba.QueryMemoryLimitExceeded,
                        snuba.QueryExecutionTimeMaximum,
                        snuba.QueryTooManySimultaneous,
                        SnubaRPCRateLimitExceeded,
                    ),
                ):
                    message = TIMEOUT_ERROR_MESSAGE
                    recoverable = True

                    if isinstance(
                        error,
                        (
                            snuba.RateLimitExceeded,
                            snuba.QueryTooManySimultaneous,
                            SnubaRPCRateLimitExceeded,
                        ),
                    ):
                        delay_retry = True
                elif isinstance(
                    error,
                    (
                        snuba.DatasetSelectionError,
                        snuba.QueryConnectionFailed,
                        snuba.QuerySizeExceeded,
                        snuba.QueryExecutionError,
                        snuba.SchemaValidationError,
                        snuba.UnqualifiedQueryError,
                    ),
                ):
                    message = "Internal error. Your query failed to run."
                raise ExportError(message, recoverable=recoverable, delay_retry=delay_retry)

        return wrapped

    return wrapper


def anyvalue_to_python(av: AnyValue) -> Any:
    which = av.WhichOneof("value")
    if which is None:
        return None
    val = getattr(av, which)
    if which == "array_value":
        return [anyvalue_to_python(x) for x in val.values]
    if which == "kvlist_value":
        return {kv.key: anyvalue_to_python(kv.value) for kv in val.values}
    return val


def _ts_to_epoch(ts: Timestamp) -> float:
    return ts.seconds + ts.nanos / 1e9


def _merge_trace_export_cell(out: dict[str, Any], new_key: str, value: Any) -> None:
    if new_key not in out:
        out[new_key] = value
    elif out[new_key] is None and value is not None:
        out[new_key] = value


def _export_column_name_for_trace_attribute(
    internal_key: str,
    eap_storage_type: Literal["string", "number", "boolean"],
    item_type: SupportedTraceItemType,
) -> str:
    """Map a scalar trace item attribute to its public export column name.
    Use search_type as type to filter public name for attribute.
    Usually search_type is same as eap_storage_type, so start with eap_storage_type.
    Else fallback to remaining types.
    """

    for storage_type in [eap_storage_type] + [
        t for t in _SCALAR_SEARCH_TYPES if t != eap_storage_type
    ]:
        public_alias, public_name, _ = translate_internal_to_public_alias(
            internal_key, storage_type, item_type
        )
        if public_alias is not None and public_name is not None:
            return public_name
    return internal_key


def trace_item_to_row(
    item: TraceItem,
    *,
    item_type: SupportedTraceItemType,
) -> dict[str, Any]:
    row: dict[str, Any] = {}
    _merge_trace_export_cell(row, "organization.id", item.organization_id)
    _merge_trace_export_cell(row, "project.id", item.project_id)
    _merge_trace_export_cell(row, "trace", item.trace_id)
    _merge_trace_export_cell(row, "id", item.item_id.hex() if item.item_id else None)

    for internal_key, av in item.attributes.items():
        if not can_expose_attribute(internal_key, item_type, include_internal=False):
            continue
        which = av.WhichOneof("value")
        value = anyvalue_to_python(av)
        if which is None:
            eap_storage_type = None
        else:
            eap_storage_type = PROTOBUF_TYPE_TO_SEARCH_TYPE.get(which)
        if eap_storage_type is None:
            new_key = internal_key
        else:
            new_key = _export_column_name_for_trace_attribute(
                internal_key, eap_storage_type, item_type
            )
        _merge_trace_export_cell(row, new_key, value)

    if item.HasField("timestamp"):
        row["timestamp"] = _ts_to_epoch(item.timestamp)
    if item.HasField("received"):
        row["received"] = _ts_to_epoch(item.received)
    row["client_sample_rate"] = item.client_sample_rate
    row["server_sample_rate"] = item.server_sample_rate
    row["retention_days"] = item.retention_days
    row["downsampled_retention_days"] = item.downsampled_retention_days
    return row


def iter_export_trace_items_rows(
    resp: ExportTraceItemsResponse,
    item_type: SupportedTraceItemType,
) -> Iterator[dict[str, Any]]:
    for item in resp.trace_items:
        yield trace_item_to_row(item, item_type=item_type)
