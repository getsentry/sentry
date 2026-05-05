import time
import uuid
from typing import Any, Literal

import sentry_sdk
from google.protobuf.json_format import MessageToDict
from google.protobuf.timestamp_pb2 import Timestamp as ProtoTimestamp
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import TraceItemDetailsRequest
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import BadRequest
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.models.project import Project
from sentry.search.eap import constants
from sentry.search.eap.types import (
    ColumnType,
    ScalarType,
    ScalarValueType,
    SupportedTraceItemType,
    TraceItemAttribute,
)
from sentry.search.eap.utils import (
    can_expose_attribute,
    is_sentry_convention_replacement_attribute,
    translate_internal_to_public_alias,
    translate_search_type_for_internal_column,
    translate_to_sentry_conventions,
)
from sentry.snuba.referrer import Referrer
from sentry.utils import json, snuba_rpc

_NUMERIC_COERCIONS: dict[str, type] = {"valFloat": float, "valDouble": float}
_VAL_TYPE_TO_COLUMN_TYPE: dict[str, ColumnType] = {
    "valBool": "boolean",
    "valStr": "string",
    "valInt": "number",
    "valFloat": "number",
    "valDouble": "number",
    "valArray": "array",
}


def _parse_scalar(
    column_type: ColumnType, value_type, value: str
) -> tuple[ScalarValueType, ScalarType]:
    parsed_value_type = value_type[3:].lower()
    match column_type:
        case "number":
            if value_type in _NUMERIC_COERCIONS:
                # Only for nonintegers, always typed as float.
                try:
                    return _NUMERIC_COERCIONS[value_type](float(value)), "float"
                except ValueError:
                    raise BadRequest(
                        f"Failed value parsing for [{column_type}, {value_type}, {value}]"
                    )
            return value, parsed_value_type
        case "boolean":
            return bool(value), parsed_value_type
        case "string":
            return str(value), parsed_value_type
        case _:
            raise BadRequest(
                f"unknown Value Type in response: [{column_type}, {value_type}, {value}]"
            )


def _get_value_from_attribute(
    attribute_value: dict[str, Any],
) -> tuple[ColumnType | None, ScalarValueType | list[ScalarValueType] | None, ScalarType | None]:
    """Column Type, parsed value, and python scalar type (for arrays, type of its elements)"""
    for attribute_type_key, value in attribute_value.items():
        column_type = _VAL_TYPE_TO_COLUMN_TYPE.get(attribute_type_key)
        if column_type is None:
            sentry_sdk.logger.error(f"Unknown Type in Protobuf {attribute_value}")
            continue
        if column_type == "array":
            element_types: list[ScalarType] = []
            elements: list[ScalarValueType] = []
            for element in value.get("values", []):
                _, val, ty = _get_value_from_attribute(element)
                # reject nested arrays
                if ty is not None and not isinstance(val, list | None):
                    element_types.append(ty)
                    elements.append(val)
            if len(element_types):
                return column_type, elements, element_types[0]
            # When array is empty, we can safely assume type as 'string'.
            # Type can be overridden by column definitions (with 'search_type') later
            return column_type, elements, "str"
        else:
            value, python_type = _parse_scalar(column_type, attribute_type_key, value)
            return column_type, value, python_type
    return None, None, None


