from typing import TypedDict

from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.group import Group


class ShortIdLookupResponse(TypedDict):
    organizationSlug: str
    projectSlug: str
    groupId: str
    group: BaseGroupSerializerResponse
    shortId: str


@extend_schema(tags=["Organizations"])
@region_silo_endpoint
class ShortIdLookupEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Resolve a Short ID",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="issue_id",
                description="The short ID of the issue to resolve.",
                required=True,
                type=str,
                location="path",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ShortIdLookupResponse",
                ShortIdLookupResponse,
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                name="Short ID Lookup",
                value={
                    "group": {
                        "annotations": [],
                        "assignedTo": {
                            "id": "1",
                            "name": "John Doe",
                            "username": "johndoe",
                            "email": "john@example.com",
                            "avatarUrl": "https://secure.gravatar.com/avatar/1234567890abcdef",
                            "isActive": True,
                            "hasPasswordAuth": True,
                            "isManaged": False,
                            "dateJoined": "2018-01-01T00:00:00Z",
                            "lastLogin": "2023-12-01T10:00:00Z",
                            "has2fa": False,
                            "lastActive": "2023-12-01T10:00:00Z",
                            "isSuperuser": False,
                            "isStaff": False,
                            "experiments": {},
                            "emails": [
                                {"id": "1", "email": "john@example.com", "is_verified": True}
                            ],
                            "avatar": {
                                "avatarType": "letter_avatar",
                                "avatarUuid": None,
                                "avatarUrl": None,
                            },
                        },
                        "count": 1,
                        "culprit": "raven.scripts.runner in main",
                        "firstSeen": "2018-11-06T21:19:55Z",
                        "hasSeen": False,
                        "id": "1",
                        "isBookmarked": False,
                        "isPublic": False,
                        "isSubscribed": True,
                        "lastSeen": "2018-11-06T21:19:55Z",
                        "level": "error",
                        "logger": None,
                        "metadata": {"title": "This is an example Python exception"},
                        "numComments": 0,
                        "permalink": "https://sentry.io/the-interstellar-jurisdiction/pump-station/issues/1/",
                        "project": {
                            "id": "2",
                            "name": "Pump Station",
                            "slug": "pump-station",
                            "platform": "python",
                        },
                        "shareId": "abc123",
                        "shortId": "PUMP-STATION-1",
                        "status": "unresolved",
                        "statusDetails": {},
                        "subscriptionDetails": None,
                        "title": "This is an example Python exception",
                        "type": "default",
                        "userCount": 0,
                        "issueCategory": "error",
                        "issueType": "error",
                        "platform": "python",
                        "priority": "medium",
                        "priorityLockedAt": None,
                        "seerFixabilityScore": 0.5,
                        "seerAutofixLastTriggered": None,
                        "substatus": "ongoing",
                    },
                    "groupId": "1",
                    "organizationSlug": "the-interstellar-jurisdiction",
                    "projectSlug": "pump-station",
                    "shortId": "PUMP-STATION-1",
                },
            )
        ],
    )
    def get(self, request: Request, group: Group) -> Response:
        """
        Resolve a short ID to the project slug and group details.
        """
        return Response(
            {
                "organizationSlug": group.project.organization.slug,
                "projectSlug": group.project.slug,
                "groupId": str(group.id),
                "group": serialize(group, request.user),
                "shortId": group.qualified_short_id,
            }
        )
