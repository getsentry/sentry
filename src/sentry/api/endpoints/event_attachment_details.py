import posixpath

from django.http import StreamingHttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.eventattachment import EventAttachmentSerializerResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.event_attachment_examples import EventAttachmentExamples
from sentry.apidocs.parameters import EventParams, GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.superuser import superuser_has_permission
from sentry.auth.system import is_system_auth
from sentry.constants import ATTACHMENTS_ROLE_DEFAULT
from sentry.models.activity import Activity
from sentry.models.eventattachment import EventAttachment
from sentry.models.organizationmember import OrganizationMember
from sentry.objectstore import parse_accept_encoding
from sentry.services import eventstore
from sentry.types.activity import ActivityType

ATTACHMENT_ID_PARAM = OpenApiParameter(
    name="attachment_id",
    location="path",
    required=True,
    type=str,
    description="The numeric ID of the attachment, as returned from the attachments list endpoint.",
)


class EventAttachmentDetailsPermission(ProjectPermission):
    def has_object_permission(self, request: Request, view, project):
        result = super().has_object_permission(request, view, project)

        if not result:
            return result

        if is_system_auth(request.auth) or superuser_has_permission(request):
            return True

        if not request.user.is_authenticated:
            return False

        organization = project.organization
        required_role = (
            organization.get_option("sentry:attachments_role") or ATTACHMENTS_ROLE_DEFAULT
        )

        try:
            om = OrganizationMember.objects.get(organization=organization, user_id=request.user.id)
        except OrganizationMember.DoesNotExist:
            return False

        required_role = roles.get(required_role)
        om_role = roles.get(om.role)
        return om_role.priority >= required_role.priority


@extend_schema(tags=["Events"])
@cell_silo_endpoint
class EventAttachmentDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (EventAttachmentDetailsPermission,)

    def download(self, attachment: EventAttachment, request: Request) -> StreamingHttpResponse:
        name = posixpath.basename(" ".join(attachment.name.split()))
        accept_encoding = parse_accept_encoding(request.headers.get("Accept-Encoding", ""))
        blob_stream = attachment.get_blob_stream(accept_encoding)

        def stream_attachment():
            with blob_stream.payload as payload:
                while chunk := payload.read(4096):
                    yield chunk

        response = StreamingHttpResponse(stream_attachment(), content_type=attachment.content_type)
        if blob_stream.encoding:
            response["Content-Encoding"] = blob_stream.encoding
        else:
            response["Content-Length"] = attachment.size
        response["Content-Disposition"] = f'attachment; filename="{name}"'
        return response

    @extend_schema(
        operation_id="getProjectEventAttachment",
        summary="Retrieve an Event Attachment",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            EventParams.EVENT_ID,
            ATTACHMENT_ID_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "EventAttachmentDetailsResponse", EventAttachmentSerializerResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EventAttachmentExamples.EVENT_ATTACHMENT_DETAILS,
    )
    def get(
        self, request: Request, project, event_id, attachment_id
    ) -> (
        Response[EventAttachmentSerializerResponse]
        | Response[None]
        | Response[DetailResponse]
        | StreamingHttpResponse
    ):
        """
        Retrieve metadata for a single attachment on an event.

        Requires the `event-attachments` organization feature.
        """
        if not features.has(
            "organizations:event-attachments", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            return self.respond({"detail": "Event not found"}, status=404)

        try:
            attachment = EventAttachment.objects.filter(
                project_id=project.id, event_id=event.event_id, id=attachment_id
            ).get()
        except EventAttachment.DoesNotExist:
            return self.respond({"detail": "Attachment not found"}, status=404)

        if request.GET.get("download") is not None:
            return self.download(attachment, request)

        return self.respond(serialize(attachment, request.user))

    def delete(self, request: Request, project, event_id, attachment_id) -> Response:
        """
        Delete an Event Attachment by ID
        ````````````````````````````````

        Delete an attachment on the given event.

        :pparam string event_id: the identifier of the event.
        :pparam string attachment_id: the identifier of the attachment.
        :auth: required
        """
        if not features.has(
            "organizations:event-attachments", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        try:
            attachment = EventAttachment.objects.filter(
                project_id=project.id, event_id=event_id, id=attachment_id
            ).get()
        except EventAttachment.DoesNotExist:
            return self.respond({"detail": "Attachment not found"}, status=404)

        # an activity with no group cannot be associated with an issue or displayed in an issue details page
        if attachment.group_id is not None:
            Activity.objects.create(
                group_id=attachment.group_id,
                project=project,
                type=ActivityType.DELETED_ATTACHMENT.value,
                user_id=request.user.id,
                data={},
            )
        attachment.delete()
        return self.respond(status=204)
