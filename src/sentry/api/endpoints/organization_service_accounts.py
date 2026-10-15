"""Service account APIs.

Every endpoint here is a mock: it validates input and returns canned data with the
final response shape, but persists nothing. They exist so consumers (Seer first) can
integrate against the contract while the real implementation is built behind it.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, TypedDict

from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
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
from sentry.models.organization import Organization
from sentry.seer.auth import SeerRpcViewerContextAuthentication
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context

FEATURE_FLAG = "organizations:service-accounts"

_MOCK_DATE_CREATED = "2026-10-14T00:00:00Z"
_MOCK_ACCOUNT_ID = "1"
_MOCK_ACCOUNT_NAME = "seer-night-shift"
_MOCK_ACCOUNT_SCOPES = ["event:read", "org:read", "project:read"]

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
    isActive: bool
    dateCreated: str


class ServiceAccountViewerContextResponse(TypedDict):
    viewerContext: str
    expiresAt: str


def _mock_account(
    account_id: str = _MOCK_ACCOUNT_ID,
    name: str = _MOCK_ACCOUNT_NAME,
    scopes: list[str] | None = None,
    is_active: bool = True,
) -> ServiceAccountResponse:
    return {
        "id": account_id,
        "name": name,
        "scopes": scopes if scopes is not None else _MOCK_ACCOUNT_SCOPES,
        "isActive": is_active,
        "dateCreated": _MOCK_DATE_CREATED,
    }


class ServiceAccountSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, help_text="The name of the service account.")
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=sorted(settings.SENTRY_SCOPES)),
        allow_empty=False,
        help_text="Scopes granted to the service account. You can only grant scopes you have.",
    )
    isActive = serializers.BooleanField(
        required=False, help_text="Whether the service account can be used. Defaults to true."
    )

    def validate_scopes(self, scopes: list[str]) -> list[str]:
        ungrantable = set(scopes) - self.context["access"].scopes
        if ungrantable:
            raise serializers.ValidationError(
                f"You can't grant scopes you don't have: {', '.join(sorted(ungrantable))}"
            )
        return sorted(set(scopes))


class ServiceAccountPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:admin"],
        "PUT": ["org:admin"],
        "DELETE": ["org:admin"],
    }


class OrganizationServiceAccountEndpointBase(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes: tuple[type[BasePermission], ...] = (ServiceAccountPermission,)

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        if not features.has(FEATURE_FLAG, kwargs["organization"], actor=request.user):
            raise ResourceDoesNotExist
        return args, kwargs


@cell_silo_endpoint
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
    def get(self, request: Request, organization: Organization) -> Response:
        accounts = [_mock_account()]
        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(
                data_fn=lambda offset, limit: accounts[offset : offset + limit]
            ),
        )

    @extend_schema(
        operation_id="Create a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=ServiceAccountSerializer,
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
    def post(self, request: Request, organization: Organization) -> Response:
        serializer = ServiceAccountSerializer(data=request.data, context={"access": request.access})
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        data = serializer.validated_data
        return Response(
            _mock_account(
                name=data["name"],
                scopes=data["scopes"],
                is_active=data.get("isActive", True),
            ),
            status=201,
        )


@cell_silo_endpoint
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
        self, request: Request, organization: Organization, service_account_id: str
    ) -> Response:
        return Response(_mock_account(account_id=service_account_id))

    @extend_schema(
        operation_id="Update a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        request=ServiceAccountSerializer,
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
        self, request: Request, organization: Organization, service_account_id: str
    ) -> Response:
        serializer = ServiceAccountSerializer(
            data=request.data, partial=True, context={"access": request.access}
        )
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        data = serializer.validated_data
        return Response(
            _mock_account(
                account_id=service_account_id,
                name=data.get("name", _MOCK_ACCOUNT_NAME),
                scopes=data.get("scopes"),
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
        self, request: Request, organization: Organization, service_account_id: str
    ) -> Response:
        return Response(status=204)


class SeerSystemViewerContextPermission(BasePermission):
    """Only Seer, calling with an org-only viewer context for this organization."""

    def has_permission(self, request: Request, view: object) -> bool:
        return isinstance(request.successful_authenticator, SeerRpcViewerContextAuthentication)

    def has_object_permission(self, request: Request, view: object, obj: Organization) -> bool:
        vc = getattr(request, "_seer_rpc_viewer_context", None)
        return vc is not None and vc.user_id is None and vc.organization_id == obj.id


@cell_silo_endpoint
class OrganizationServiceAccountViewerContextEndpoint(OrganizationServiceAccountEndpointBase):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SeerRpcViewerContextAuthentication,)
    permission_classes = (SeerSystemViewerContextPermission,)

    @extend_schema(
        operation_id="Get a Service Account Viewer Context",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ServiceAccountViewerContextResponse", ServiceAccountViewerContextResponse
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, organization: Organization, service_account_id: str
    ) -> Response:
        """Return a signed viewer context for the service account.

        Mocked: the viewer context is the same org-only system context Seer already
        uses, so swapping it in changes nothing until the service-account actor exists.
        """
        ttl = getattr(settings, "VIEWER_CONTEXT_JWT_TTL", 900)
        viewer_context = encode_viewer_context(
            ViewerContext(organization_id=organization.id, actor_type=ActorType.SYSTEM),
            ttl=ttl,
        )
        return Response(
            {
                "viewerContext": viewer_context,
                "expiresAt": (timezone.now() + timedelta(seconds=ttl)).isoformat(),
            }
        )
