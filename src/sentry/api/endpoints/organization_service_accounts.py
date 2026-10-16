"""Service account APIs.

Every endpoint here is a mock: it validates input and returns canned data with the
final response shape, but persists nothing. They exist so consumers (Seer first) can
integrate against the contract while the real implementation is built behind it.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, NotRequired, TypedDict, cast

from django.conf import settings
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrganizationPermission,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
)

FEATURE_FLAG = "organizations:service-accounts"

_MOCK_DATE_CREATED = datetime(2025, 1, 1, tzinfo=UTC)
_MOCK_SERVICE_ACCOUNT_ID = "1"
_MOCK_SERVICE_ACCOUNT_NAME = "seer-autofix"
MOCK_SERVICE_ACCOUNT_SCOPES = ["event:read", "org:read", "project:read"]

# OIDC scopes describe a human login, so a service account can't hold them.
GRANTABLE_SCOPES = sorted(settings.SENTRY_SCOPES - {"openid", "profile", "email"})

SERVICE_ACCOUNT_ID = OpenApiParameter(
    name="service_account_id",
    description="The ID of the service account.",
    required=True,
    type=str,
    location="path",
)


class ServiceAccountResponse(TypedDict):
    id: str
    name: str
    scopes: list[str]
    projectIds: list[str]
    isActive: bool
    dateCreated: datetime


class ServiceAccountCreateRequestData(TypedDict):
    name: str
    scopes: list[str]
    projectIds: NotRequired[list[int] | None]
    isActive: NotRequired[bool]


class ServiceAccountUpdateRequestData(TypedDict, total=False):
    name: str
    scopes: list[str]
    projectIds: list[int] | None
    isActive: bool


def _mock_service_account(
    service_account_id: str = _MOCK_SERVICE_ACCOUNT_ID,
    name: str = _MOCK_SERVICE_ACCOUNT_NAME,
    scopes: list[str] | None = None,
    project_ids: Sequence[int] = (),
    is_active: bool = True,
) -> ServiceAccountResponse:
    return {
        "id": service_account_id,
        "name": name,
        "scopes": scopes if scopes is not None else MOCK_SERVICE_ACCOUNT_SCOPES,
        "projectIds": [str(project_id) for project_id in project_ids],
        "isActive": is_active,
        "dateCreated": _MOCK_DATE_CREATED,
    }


class ServiceAccountCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, help_text="The name of the service account.")
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=GRANTABLE_SCOPES),
        allow_empty=False,
        help_text="Scopes granted to the service account. You can only grant scopes you have.",
    )
    projectIds = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_null=True,
        help_text=(
            "Projects the service account can access when the organization doesn't have open"
            " membership. Ignored while open membership is on, like team membership for people."
        ),
    )
    isActive = serializers.BooleanField(
        required=False, help_text="Whether the service account can be used. Defaults to true."
    )

    def validate_projectIds(self, project_ids: list[int] | None) -> list[int]:
        if not project_ids:
            return []
        access = self.context["access"]
        grantable = {project.id for project in self.context["organization"].projects}
        if not access.has_global_access:
            grantable &= access.accessible_project_ids
        ungrantable = set(project_ids) - grantable
        if ungrantable:
            raise serializers.ValidationError(
                f"You can't grant access to projects: {', '.join(map(str, sorted(ungrantable)))}"
            )
        return sorted(set(project_ids))

    def validate_scopes(self, scopes: list[str]) -> list[str]:
        ungrantable = set(scopes) - self.context["access"].scopes
        if ungrantable:
            raise serializers.ValidationError(
                f"You can't grant scopes you don't have: {', '.join(sorted(ungrantable))}"
            )
        return sorted(set(scopes))


class ServiceAccountUpdateSerializer(ServiceAccountCreateSerializer):
    name = serializers.CharField(
        max_length=64, required=False, help_text="The name of the service account."
    )
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=GRANTABLE_SCOPES),
        allow_empty=False,
        required=False,
        help_text="Scopes granted to the service account. You can only grant scopes you have.",
    )


class ServiceAccountPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:admin"],
        "PUT": ["org:admin"],
        "DELETE": ["org:admin"],
    }


class OrganizationServiceAccountEndpointBase(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.COMMUNITY
    permission_classes = (ServiceAccountPermission,)

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        if not features.has(FEATURE_FLAG, kwargs["organization"], actor=request.user):
            raise ResourceDoesNotExist
        return args, kwargs


@control_silo_endpoint
class OrganizationServiceAccountIndexEndpoint(OrganizationServiceAccountEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List an Organization's Service Accounts",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "ListServiceAccountsResponse", list[ServiceAccountResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        service_accounts = [_mock_service_account()]
        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(
                data_fn=lambda offset, limit: service_accounts[offset : offset + limit]
            ),
        )

    @extend_schema(
        operation_id="Create a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=ServiceAccountCreateSerializer,
        responses={
            201: inline_sentry_response_serializer(
                "CreateServiceAccountResponse", ServiceAccountResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        serializer = ServiceAccountCreateSerializer(
            data=request.data, context={"access": request.access, "organization": organization}
        )
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        data = cast(ServiceAccountCreateRequestData, serializer.validated_data)
        return Response(
            _mock_service_account(
                name=data["name"],
                scopes=data["scopes"],
                project_ids=data.get("projectIds") or (),
                is_active=data.get("isActive", True),
            ),
            status=201,
        )


@control_silo_endpoint
class OrganizationServiceAccountDetailsEndpoint(OrganizationServiceAccountEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Retrieve a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        responses={
            200: inline_sentry_response_serializer(
                "RetrieveServiceAccountResponse", ServiceAccountResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        service_account_id: str,
    ) -> Response:
        return Response(_mock_service_account(service_account_id=service_account_id))

    @extend_schema(
        operation_id="Update a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        request=ServiceAccountUpdateSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "UpdateServiceAccountResponse", ServiceAccountResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        service_account_id: str,
    ) -> Response:
        serializer = ServiceAccountUpdateSerializer(
            data=request.data,
            partial=True,
            context={"access": request.access, "organization": organization},
        )
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        data = cast(ServiceAccountUpdateRequestData, serializer.validated_data)
        return Response(
            _mock_service_account(
                service_account_id=service_account_id,
                name=data.get("name", _MOCK_SERVICE_ACCOUNT_NAME),
                scopes=data.get("scopes"),
                project_ids=data.get("projectIds") or (),
                is_active=data.get("isActive", True),
            )
        )

    @extend_schema(
        operation_id="Delete a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        service_account_id: str,
    ) -> Response:
        return Response(status=204)
