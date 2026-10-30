from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.lang.native.processing import MINIDUMP_ATTACHMENT_TYPE
from sentry.lang.native.symbolicator import (
    Symbolicator,
    SymbolicatorFunction,
    SymbolicatorTaskKind,
)
from sentry.models.eventattachment import V2_PREFIX, EventAttachment
from sentry.models.project import Project
from sentry.services import eventstore


@cell_silo_endpoint
class ProjectNativeToolsMetadataEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    # Internal Sentry tooling: only reachable with active superuser/staff, never by
    # ordinary org members or API tokens.
    # permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def get(self, request: Request, project: Project, event_id: str) -> Response:
        """
        Retrieve the metadata (system info) of an event's minidump.

        This invokes Symbolicator's `get_metadata` tool on the minidump attached to
        the given event. The call blocks until Symbolicator responds.
        """

        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        attachment = EventAttachment.objects.filter(
            project_id=project.id,
            event_id=event.event_id,
            type=MINIDUMP_ATTACHMENT_TYPE,
        ).first()
        if attachment is None:
            return Response({"detail": "Event has no minidump attachment"}, status=404)

        # `uses_objectstore()` implies a non-null `blob_path`, but doesn't narrow it.
        blob_path = attachment.blob_path
        if not attachment.uses_objectstore() or blob_path is None:
            return Response(
                {"detail": "Minidump is not stored in a location Symbolicator can read"},
                status=400,
            )

        symbolicator = Symbolicator(
            task_kind=SymbolicatorTaskKind(function=SymbolicatorFunction.minidump),
            on_request=lambda: None,
            project=project,
            event_id=event.event_id,
        )

        response = symbolicator.get_minidump_metadata(blob_path.removeprefix(V2_PREFIX))

        if response is None or response.get("status") == "failed":
            return Response({"detail": "Symbolicator failed to read the minidump"}, status=502)

        return Response(response)
