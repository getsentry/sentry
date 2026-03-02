import contextlib
import posixpath
from typing import IO, ContextManager

import sentry_sdk
from django.http import StreamingHttpResponse
from objectstore_client.client import RequestError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.auth.superuser import superuser_has_permission
from sentry.auth.system import is_system_auth
from sentry.constants import ATTACHMENTS_ROLE_DEFAULT
from sentry.models.activity import Activity
from sentry.models.eventattachment import V1_PREFIX, V2_PREFIX, EventAttachment
from sentry.models.organizationmember import OrganizationMember
from sentry.objectstore import get_attachments_session, parse_accept_encoding
from sentry.services import eventstore
from sentry.types.activity import ActivityType
from sentry.utils import metrics


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


@region_silo_endpoint
class EventAttachmentDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (EventAttachmentDetailsPermission,)

    def download(
        self, attachment: EventAttachment, request: Request, project
    ) -> StreamingHttpResponse:
        name = posixpath.basename(" ".join(attachment.name.split()))

        accept_encoding = parse_accept_encoding(request.headers.get("Accept-Encoding", ""))
        blob_path = attachment.blob_path
        if accept_encoding and blob_path and blob_path.startswith(V2_PREFIX):
            v2_key = blob_path.removeprefix(V2_PREFIX)
            try:
                os_response = get_attachments_session(
                    project.organization_id, attachment.project_id
                ).get(v2_key, accept_encoding=accept_encoding)
            except RequestError:
                sentry_sdk.capture_exception()
                # Fall through to stream_attachment() below
            else:
                encoding = os_response.metadata.compression

                def stream_v2():
                    with os_response.payload as payload:
                        while chunk := payload.read(4096):
                            yield chunk

                response = StreamingHttpResponse(stream_v2(), content_type=attachment.content_type)
                if encoding:
                    response["Content-Encoding"] = encoding
                else:
                    response["Content-Length"] = attachment.size
                response["Content-Disposition"] = f'attachment; filename="{name}"'
                return response

        def stream_attachment():
            attachment_file = attachment.getfile()
            doublewrite_file: IO[bytes] | ContextManager[None] = contextlib.nullcontext()
            blob_path = attachment.blob_path or ""
            blob_path = blob_path.startswith(V1_PREFIX) and blob_path.removeprefix(V1_PREFIX) or ""
            if blob_path.startswith(V2_PREFIX):
                try:
                    # We force the attachment model to use the objectstore backend
                    # by changing its prefix. Its a big hack, but hey why not.
                    attachment.blob_path = blob_path
                    doublewrite_file = attachment.getfile()
                    metrics.incr("storage.attachments.double_write.read")
                except Exception:
                    sentry_sdk.capture_exception()

            # TODO: We should pass along the `Accept-Encoding`, so we can avoid
            # decompressing on the API side, and just transfer the already
            # compressed bytes to the client as it indicated it can handle it.
            with attachment_file as af, doublewrite_file as df:
                while filestore_chunk := af.read(4096):
                    if df:
                        try:
                            objectstore_chunk = df.read(4096)
                            assert filestore_chunk == objectstore_chunk
                        except Exception:
                            # If we have encountered one error, clear the reference
                            # to avoid spamming more errors for all the remaining chunks.
                            df = None
                            sentry_sdk.capture_exception()
                    yield filestore_chunk

        response = StreamingHttpResponse(
            stream_attachment(),
            content_type=attachment.content_type,
        )
        # TODO(see above): response["Content-Encoding"] = compression
        # Also, if we were to directly stream compressed data, the `Content-Length`
        # has to refer to the compressed size, which we currently don’t save anywhere.
        response["Content-Length"] = attachment.size
        response["Content-Disposition"] = f'attachment; filename="{name}"'

        return response

    def get(self, request: Request, project, event_id, attachment_id) -> Response:
        """
        Retrieve an Attachment
        ``````````````````````

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          issues belong to.
        :pparam string project_id_or_slug: the id or slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event.
        :pparam string attachment_id: the id of the attachment.
        :auth: required
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
            return self.download(attachment, request, project)

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
