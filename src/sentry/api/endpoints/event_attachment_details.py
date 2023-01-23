import io
import posixpath

from django.http import StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response
from symbolic import ProguardMapper  # type: ignore

from sentry import eventstore, features, roles
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.constants import ATTACHMENTS_ROLE_DEFAULT
from sentry.eventstore.models import Event
from sentry.eventstore.snuba import SnubaEventStorage
from sentry.models import EventAttachment, File, OrganizationMember, ProjectDebugFile
from sentry.utils import json


class EventAttachmentDetailsPermission(ProjectPermission):
    def has_object_permission(self, request: Request, view, project):
        result = super().has_object_permission(request, view, project)

        if not result:
            return result

        if is_system_auth(request.auth) or is_active_superuser(request):
            return True

        if not request.user.is_authenticated:
            return False

        organization = project.organization
        required_role = (
            organization.get_option("sentry:attachments_role") or ATTACHMENTS_ROLE_DEFAULT
        )

        try:
            current_role = (
                OrganizationMember.objects.filter(
                    organization=organization, user_id=request.user.id
                )
                .values_list("role", flat=True)
                .get()
            )
        except OrganizationMember.DoesNotExist:
            return False

        required_role = roles.get(required_role)
        current_role = roles.get(current_role)
        return current_role.priority >= required_role.priority


def deobfuscate_view_hierarchy(view_hierarchy, mapper):
    windows_to_deobfuscate = [*view_hierarchy.get("windows")]
    while windows_to_deobfuscate:
        window = windows_to_deobfuscate.pop()
        window["type"] = mapper.remap_class(window.get("type"))
        if window.get("children"):
            windows_to_deobfuscate.extend(window.get("children"))

    return {
        "rendering_system": view_hierarchy.get("rendering_system"),
        "windows": view_hierarchy.get("windows"),
    }


@region_silo_endpoint
class EventAttachmentDetailsEndpoint(ProjectEndpoint):
    permission_classes = (EventAttachmentDetailsPermission,)

    def _get_proguard_uuid(self, event: Event):
        uuid = None
        if "debug_meta" in event.data:
            images = event.data["debug_meta"].get("images", [])
            if not isinstance(images, list):
                return
            if event.project is None:
                return

            for image in images:
                if image.get("type") == "proguard":
                    uuid = image.get("uuid")

        return uuid

    def _requires_deobfuscation(self, event: Event):
        return bool(self._get_proguard_uuid(event))

    def _get_proguard_mapper(self, event: Event):
        uuid = self._get_proguard_uuid(event)
        dif_paths = ProjectDebugFile.difcache.fetch_difs(
            event.project, [uuid], features=["mapping"]
        )
        debug_file_path = dif_paths.get(uuid)
        if debug_file_path is None:
            raise Exception

        # TODO(nar): Is there a way to know how big this is before opening?
        mapper = ProguardMapper.open(debug_file_path)
        if not mapper.has_line_info:
            # TODO(nar): throw some error?
            raise Exception

        return mapper

    def download(self, attachment):
        file = File.objects.get(id=attachment.file_id)
        fp = file.getfile()

        if attachment.type == "event.view_hierarchy":
            event = SnubaEventStorage().get_event_by_id(attachment.project_id, attachment.event_id)
            if self._requires_deobfuscation(event):
                mapper = self._get_proguard_mapper(event)
                if mapper is None:
                    raise Exception
                raw_view_hierarchy = json.load(fp)
                fp = io.BytesIO(
                    json.dumps_htmlsafe(
                        deobfuscate_view_hierarchy(raw_view_hierarchy, mapper)
                    ).encode()
                )

        response = StreamingHttpResponse(
            iter(lambda: fp.read(4096), b""),
            content_type=file.headers.get("content-type", "application/octet-stream"),
        )
        response["Content-Length"] = file.size
        response["Content-Disposition"] = 'attachment; filename="%s"' % posixpath.basename(
            " ".join(attachment.name.split())
        )
        return response

    def get(self, request: Request, project, event_id, attachment_id) -> Response:
        """
        Retrieve an Attachment
        ``````````````````````

        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event.
        :pparam string attachment_id: the id of the attachment.
        :auth: required
        """
        if not features.has(
            "organizations:event-attachments", project.organization, actor=request.user
        ):
            return self.respond(status=404)

        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            return self.respond({"detail": "Event not found"}, status=404)

        try:
            attachment = EventAttachment.objects.filter(
                project_id=project.id, event_id=event.event_id, id=attachment_id
            ).get()
        except EventAttachment.DoesNotExist:
            return self.respond({"detail": "Attachment not found"}, status=404)

        if request.GET.get("download") is not None:
            return self.download(attachment)

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

        attachment.delete()
        return self.respond(status=204)
