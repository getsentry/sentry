import time
import uuid

from google.protobuf.json_format import MessageToDict
from google.protobuf.timestamp_pb2 import Timestamp as ProtoTimestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import TraceItemDetailsRequest
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import BadRequest
from sentry.auth.superuser import superuser_has_permission
from sentry.models.project import Project
from sentry.search.eap import constants
from sentry.search.eap.types import SupportedTraceItemType
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc

from .project_trace_item_details import ProjectTraceItemDetailsEndpointSerializer


@cell_silo_endpoint
class ProjectTraceItemDetailsRawEndpoint(ProjectEndpoint):
    owner = ApiOwner.DATA_BROWSING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @staticmethod
    def get(request: Request, project: Project, item_id: str) -> Response:
        """
        Like ProjectTraceItemDetailsEndpoint, but returns the raw
        TraceItemDetailsResponse without post-processing so superusers can
        inspect underlying EAP data.
        """
        if not superuser_has_permission(request):
            return Response(status=403)

        serializer = ProjectTraceItemDetailsEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.validated_data
        item_type = serialized.get("item_type")

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
        end_timestamp_proto.FromSeconds(int(time.time()) + 60 * 60 * 24 * 7)

        trace_id = request.GET.get("trace_id")
        if not trace_id:
            raise BadRequest(detail="Missing required query parameter 'trace_id'")

        req = TraceItemDetailsRequest(
            item_id=item_id,
            meta=RequestMeta(
                organization_id=project.organization.id,
                cogs_category="events_analytics_platform",
                referrer=Referrer.API_ORGANIZATION_TRACE_ITEM_DETAILS_RAW.value,
                project_ids=[project.id],
                start_timestamp=start_timestamp_proto,
                end_timestamp=end_timestamp_proto,
                trace_item_type=trace_item_type,
                request_id=str(uuid.uuid4()),
            ),
            trace_id=trace_id,
        )

        resp = MessageToDict(snuba_rpc.trace_item_details_rpc(req))
        return Response(resp)
