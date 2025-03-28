import uuid
from collections.abc import Generator
from typing import Literal

from google.protobuf.json_format import MessageToDict
from google.protobuf.timestamp_pb2 import Timestamp as ProtoTimestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import TraceItemDetailsRequest
from sentry_protos.snuba.v1.request_common_pb2 import TRACE_ITEM_TYPE_LOG, RequestMeta
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import BadRequest
from sentry.models.project import Project
from sentry.search.eap.types import SupportedTraceItemType
from sentry.search.eap.utils import translate_internal_to_public_alias
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc


def convert_rpc_attribute_to_json(
    attributes: list[dict],
    trace_item_type: SupportedTraceItemType,
) -> Generator[dict]:
    for attribute in attributes:
        internal_name = attribute["name"]
        source = attribute["value"]
        if len(source) == 0:
            raise BadRequest(f"unknown field in protobuf: {internal_name}")
        for k, v in source.items():
            if k.startswith("val"):
                val_type = k[3:].lower()
                column_type: Literal["string", "number"] = "string"
                if val_type == "str" or val_type == "bool":
                    column_type = "string"
                elif val_type == "int" or val_type == "float" or val_type == "double":
                    column_type = "number"
                else:
                    raise BadRequest(f"unknown column type in protobuf: {val_type}")

                external_name = translate_internal_to_public_alias(
                    internal_name, column_type, trace_item_type
                )

                if external_name is None:
                    if type == "number":
                        external_name = f"tags[{internal_name},number]"
                    else:
                        external_name = internal_name

                yield {"name": external_name, "type": val_type, "value": v}


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
        dataset = request.GET.get("dataset")
        referrer = request.GET.get("referrer", Referrer.API_ORGANIZATION_TRACE_ITEM_DETAILS.value)
        if dataset == "ourlogs":
            trace_item_type = TRACE_ITEM_TYPE_LOG
        else:
            raise BadRequest(detail=f"Unknown dataset: '{dataset}'")

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
            "itemId": resp["itemId"],
            "timestamp": resp["timestamp"],
            "attributes": sorted(
                list(convert_rpc_attribute_to_json(resp["attributes"], trace_item_type)),
                key=lambda x: (x["type"], x["name"]),
            ),
        }

        return Response(resp_dict)
