from __future__ import annotations

from typing import List

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EVENT_PARAMS, GLOBAL_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import Organization, Project, SourceMapError


class SourceMapErrorResponse:
    type: str
    message: str
    data: dict | None


class SourceMapResponse:
    errorCount: int
    errors: List[SourceMapErrorResponse]


@region_silo_endpoint
class SourceMapDebugEndpoint(ProjectEndpoint):
    public = {"GET"}

    def has_feature(self, organization: Organization, request: Request):
        return features.has("organizations:fix-source-map-cta", organization, actor=request.user)

    @extend_schema(
        operation_id="Debug issues related to source maps for a given event",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            GLOBAL_PARAMS.PROJECT_SLUG,
            EVENT_PARAMS.EVENT_ID,
            EVENT_PARAMS.FRAME,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("SourceMapDebug", SourceMapResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def get(self, request: Request, project: Project, event_id: str) -> Response:
        """
        Retrieve information about source maps for a given event.
        ```````````````````````````````````````````

        Return a list of source map errors for a given event.

        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the hexadecimal ID of the event to
                                 retrieve.
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