def convert_rpc_attribute_to_json(
    attributes: list[dict],
    trace_item_type: SupportedTraceItemType,
    use_sentry_conventions: bool = False,
    include_internal: bool = False,
    include_arrays: bool = False,
) -> list[TraceItemAttribute]:
    result: list[TraceItemAttribute] = []
    seen_sentry_conventions: set[str] = set()
    for attribute in attributes:
        internal_name = attribute["name"]

        if not can_expose_attribute(
            internal_name, trace_item_type, include_internal=include_internal
        ):
            continue

        source = attribute["value"]
        if len(source) == 0:
            raise BadRequest(f"Unknown field in Response: {internal_name}")
        column_type, output_value, python_scalar_type = _get_value_from_attribute(source)

        if column_type is None and output_value is None:
            continue
        if column_type == "array" and not include_arrays:
            continue

        output_type: ScalarType | Literal["array"] = "str"
        if column_type == "array":
            translate_type = translate_search_type_for_internal_column(
                internal_name, trace_item_type
            )
            output_type = "array"
        else:
            translate_type = column_type
            output_type = python_scalar_type or output_type
        external_name = None
        if translate_type:
            external_name, _, _ = translate_internal_to_public_alias(
                internal_name, translate_type, trace_item_type
            )

        if use_sentry_conventions and external_name:
            external_name = translate_to_sentry_conventions(external_name, trace_item_type)
            if external_name in seen_sentry_conventions:
                continue
            seen_sentry_conventions.add(external_name)
        else:
            if external_name and is_sentry_convention_replacement_attribute(
                external_name, trace_item_type
            ):
                continue

        if trace_item_type == SupportedTraceItemType.SPANS and internal_name.startswith("sentry."):
            internal_name = internal_name.replace("sentry.", "", count=1)

        if external_name is None:
            if column_type in ("number", "boolean", "array"):
                external_name = f"tags[{internal_name},{column_type}]"
            else:
                external_name = internal_name

        # TODO: this should happen in snuba instead
        if external_name == "trace" and isinstance(output_value, str):
            output_value = output_value.replace("-", "")

        result.append(
            TraceItemAttribute(
                name=external_name,
                type=output_type,
                value=output_value,
            )
        )

    return sorted(result, key=lambda x: (x["type"], x["name"]))


def serialize_meta(
    attributes: list[dict],
    trace_item_type: SupportedTraceItemType,
) -> dict:
    internal_name = ""
    attribute = {}
    meta_result = {}
    meta_attributes = {}
    for attribute in attributes:
        internal_name = attribute["name"]
        if internal_name.startswith(constants.META_PREFIX):
            meta_attributes[internal_name] = attribute

    def extract_key(key: str) -> str | None:
        if key.startswith(f"{constants.META_ATTRIBUTE_PREFIX}."):
            return key.replace(f"{constants.META_ATTRIBUTE_PREFIX}.", "")
        elif key.startswith(f"{constants.META_FIELD_PREFIX}."):
            return key.replace(f"{constants.META_FIELD_PREFIX}.", "")
        # Unknown meta field, skip for now
        else:
            return None

    attribute_map = {item.get("name", ""): item.get("value", {}) for item in attributes}
    for internal_name, attribute in sorted(meta_attributes.items()):
        if "valStr" not in attribute["value"]:
            continue
        field_key = extract_key(internal_name)
        if field_key is None:
            continue

        # TODO: This should probably also omit internal attributes. It's not
        # clear why it doesn't, but this behavior seems important for logs.

        try:
            result = json.loads(attribute["value"]["valStr"])
            # Map the internal field key name back to its public name
            if field_key in attribute_map:
                item_type: Literal["string", "number", "boolean"]
                if (
                    "valInt" in attribute_map[field_key]
                    or "valFloat" in attribute_map[field_key]
                    or "valDouble" in attribute_map[field_key]
                ):
                    item_type = "number"
                elif "valBool" in attribute_map[field_key]:
                    item_type = "boolean"
                else:
                    item_type = "string"
                external_name, _, _ = translate_internal_to_public_alias(
                    field_key, item_type, trace_item_type
                )
                if external_name:
                    field_key = external_name
                elif item_type == "number":
                    field_key = f"tags[{field_key},number]"
                elif item_type == "boolean":
                    field_key = f"tags[{field_key},boolean]"
                meta_result[field_key] = result
        except json.JSONDecodeError:
            continue

    return meta_result


def serialize_links(attributes: list[dict]) -> list[dict] | None:
    """Links are temporarily stored in `sentry.links` so lets parse that back out and return separately"""
    link_attribute = None
    for attribute in attributes:
        internal_name = attribute["name"]
        if internal_name == "sentry.links":
            link_attribute = attribute

    if link_attribute is None:
        return None

    try:
        value = link_attribute.get("value", {}).get("valStr", None)
        if value is not None:
            links = json.loads(value)
            return [serialize_link(link) for link in links]
        else:
            return None
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return None


