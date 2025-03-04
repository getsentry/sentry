import uuid

from google.protobuf.json_format import MessageToDict
from google.protobuf.timestamp_pb2 import Timestamp as ProtoTimestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import TraceItemDetailsRequest
from sentry_protos.snuba.v1.request_common_pb2 import TRACE_ITEM_TYPE_LOG, RequestMeta

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import BadRequest
from sentry.models.project import Project
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc


def convert_rpc_attribute_to_json(source: dict) -> dict:
    for k, v in source.items():
        if k.startswith("val"):
            return {"type": k[3:].lower(), "value": v}
    raise BadRequest(f"unknown field in protobuf: {source}")


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
        )

        resp = MessageToDict(snuba_rpc.trace_item_details_rpc(req))

        resp_dict = {
            "itemId": resp["itemId"],
            "timestamp": resp["timestamp"],
            "attributes": {
                attr["name"]: convert_rpc_attribute_to_json(attr["value"])
                for attr in resp["attributes"]
            },
        }

        return Response(resp_dict)
