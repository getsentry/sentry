from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.models.group import Group


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
            200: inline_serializer(
                name="ShortIdLookupResponse",
                fields={
                    "organizationSlug": serializers.CharField(),
                    "projectSlug": serializers.CharField(),
                    "groupId": serializers.CharField(),
                    "group": serializers.DictField(),
                    "shortId": serializers.CharField(),
                },
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
                        "assignedTo": None,
                        "count": "1",
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
                        "project": {"id": "2", "name": "Pump Station", "slug": "pump-station"},
                        "shareId": None,
                        "shortId": "PUMP-STATION-1",
                        "status": "unresolved",
                        "statusDetails": {},
                        "subscriptionDetails": None,
                        "title": "This is an example Python exception",
                        "type": "default",
                        "userCount": 0,
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
