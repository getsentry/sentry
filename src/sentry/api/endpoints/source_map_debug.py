from typing import List, Union
from urllib.parse import urlparse

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound, ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EVENT_PARAMS, GLOBAL_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import Organization, Project, Release, SourceMapProcessingIssue


class SourceMapProcessingIssueResponse(TypedDict):
    type: str
    message: str
    data: Union[dict, None]


class SourceMapProcessingResponse(TypedDict):
    errors: List[SourceMapProcessingIssueResponse]


@region_silo_endpoint
@extend_schema(tags=["Events"])
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
            EVENT_PARAMS.FRAME_IDX,
            EVENT_PARAMS.EXCEPTION_IDX,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("SourceMapDebug", SourceMapProcessingResponse),
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
        """

        if not self.has_feature(project.organization, request):
            raise NotFound(
                detail="Endpoint not available without 'organizations:fix-source-map-cta' feature flag"
            )

        frame_idx = request.GET.get("frame_idx")
        if not frame_idx:
            raise ParseError(detail="Query parameter 'frame_idx' is required")

        exception_idx = request.GET.get("exception_idx")
        if not exception_idx:
            raise ParseError(detail="Query parameter 'exception_idx' is required")

        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        release_version = event.get_tag("sentry:release")

        if not release_version:
            return Response(
                {
                    "errors": [
                        SourceMapProcessingIssue(
                            SourceMapProcessingIssue.MISSING_RELEASE
                        ).get_api_context()
                    ],
                }
            )

        try:
            release = Release.objects.get(
                organization=project.organization, version=release_version
            )
        except Release.DoesNotExist:
            return Response(
                {
                    "errors": [
                        SourceMapProcessingIssue(
                            SourceMapProcessingIssue.MISSING_RELEASE
                        ).get_api_context()
                    ],
                }
            )
        user_agent = release.user_agent

        if not user_agent:
            return Response(
                {
                    "errors": [
                        SourceMapProcessingIssue(
                            SourceMapProcessingIssue.MISSING_USER_AGENT
                        ).get_api_context()
                    ],
                }
            )

        num_artifacts = release.count_artifacts()

        if num_artifacts == 0:
            return Response(
                {
                    "errors": [
                        SourceMapProcessingIssue(
                            SourceMapProcessingIssue.MISSING_SOURCEMAPS
                        ).get_api_context()
                    ],
                }
            )

        exceptions = event.interfaces["exception"].values
        frame_list = exceptions[int(exception_idx)].stacktrace.frames
        frame = frame_list[int(frame_idx)]
        abs_path = frame.abs_path

        urlparts = urlparse(abs_path)

        if not (urlparts.scheme and urlparts.path):
            return Response(
                {
                    "errors": [
                        SourceMapProcessingIssue(
                            SourceMapProcessingIssue.URL_NOT_VALID,
                            data={"absPath": abs_path},
                        ).get_api_context()
                    ],
                }
            )

        return Response({"errors": []})
