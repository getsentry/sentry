from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Organization, Project, SourceMapError


@region_silo_endpoint
class SourceMapDebugEndpoint(ProjectEndpoint):
    def has_feature(self, organization: Organization, request: Request):
        return features.has("organizations:fix-source-map-cta", organization, actor=request.user)

    def get(self, request: Request, project: Project, event_id: str) -> Response:
        """
        Retrieve Committer information for an event
        ```````````````````````````````````````````

        Return committers on an individual event, plus a per-frame breakdown.

        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the hexadecimal ID of the event to
                                 retrieve (as reported by the raven client).
        :auth: frame: the integer representing the frame index
        """
        if not self.has_feature(project.organization, request):
            raise NotFound(
                detail="Endpoint not avaialable without 'organizations:fix-source-map-cta' feature flag"
            )

        frame = request.GET.get("frame")
        if not frame:
            return Response(
                {"detail": "Query parameter 'frame' is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        release = event.get_tag("sentry:release")

        if not release:
            return Response(
                {
                    "errorCount": 1,
                    "errors": [
                        SourceMapError(SourceMapError.NO_RELEASE_ON_EVENT).get_api_context()
                    ],
                }
            )
        return Response({"errorCount": 0, "errors": []})