def serialize_link(link: dict) -> dict:
    clean_link = {
        "itemId": link["span_id"],
        "traceId": link["trace_id"],
    }

    if (sampled := link.get("sampled")) is not None:
        clean_link["sampled"] = sampled

    if attributes := link.get("attributes"):
        clean_link["attributes"] = [
            {"name": k, "value": v, "type": infer_type(v)}
            for k, v in attributes.items()
            if infer_type(v) is not None
        ]

    return clean_link


def infer_type(value: Any) -> str | None:
    """
    Attempt to infer the type of a link attribute value. Only supports a subset
    of types, since realistically we only store known keys. This becomes moot
    once we start storing span links as trace items, and they follow the same
    attribute parsing logic as spans.
    """
    if isinstance(value, str):
        return "str"
    elif isinstance(value, bool):
        return "bool"
    elif isinstance(value, int):
        return "int"
    elif isinstance(value, float):
        return "float"
    else:
        return None


def serialize_item_id(item_id: str, trace_item_type: SupportedTraceItemType) -> str:
    if trace_item_type == SupportedTraceItemType.SPANS:
        return item_id[-16:]
    else:
        return item_id


class ProjectTraceItemDetailsEndpointSerializer(serializers.Serializer):
    trace_id = serializers.UUIDField(format="hex", required=True)
    item_type = serializers.ChoiceField([e.value for e in SupportedTraceItemType], required=True)
    referrer = serializers.CharField(required=False)


@cell_silo_endpoint
class ProjectTraceItemDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.DATA_BROWSING
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    @staticmethod
    def get(request: Request, project: Project, item_id: str) -> Response:
        """
        Retrieve a Trace Item for a project.

        For example, you might ask 'give me all the details about the span/log with id 01234567'
        """
        serializer = ProjectTraceItemDetailsEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.validated_data
        trace_id = serialized.get("trace_id")
        item_type = serialized.get("item_type")
        referrer = serialized.get("referrer", Referrer.API_ORGANIZATION_TRACE_ITEM_DETAILS.value)

        trace_item_type = None
        if item_type is not None:
            trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
                SupportedTraceItemType(item_type), None
            )

        if trace_item_type is None:
            raise BadRequest(detail=f"Unknown trace item type: {item_type}")

        start_timestamp_proto = ProtoTimestamp()
        start_timestamp_proto.FromSeconds(0)

        end_timestamp_proto = ProtoTimestamp()

        # due to clock drift, the end time can be in the future - add a week to be safe
        end_timestamp_proto.FromSeconds(int(time.time()) + 60 * 60 * 24 * 7)

        trace_id = request.GET.get("trace_id")
        if not trace_id:
            raise BadRequest(detail="Missing required query parameter 'trace_id'")

        req = TraceItemDetailsRequest(
            item_id=item_id,
            meta=RequestMeta(
                organization_id=project.organization.id,
                cogs_category="events_analytics_platform",
                referrer=referrer,
                project_ids=[project.id],
                start_timestamp=start_timestamp_proto,
                end_timestamp=end_timestamp_proto,
                trace_item_type=trace_item_type,
                request_id=str(uuid.uuid4()),
            ),
            trace_id=trace_id,
        )

        resp = MessageToDict(snuba_rpc.trace_item_details_rpc(req))

        use_sentry_conventions = features.has(
            "organizations:performance-sentry-conventions-fields",
            project.organization,
            actor=request.user,
        )
        include_arrays = features.has(
            "organizations:trace-item-details-array-fields",
            project.organization,
            actor=request.user,
        )

        include_internal = is_active_superuser(request) or is_active_staff(request)

        resp_dict = {
            "itemId": serialize_item_id(resp["itemId"], item_type),
            "timestamp": resp["timestamp"],
            "attributes": convert_rpc_attribute_to_json(
                resp["attributes"],
                item_type,
                use_sentry_conventions,
                include_internal=include_internal,
                include_arrays=include_arrays,
            ),
            "meta": serialize_meta(resp["attributes"], item_type),
            "links": serialize_links(resp["attributes"]),
        }

        return Response(resp_dict)
