import uuid
from typing import Literal

from google.protobuf.json_format import MessageToDict
from google.protobuf.timestamp_pb2 import Timestamp as ProtoTimestamp
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import TraceItemDetailsRequest
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import BadRequest
from sentry.models.project import Project
from sentry.search.eap import constants
from sentry.search.eap.types import SupportedTraceItemType, TraceItemAttribute
from sentry.search.eap.utils import translate_internal_to_public_alias
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc

DISALLOW_LIST = {
    "sentry.organization_id",
    "sentry.item_type",
}


def convert_rpc_attribute_to_json(
    attributes: list[dict],
    trace_item_type: SupportedTraceItemType,
) -> list[TraceItemAttribute]:
    result: list[TraceItemAttribute] = []
    for attribute in attributes:
        internal_name = attribute["name"]
        if internal_name in DISALLOW_LIST:
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
                else:
                    raise BadRequest(f"unknown column type in protobuf: {val_type}")

                external_name = translate_internal_to_public_alias(
                    internal_name, column_type, trace_item_type
                )

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

        if not features.has(
            "organizations:discover-basic", project.organization, actor=request.user
        ):
            return Response(status=404)

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
        end_timestamp_proto.GetCurrentTime()

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
            filter=TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(
                        type=AttributeKey.TYPE_STRING,
                        name="sentry.trace_id",
                    ),
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(
                        val_str=trace_id,
                    ),
                )
            ),
        )

        resp = MessageToDict(snuba_rpc.trace_item_details_rpc(req))

        resp_dict = {
            "itemId": serialize_item_id(resp["itemId"], item_type),
            "timestamp": resp["timestamp"],
            "attributes": convert_rpc_attribute_to_json(resp["attributes"], item_type),
        }

        return Response(resp_dict)
