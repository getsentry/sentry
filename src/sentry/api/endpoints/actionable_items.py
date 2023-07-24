from typing import List, Union

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EventParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import Organization, Project


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

        if not self.has_feature(project.organization, request):
            raise NotFound(
                detail="Endpoint not available without 'organizations:actionable-items' feature flag"
            )

        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        return Response({"errors": []})
