"""
Converts uptime results to EAP TraceItem format.

This module handles the conversion of uptime check results into denormalized
TraceItem format for the Events Analytics Platform (EAP). Each TraceItem
represents one HTTP request with check-level metadata duplicated across
all requests in a redirect chain.
"""

import logging
import uuid
from collections.abc import MutableMapping, Sequence

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
from sentry.uptime.types import IncidentStatus
from sentry.utils.eap import encode_value

logger = logging.getLogger(__name__)

UPTIME_NAMESPACE = uuid.UUID("f8d7a4e2-5b3c-4a9d-8e1f-3c2b1a0d9f8e")


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
    incident_status: IncidentStatus,
) -> TraceItem:
    """
    Convert an individual request to a denormalized UptimeResult TraceItem.

    This creates a TraceItem that includes both check-level metadata, which is duplicated
    and request-specific data for unified querying.

    In the case of misses, we'll have one row and the request_info will be empty.
    """
    attributes: MutableMapping[str, AnyValue] = {}

    attributes["guid"] = encode_value(result["guid"])
    attributes["subscription_id"] = encode_value(result["subscription_id"])
    attributes["check_status"] = encode_value(result["status"])
    if "region" in result:
        attributes["region"] = encode_value(result["region"])

    attributes["scheduled_check_time_us"] = encode_value(
        ms_to_us(result["scheduled_check_time_ms"])
    )
    attributes["actual_check_time_us"] = encode_value(ms_to_us(result["actual_check_time_ms"]))

    duration_ms = result["duration_ms"]
    if duration_ms is not None:
        attributes["check_duration_us"] = encode_value(ms_to_us(duration_ms))

    status_reason = result["status_reason"]
    if status_reason is not None:
        attributes["status_reason_type"] = encode_value(status_reason["type"])
        attributes["status_reason_description"] = encode_value(status_reason["description"])

    if "request_info_list" in result and result["request_info_list"]:
        first_request = result["request_info_list"][0]
        attributes["method"] = encode_value(first_request["request_type"])
        if "url" in first_request:
            # This should always be here once we start passing url, but for backwards compat
            # we should be cautious here
            attributes["original_url"] = encode_value(first_request["url"])

    attributes["check_id"] = encode_value(result["guid"])
    attributes["request_sequence"] = encode_value(request_sequence)
    attributes["incident_status"] = encode_value(incident_status.value)
    attributes["span_id"] = encode_value(result["span_id"])

    if request_info is not None:
        attributes["request_type"] = encode_value(request_info["request_type"])
        http_status_code = request_info["http_status_code"]
        if http_status_code is not None:
            attributes["http_status_code"] = encode_value(http_status_code)

        if "url" in request_info:
            attributes["request_url"] = encode_value(request_info["url"])
        if "request_body_size_bytes" in request_info:
            attributes["request_body_size_bytes"] = encode_value(
                request_info["request_body_size_bytes"]
            )
        if "response_body_size_bytes" in request_info:
            attributes["response_body_size_bytes"] = encode_value(
                request_info["response_body_size_bytes"]
            )
        if "request_duration_us" in request_info:
            attributes["request_duration_us"] = encode_value(request_info["request_duration_us"])

        if "durations" in request_info:
            durations = request_info["durations"]
            for phase_name in RequestDurations.__annotations__.keys():
                if phase_name in durations:
                    timing = durations[phase_name]  # type: ignore[literal-required]
                    attributes[f"{phase_name}_start_us"] = encode_value(timing["start_us"])
                    attributes[f"{phase_name}_duration_us"] = encode_value(timing["duration_us"])

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
    incident_status: IncidentStatus,
) -> list[TraceItem]:
    """
    Convert a complete uptime result to a list of denormalized TraceItems.

    Returns one TraceItem per HTTP request in the redirect chain, each containing
    both check-level metadata (duplicated) and request-specific data for unified querying.
    """
    trace_items = []

    request_info_list: Sequence[RequestInfo | None] = result.get("request_info_list", [])
    if not request_info_list:
        request_info = result["request_info"]
        request_info_list = [request_info]

    for sequence, request_info in enumerate(request_info_list):
        if sequence == 0:
            name = result["span_id"]
        else:
            name = f"{result['span_id']}_req_{sequence}"

        item_id = int(uuid.uuid5(UPTIME_NAMESPACE, name).hex, 16).to_bytes(16, "little")

        request_item = convert_uptime_request_to_trace_item(
            project, result, request_info, sequence, item_id, incident_status
        )
        trace_items.append(request_item)

    return trace_items
