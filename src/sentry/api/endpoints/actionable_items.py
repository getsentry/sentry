from typing import List, Union

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.actionable_items_helper import (
    deprecated_event_errors,
    errors_to_hide,
    find_debug_frames,
    find_prompts_activity,
    priority_ranking,
)
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

        organization = project.organization
        if not self.has_feature(organization, request):
            raise NotFound(
                detail="Endpoint not available without 'organizations:actionable-items' feature flag"
            )

        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        actions = []

        # Find frames to run debug function on
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

        # Use prompts activity to check if prompt has been dismissed
        features = [x["type"] for x in actions]
        prompts_activity = find_prompts_activity(
            organization.id, project.id, request.user.id, features
        )

        prompt_features = [prompt.feature for prompt in prompts_activity]

        for action in actions:
            action["dismissed"] = False
            if action["type"] in prompt_features:
                prompt = prompts_activity.filter(feature=action["type"]).first()
                dismissed = prompt.data["dismissed_ts"]
                # Check if dismissed within the last week
                if dismissed and timezone.now().timestamp() < int(dismissed) + 60 * 60 * 24 * 7:
                    action["dismissed"] = True
                else:
                    # if dismissed more than a week ago, delete the prompts activity
                    prompt.delete()

        # Currently 25 is the highest priority, so we set the default to 26
        priority_get = lambda x: priority_ranking.get(x["type"], 26)
        sorted_errors = sorted(actions, key=priority_get)

        return Response({"errors": sorted_errors})
