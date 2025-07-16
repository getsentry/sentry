import time
import uuid
from typing import Literal

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
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import BadRequest
from sentry.models.project import Project
from sentry.search.eap import constants
from sentry.search.eap.types import SupportedTraceItemType, TraceItemAttribute
from sentry.search.eap.utils import (
    PRIVATE_ATTRIBUTES,
    is_sentry_convention_replacement_attribute,
    translate_internal_to_public_alias,
    translate_to_sentry_conventions,
)
from sentry.snuba.referrer import Referrer
from sentry.utils import json, snuba_rpc


def convert_rpc_attribute_to_json(
    attributes: list[dict],
    trace_item_type: SupportedTraceItemType,
    use_sentry_conventions: bool = False,
) -> list[TraceItemAttribute]:
    result: list[TraceItemAttribute] = []
    seen_sentry_conventions: set[str] = set()
    for attribute in attributes:
        internal_name = attribute["name"]
        if internal_name in PRIVATE_ATTRIBUTES.get(trace_item_type, []):
            continue
        if internal_name.startswith(constants.META_PREFIX):
            continue
        source = attribute["value"]
        if len(source) == 0:
            raise BadRequest(f"unknown field in protobuf: {internal_name}")
        for key, value in source.items():
            lowered_key = key.lower()
            if lowered_key.startswith("val"):
                val_type = lowered_key[3:]
                column_type: Literal["string", "number"] = "string"
                if val_type in ["str", "bool"]:
                    column_type = "string"
                elif val_type in ["int", "float", "double"]:
                    column_type = "number"
                    if val_type == "double":
                        val_type = "float"
                else:
                    raise BadRequest(f"unknown column type in protobuf: {val_type}")

                external_name = translate_internal_to_public_alias(
                    internal_name, column_type, trace_item_type
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

                if trace_item_type == SupportedTraceItemType.SPANS and internal_name.startswith(
                    "sentry."
                ):
                    internal_name = internal_name.replace("sentry.", "", count=1)

                if external_name is None:
                    if column_type == "number":
                        external_name = f"tags[{internal_name},number]"
                    else:
                        external_name = internal_name

                # TODO: this should happen in snuba instead
                if external_name == "trace":
                    value = value.replace("-", "")

                result.append(
                    TraceItemAttribute({"name": external_name, "type": val_type, "value": value})
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

        try:
            result = json.loads(attribute["value"]["valStr"])
            # Map the internal field key name back to its public name
            if field_key in attribute_map:
                item_type: Literal["string", "number"]
                if (
                    "valInt" in attribute_map[field_key]
                    or "valFloat" in attribute_map[field_key]
                    or "valDouble" in attribute_map[field_key]
                ):
                    item_type = "number"
                else:
                    item_type = "string"
                external_name = translate_internal_to_public_alias(
                    field_key, item_type, trace_item_type
                )
                if external_name:
                    field_key = external_name
                elif item_type == "number":
                    field_key = f"tags[{field_key},number]"
                meta_result[field_key] = result
        except json.JSONDecodeError:
            continue

    return meta_result


def serialize_item_id(item_id: str, trace_item_type: SupportedTraceItemType) -> str:
    if trace_item_type == SupportedTraceItemType.SPANS:
        return item_id[-16:]
    else:
        return item_id


class ProjectTraceItemDetailsEndpointSerializer(serializers.Serializer):
    trace_id = serializers.UUIDField(format="hex", required=True)
    item_type = serializers.ChoiceField([e.value for e in SupportedTraceItemType], required=True)
    referrer = serializers.CharField(required=False)


@region_silo_endpoint
class ProjectTraceItemDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.PERFORMANCE
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

        resp_dict = {
            "itemId": serialize_item_id(resp["itemId"], item_type),
            "timestamp": resp["timestamp"],
            "attributes": convert_rpc_attribute_to_json(
                resp["attributes"], item_type, use_sentry_conventions
            ),
            "meta": serialize_meta(resp["attributes"], item_type),
        }

        return Response(resp_dict)
