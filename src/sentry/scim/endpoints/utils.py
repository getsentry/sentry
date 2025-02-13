from __future__ import annotations

from collections.abc import Iterable
from typing import TypedDict

import sentry_sdk
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import APIException, ParseError
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.renderers import BaseRenderer
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.auth.services.auth import auth_service
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext

from .constants import SCIM_400_INVALID_FILTER, SCIM_API_ERROR, SCIM_API_LIST

SCIM_CONTENT_TYPES = ["application/json", "application/json+scim"]
ACCEPTED_FILTERED_KEYS = ["userName", "value", "displayName"]


class SCIMApiError(APIException):
    def __init__(self, detail, status_code=400):
        transaction = sentry_sdk.Scope.get_current_scope().transaction
        if transaction is not None:
            transaction.set_tag("http.status_code", status_code)
        super().__init__({"schemas": [SCIM_API_ERROR], "detail": detail})
        self.status_code = status_code


class SCIMFilterError(ValueError):
    pass


class SCIMClientNegotiation(BaseContentNegotiation):
    # SCIM uses the content type "application/json+scim"
    # which is just json for our purposes.
    def select_parser(self, request: Request, parsers):
        """
        Select the first parser in the `.parser_classes` list.
        """
        for parser in parsers:
            if parser.media_type in SCIM_CONTENT_TYPES:
                return parser

    def select_renderer(
        self, request: Request, renderers: Iterable[BaseRenderer], format_suffix: str | None = None
    ) -> tuple[BaseRenderer, str] | None:
        """
        Select the first renderer in the `.renderer_classes` list.
        """
        for renderer in renderers:
            if renderer.media_type in SCIM_CONTENT_TYPES:
                return (renderer, renderer.media_type)
        return None


class SCIMQueryParamSerializer(serializers.Serializer):
    # SCIM API parameters are standardized camelCase by RFC7644.
    # We convert them to snake_case using the source field

    startIndex = serializers.IntegerField(
        min_value=1,
        required=False,
        default=1,
        source="start_index",
        help_text="SCIM 1-offset based index for pagination.",
    )
    count = serializers.IntegerField(
        min_value=0,
        required=False,
        default=100,
        help_text="The maximum number of results the query should return, maximum of 100.",
    )
    filter = serializers.CharField(
        required=False,
        default=None,
        help_text="A SCIM filter expression. The only operator currently supported is `eq`.",
    )
    excludedAttributes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=[],
        source="excluded_attributes",
        help_text="Fields that should be left off of return values. Right now the only supported field for this query is members.",
    )

    def validate_filter(self, filter):
        try:
            filter = parse_filter_conditions(filter)
        except SCIMFilterError:
            raise serializers.ValidationError("invalid filter")
        return filter


class OrganizationSCIMPermission(OrganizationPermission):
    def has_object_permission(
        self,
        request: Request,
        view,
        organization: Organization | RpcOrganization | RpcUserOrganizationContext,
    ) -> bool:
        result = super().has_object_permission(request, view, organization)
        # The scim endpoints should only be used in conjunction with a SAML2 integration
        if not result:
            return result
        if isinstance(organization, RpcUserOrganizationContext):
            organization = organization.organization
        provider = auth_service.get_auth_provider(organization_id=organization.id)
        return provider is not None and provider.flags.scim_enabled


class OrganizationSCIMMemberPermission(OrganizationSCIMPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:write", "member:admin"],
        "PATCH": ["member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        "DELETE": ["member:admin"],
    }


class OrganizationSCIMTeamPermission(OrganizationSCIMPermission):
    scope_map = {
        "GET": ["team:read", "team:write", "team:admin"],
        "POST": ["team:write", "team:admin"],
        "PATCH": ["team:write", "team:admin"],
        "DELETE": ["team:admin"],
    }


class SCIMListBaseResponse(TypedDict):
    schemas: list[str]
    totalResults: int
    startIndex: int
    itemsPerPage: int


@extend_schema(tags=["SCIM"])
class SCIMEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ENTERPRISE
    content_negotiation_class = SCIMClientNegotiation
    cursor_name = "startIndex"

    def add_cursor_headers(self, request: Request, response, cursor_result):
        pass

    def list_api_format(self, results, total_results, start_index):
        return {
            "schemas": [SCIM_API_LIST],
            "totalResults": total_results,  # TODO: audit perf of queryset.count()
            "startIndex": start_index,
            "itemsPerPage": len(results),  # what's max?
            "Resources": results,
        }

    def get_query_parameters(self, request: Request):
        serializer = SCIMQueryParamSerializer(data=request.GET)
        if not serializer.is_valid():
            if "filter" in serializer.errors:
                # invalid filter needs to return a specific formatted
                # error response
                raise ParseError(detail=SCIM_400_INVALID_FILTER)
            raise ParseError(serializer.errors)

        return serializer.validated_data


def parse_filter_conditions(raw_filters):
    """
    this function parses a scim filter, see:
    https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.2

    right now the only subset of that filtering we support is the simple "eq"
    operator. the input would look like so:
    userName eq "test.user@okta.local"

    We may want to support further SCIM grammar for other IDPs and may use
    a package to replace this functionality.
    """
    # TODO: support "and" operator
    # TODO: support email querying/filtering
    # TODO: graceful error handling when unsupported operators are used

    if raw_filters is None:
        return None

    try:
        conditions = raw_filters.split(",")
    except ValueError:
        raise SCIMFilterError

    # we don't support multiple filters right now.
    if len(conditions) > 1:
        raise SCIMFilterError

    condition = conditions[0]
    try:
        [key, value] = condition.split(" eq ")
    except ValueError:
        raise SCIMFilterError

    if not key or not value:
        raise SCIMFilterError
    key = key.strip()
    value = value.strip()

    # remove encasing quotes around the value
    value = value[1:-1]

    if key not in ACCEPTED_FILTERED_KEYS:
        raise SCIMFilterError
    if key == "value":
        value = int(value)

    return value
