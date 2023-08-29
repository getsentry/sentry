from typing import List, Union

from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.actionable_items_helper import (
    ActionPriority,
    deprecated_event_errors,
    errors_to_hide,
    find_debug_frames,
    priority_ranking,
    sourcemap_sdks,
)
from sentry.api.helpers.source_map_helper import source_map_debug
from sentry.models import EventError, Organization, Project, SourceMapProcessingIssue


class ActionableItemResponse(TypedDict):
    type: str
    message: str
    data: Union[dict, None]


class SourceMapProcessingResponse(TypedDict):
    errors: List[ActionableItemResponse]


# This endpoint is used to retrieve actionable items that a user can perform on an event. It is a private endpoint
# that is only used by the Sentry UI. The Source Map Debugging endpoint will remain public as it will only ever
# return information about the source map debugging process while this endpoint will grow. Actionable items are
# errors or messages we show to users about problems with their event which we will show the user how to fix.
@region_silo_endpoint
class ActionableItemsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES

    def has_feature(self, organization: Organization, request: Request):
        return features.has("organizations:actionable-items", organization, actor=request.user)

    def get(self, request: Request, project: Project, event_id: str) -> Response:
        # Retrieve information about actionable items (source maps, event errors, etc.) for a given event.
        organization = project.organization
        if not self.has_feature(organization, request):
            raise NotFound(
                detail="Endpoint not available without 'organizations:actionable-items' feature flag"
            )

        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        actions = []
        debug_frames = []

        sdk_info = event.data.get("sdk")
        # Find debug frames if event has frontend js sdk
        if sdk_info and sdk_info["name"] in sourcemap_sdks:
            debug_frames = find_debug_frames(event)

        for frame_idx, exception_idx in debug_frames:
            debug_response = source_map_debug(project, event.event_id, exception_idx, frame_idx)
            issue, data = debug_response.issue, debug_response.data

            if issue:
                response = SourceMapProcessingIssue(issue, data=data).get_api_context()
                actions.append(response)

        event_errors = event.data.get("errors", [])

        # Add event errors to actionable items
        for event_error in event_errors:
            if (
                event_error["type"] in errors_to_hide
                or event_error["type"] in deprecated_event_errors
            ):
                continue
            response = EventError(event_error).get_api_context()

            actions.append(response)

        priority_get = lambda x: priority_ranking.get(x["type"], ActionPriority.UNKNOWN)
        sorted_errors = sorted(actions, key=priority_get)

        return Response({"errors": sorted_errors})
