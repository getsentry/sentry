from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.eventattachment import EventAttachmentSerializerResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.event_attachment_examples import EventAttachmentExamples
from sentry.apidocs.parameters import CursorQueryParam, EventParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.eventattachment import EventAttachment, event_attachment_screenshot_filter
from sentry.search.utils import tokenize_query
from sentry.services import eventstore

EVENT_ATTACHMENTS_QUERY_PARAM = OpenApiParameter(
    name="query",
    location="query",
    required=False,
    type=str,
    description=(
        "Filter the attachments by name (substring match) or by attachment kind. "
        "Use `is:screenshot` to restrict the results to screenshot attachments."
    ),
)


@extend_schema(tags=["Events"])
@cell_silo_endpoint
class EventAttachmentsEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="listProjectEventAttachments",
        summary="List an Event's Attachments",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            EventParams.EVENT_ID,
            EVENT_ATTACHMENTS_QUERY_PARAM,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListEventAttachmentsResponse", list[EventAttachmentSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EventAttachmentExamples.LIST_EVENT_ATTACHMENTS,
    )
    def get(
        self, request: Request, project, event_id
    ) -> Response[list[EventAttachmentSerializerResponse]]:
        """
        Retrieve a list of attachments uploaded for a given event.

        Requires the `event-attachments` organization feature.
        """
        if not features.has(
            "organizations:event-attachments", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            return self.respond({"detail": "Event not found"}, status=404)

        queryset = EventAttachment.objects.filter(project_id=project.id, event_id=event.event_id)

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    value_s = " ".join(value)
                    queryset = queryset.filter(name__icontains=value_s)
                elif key == "is":
                    value_s = " ".join(value)
                    if value_s == "screenshot":
                        queryset = event_attachment_screenshot_filter(queryset)
                else:
                    queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
