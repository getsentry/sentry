from __future__ import annotations

import logging
from collections.abc import Callable
from functools import wraps
from typing import Any, Iterator

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_trace_items_pb2 import ExportTraceItemsResponse
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, TraceItem

from sentry.search.events.constants import TIMEOUT_ERROR_MESSAGE
from sentry.snuba import discover
from sentry.utils import metrics, snuba
from sentry.utils.sdk import capture_exception

from .base import ExportError


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
                if isinstance(
                    error,
                    (
                        snuba.RateLimitExceeded,
                        snuba.QueryMemoryLimitExceeded,
                        snuba.QueryExecutionTimeMaximum,
                        snuba.QueryTooManySimultaneous,
                    ),
                ):
                    message = TIMEOUT_ERROR_MESSAGE
                    recoverable = True
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
                raise ExportError(message, recoverable=recoverable)

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


def trace_item_to_row(item: TraceItem) -> dict[str, Any]:
    row: dict[str, Any] = {}
    for key, av in item.attributes.items():
        row[key] = None if av.WhichOneof("value") is None else anyvalue_to_python(av)
    row["organization_id"] = item.organization_id
    row["project_id"] = item.project_id
    row["trace_id"] = item.trace_id
    row["item_id"] = item.item_id.hex() if item.item_id else None
    row["item_type"] = TraceItemType.Name(item.item_type)
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
) -> Iterator[dict[str, Any]]:
    for item in resp.trace_items:
        yield trace_item_to_row(item)
