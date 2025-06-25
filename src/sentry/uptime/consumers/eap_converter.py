"""
Converts uptime results to EAP TraceItem format.

This module handles the conversion of uptime check results into denormalized
TraceItem format for the Events Analytics Platform (EAP). Each TraceItem
represents one HTTP request with check-level metadata duplicated across
all requests in a redirect chain.
"""

import logging
from collections.abc import MutableMapping

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CheckResult,
    RequestDurations,
    RequestInfo,
)
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, TraceItem

from sentry import quotas
from sentry.models.project import Project

logger = logging.getLogger(__name__)


def _anyvalue(value: bool | str | int | float) -> AnyValue:
    if isinstance(value, bool):
        return AnyValue(bool_value=value)
    elif isinstance(value, str):
        return AnyValue(string_value=value)
    elif isinstance(value, int):
        return AnyValue(int_value=value)
    elif isinstance(value, float):
        return AnyValue(double_value=value)
    else:
        raise ValueError(f"Invalid value type for AnyValue: {type(value)}")


def ms_to_us(milliseconds: float | int) -> int:
    """Convert milliseconds to microseconds."""
    return int(milliseconds * 1000)


def _timestamp(timestamp_ms: float) -> Timestamp:
    """Convert timestamp in milliseconds to protobuf Timestamp."""
    timestamp = Timestamp()
    timestamp.FromMilliseconds(int(timestamp_ms))
    return timestamp


def convert_uptime_request_to_trace_item(
    project: Project,
    result: CheckResult,
    request_info: RequestInfo | None,
    request_sequence: int,
    item_id: bytes,
) -> TraceItem:
    """
    Convert an individual request to a denormalized UptimeResult TraceItem.

    This creates a TraceItem that includes both check-level metadata, which is duplicated
    and request-specific data for unified querying.

    In the case of misses, we'll have one row and the request_info will be empty.
    """
    attributes: MutableMapping[str, AnyValue] = {}

    attributes["guid"] = _anyvalue(result["guid"])
    attributes["subscription_id"] = _anyvalue(result["subscription_id"])
    attributes["check_status"] = _anyvalue(result["status"])
    if "region" in result:
        attributes["region"] = _anyvalue(result["region"])

    attributes["scheduled_check_time_us"] = _anyvalue(ms_to_us(result["scheduled_check_time_ms"]))
    attributes["actual_check_time_us"] = _anyvalue(ms_to_us(result["actual_check_time_ms"]))

    duration_ms = result["duration_ms"]
    if duration_ms is not None:
        attributes["check_duration_us"] = _anyvalue(ms_to_us(duration_ms))

    status_reason = result["status_reason"]
    if status_reason is not None:
        attributes["status_reason_type"] = _anyvalue(status_reason["type"])
        attributes["status_reason_description"] = _anyvalue(status_reason["description"])

    if "request_info_list" in result and result["request_info_list"]:
        first_request = result["request_info_list"][0]
        attributes["method"] = _anyvalue(first_request["request_type"])
        if "url" in first_request:
            # This should always be here once we start passing url, but for backwards compat
            # we should be cautious here
            attributes["original_url"] = _anyvalue(first_request["url"])

    attributes["check_id"] = _anyvalue(result["guid"])
    attributes["request_sequence"] = _anyvalue(request_sequence)

    if request_info is not None:
        attributes["request_type"] = _anyvalue(request_info["request_type"])
        http_status_code = request_info["http_status_code"]
        if http_status_code is not None:
            attributes["http_status_code"] = _anyvalue(http_status_code)

        if "url" in request_info:
            attributes["request_url"] = _anyvalue(request_info["url"])
        if "request_body_size_bytes" in request_info:
            attributes["request_body_size_bytes"] = _anyvalue(
                request_info["request_body_size_bytes"]
            )
        if "response_body_size_bytes" in request_info:
            attributes["response_body_size_bytes"] = _anyvalue(
                request_info["response_body_size_bytes"]
            )
        if "request_duration_us" in request_info:
            attributes["request_duration_us"] = _anyvalue(request_info["request_duration_us"])

        if "durations" in request_info:
            durations = request_info["durations"]
            for phase_name in RequestDurations.__annotations__.keys():
                if phase_name in durations:
                    timing = durations[phase_name]  # type: ignore[literal-required]
                    attributes[f"{phase_name}_start_us"] = _anyvalue(timing["start_us"])
                    attributes[f"{phase_name}_duration_us"] = _anyvalue(timing["duration_us"])

    return TraceItem(
        organization_id=project.organization_id,
        project_id=project.id,
        trace_id=result["trace_id"],
        item_id=item_id,
        item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
        timestamp=_timestamp(result["scheduled_check_time_ms"]),
        attributes=attributes,
        client_sample_rate=1.0,
        server_sample_rate=1.0,
        retention_days=quotas.backend.get_event_retention(organization=project.organization) or 90,
        received=_timestamp(result["actual_check_time_ms"]),
    )


def convert_uptime_result_to_trace_items(
    project: Project,
    result: CheckResult,
) -> list[TraceItem]:
    """
    Convert a complete uptime result to a list of denormalized TraceItems.

    Returns one TraceItem per HTTP request in the redirect chain, each containing
    both check-level metadata (duplicated) and request-specific data for unified querying.
    """
    trace_items = []

    request_info_list = result.get("request_info_list", [])  # Optional field
    if not request_info_list:
        request_info = result["request_info"]
        if request_info is not None:
            request_info_list = [request_info]

    for sequence, request_info in enumerate(request_info_list):
        if sequence == 0:
            # First request uses the span_id directly
            item_id = result["span_id"].encode("utf-8")[:16].ljust(16, b"\x00")
        else:
            request_id = f"{result['span_id']}_req_{sequence}"
            item_id = request_id.encode("utf-8")[:16].ljust(16, b"\x00")

        request_item = convert_uptime_request_to_trace_item(
            project, result, request_info, sequence, item_id
        )
        trace_items.append(request_item)

    return trace_items
