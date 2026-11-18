from __future__ import annotations

from typing import Annotated, TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import OrganizationSummarySerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.seer.nav_snapshot import describe_condition, visible_nav_links


class NavLinkResponse(TypedDict):
    crumbs: Annotated[
        str,
        ApiDescription(
            "Click path to the page, section headers included, such as "
            "`Explore → Logs`. `<project>` and `<team>` stand for the project or team name"
        ),
    ]
    path: Annotated[
        str,
        ApiDescription(
            "Page path without the organization, such as `/explore/logs/`. `{project_slug}` "
            "and `{team_slug}` stand for the project or team slug"
        ),
    ]
    condition: Annotated[
        str | None,
        ApiDescription(
            "A condition the organization may not meet for the page to show, in words. "
            "Null when the page always shows"
        ),
    ]


class NavLinksResponse(TypedDict):
    # An object, not a paginated list: the pages are a fixed, short list read in one call.
    links: Annotated[list[NavLinkResponse], ApiDescription("Pages the user can navigate to")]


class NavLinksQuerySerializer(serializers.Serializer[dict[str, object]]):
    section = serializers.CharField(required=False)
    includeSubPages = serializers.BooleanField(required=False, allow_null=True, default=None)


@extend_schema(tags=["Seer"])
@cell_silo_endpoint
class OrganizationSeerNavLinksEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="listOrganizationNavLinks",
        summary="List Navigation Links",
        description=(
            "List the Sentry pages the organization's navigation shows the requesting user, "
            "with the click path to each. Pages are filtered by the organization's features "
            "and the user's permissions."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                "section",
                type=str,
                description=(
                    "Only list pages under this top-level section, such as `explore`, "
                    "`issues` or `settings`. Lists every page when no section matches."
                ),
            ),
            OpenApiParameter(
                "includeSubPages",
                type=bool,
                description=(
                    "Include create forms and detail tabs reached from a navigation page. "
                    "Defaults to true when `section` is set, false otherwise."
                ),
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationNavLinksResponse", NavLinksResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[NavLinksResponse] | Response[DetailResponse]:
        query = NavLinksQuerySerializer(data=request.GET)
        if not query.is_valid():
            return Response({"detail": "Invalid query parameters."}, status=400)

        # The same feature list the frontend gets, so pages match what the user sees.
        org_features = serialize(organization, request.user, OrganizationSummarySerializer())[
            "features"
        ]
        links = visible_nav_links(
            org_features,
            request.access.scopes,
            section=query.validated_data.get("section"),
            include_sub_pages=query.validated_data.get("includeSubPages"),
        )
        return Response(
            NavLinksResponse(
                links=[
                    NavLinkResponse(
                        crumbs=link.crumbs,
                        path=link.path,
                        condition=describe_condition(link.pending) if link.pending else None,
                    )
                    for link in links
                ]
            )
        )
