from typing import List, Union

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.source_map_helper import source_map_debug
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EventParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import EventError, Organization, Project, SourceMapProcessingIssue


class ActionableItemResponse(TypedDict):
    type: str
    message: str
    data: Union[dict, None]


class SourceMapProcessingResponse(TypedDict):
    errors: List[ActionableItemResponse]


priority = {EventError.JS_INVALID_SOURCEMAP: 2, EventError.JS_NO_COLUMN: 3}

fileNameBlocklist = ["@webkit-masked-url"]


@region_silo_endpoint
@extend_schema(tags=["Events"])
class ActionableItemsEndpoint(ProjectEndpoint):
    public = {"GET"}

    def has_feature(self, organization: Organization, request: Request):
        return features.has("organizations:actionable-items", organization, actor=request.user)

    @extend_schema(
        operation_id="Debug issues related to source maps and event errors for a given event",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            EventParams.EVENT_ID,
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
        Retrieve information about actionable items (source maps, event errors, etc.) for a given event.
        ```````````````````````````````````````````
        Return a list of actionable items for a given event.
        """

        if not self.has_feature(project.organization, request):
            raise NotFound(
                detail="Endpoint not available without 'organizations:actionable-items' feature flag"
            )

        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        errors = []

        debug_frames = find_debug_frames(event)
        for frame_idx, exception_idx in debug_frames:
            debug_response = source_map_debug(project, event, frame_idx, exception_idx)
            issue, data = debug_response.issue, debug_response.data

            if issue:
                response = SourceMapProcessingIssue(issue, data=data).get_api_context()
                errors.append(response)

        for event_error in event.errors:
            response = EventError(event_error).get_api_context()
            errors.append(response)

        priority_get = lambda x: priority.get(x, len(errors))
        sorted_errors = sorted(errors, key=priority_get)

        return Response({"errors": sorted_errors})


def find_debug_frames(event):
    debug_frames = []
    exceptions = event.exception.values
    seen_filenames = []

    for exception_idx, exception in enumerate(exceptions):
        for frame_idx, frame in enumerate(exception.stacktrace.frames):
            if frame.in_app and frame.filename not in seen_filenames:
                debug_frames.append((frame_idx, exception_idx))
                seen_filenames.append(frame.filename)

    return debug_frames


def get_file_extension(filename):
    segments = filename.split(".")
    if len(segments) > 1:
        return segments[-1]
    return None


def is_frame_filename_pathlike(frame):
    filename = frame.get("absPath", "")
    try:
        filename = filename.split("/").reverse()[0]
    except Exception:
        pass

    return (
        (frame.get("filename") == "<anonymous>" and frame.get("inApp"))
        or frame.get("function") in fileNameBlocklist
        or (filename and not get_file_extension(filename))
    )
