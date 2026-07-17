from __future__ import annotations

from typing import TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.scim_examples import SCIMExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.utils.http import absolute_uri

from .constants import (
    SCIM_API_LIST,
    SCIM_SCHEMA_GROUP,
    SCIM_SCHEMA_RESOURCE_TYPE,
    SCIM_SCHEMA_USER,
)
from .utils import SCIMApiError, SCIMDiscoveryEndpoint, SCIMListBaseResponse, SCIMMetaResponse


class SCIMResourceTypeResponse(TypedDict):
    schemas: list[str]
    id: str
    name: str
    description: str
    endpoint: str
    schema: str
    meta: SCIMMetaResponse


class SCIMListResourceTypesResponse(SCIMListBaseResponse):
    Resources: list[SCIMResourceTypeResponse]


def build_resource_types(organization: Organization) -> list[SCIMResourceTypeResponse]:
    base = absolute_uri(f"api/0/organizations/{organization.slug}/scim/v2")
    return [
        {
            "schemas": [SCIM_SCHEMA_RESOURCE_TYPE],
            "id": "User",
            "name": "User",
            "description": "SCIM User maps to Sentry Organization Member",
            "endpoint": "/Users",
            "schema": SCIM_SCHEMA_USER,
            "meta": {"resourceType": "ResourceType", "location": f"{base}/ResourceTypes/User"},
        },
        {
            "schemas": [SCIM_SCHEMA_RESOURCE_TYPE],
            "id": "Group",
            "name": "Group",
            "description": "SCIM Group maps to Sentry Team",
            "endpoint": "/Groups",
            "schema": SCIM_SCHEMA_GROUP,
            "meta": {"resourceType": "ResourceType", "location": f"{base}/ResourceTypes/Group"},
        },
    ]


@cell_silo_endpoint
class OrganizationSCIMResourceTypeIndex(SCIMDiscoveryEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="listOrganizationScimV2ResourceTypes",
        summary="List the SCIM Resource Types",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SCIMListResourceTypesResponse", SCIMListResourceTypesResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.LIST_RESOURCE_TYPES,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[SCIMListResourceTypesResponse]:
        """
        List the resource types available via SCIM: User (organization
        members) and Group (teams). Pagination parameters are ignored per
        RFC 7644 section 4; both resource types are always returned.
        """
        self.reject_filter_param(request)
        resource_types = build_resource_types(organization)
        # Static two-element collection: the ListResponse envelope is built
        # inline (typed) rather than via list_api_format, and pagination
        # params are ignored per RFC 7644 §4.
        response_body: SCIMListResourceTypesResponse = {
            "schemas": [SCIM_API_LIST],
            "totalResults": len(resource_types),
            "startIndex": 1,
            "itemsPerPage": len(resource_types),
            "Resources": resource_types,
        }
        return Response(response_body)


@cell_silo_endpoint
class OrganizationSCIMResourceTypeDetails(SCIMDiscoveryEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="getOrganizationScimV2ResourceType",
        summary="Query an Individual SCIM Resource Type",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="resource_type_name",
                location="path",
                required=True,
                type=str,
                description="The SCIM resource type name: `User` or `Group`.",
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SCIMResourceTypeResponse", SCIMResourceTypeResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.RESOURCE_TYPE_DETAILS,
    )
    def get(
        self, request: Request, organization: Organization, resource_type_name: str
    ) -> Response[SCIMResourceTypeResponse]:
        """
        Return a single SCIM resource type by name (`User` or `Group`).
        """
        self.reject_filter_param(request)
        for resource_type in build_resource_types(organization):
            if resource_type["name"] == resource_type_name:
                return Response(resource_type)
        raise SCIMApiError(detail="Resource type not found.", status_code=404)
