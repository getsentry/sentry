from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.source_map_helper import source_map_debug
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EventParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.models.sourcemapprocessingissue import SourceMapProcessingIssue


class SourceMapProcessingIssueResponse(TypedDict):
    type: str
    message: str
    data: dict | None


class SourceMapProcessingResponse(TypedDict):
    errors: list[SourceMapProcessingIssueResponse]


@region_silo_endpoint
@extend_schema(tags=["Events"])
class SourceMapDebugEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Debug Issues Related to Source Maps for a Given Event",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            EventParams.EVENT_ID,
            EventParams.FRAME_IDX,
            EventParams.EXCEPTION_IDX,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("SourceMapDebug", SourceMapProcessingResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project: Project, event_id: str) -> Response:
        """
        Return a list of source map errors for a given event.
        """
        frame_idx_param = request.GET.get("frame_idx")

        if not frame_idx_param:
            raise ParseError(detail="Query parameter 'frame_idx' is required")

        try:
            frame_idx = int(frame_idx_param)
        except ValueError:
            raise ParseError(detail="Query parameter 'frame_idx' must be an integer")

        exception_idx_param = request.GET.get("exception_idx")
        if not exception_idx_param:
            raise ParseError(detail="Query parameter 'exception_idx' is required")

        try:
            exception_idx = int(exception_idx_param)
        except ValueError:
            raise ParseError(detail="Query parameter 'exception_idx' must be an integer")

        debug_response = source_map_debug(project, event_id, exception_idx, frame_idx)
        issue, data = debug_response.issue, debug_response.data

        errors_list = []
        if issue:
            response = SourceMapProcessingIssue(issue, data=data).get_api_context()
            errors_list.append(response)
        return Response({"errors": errors_list})
