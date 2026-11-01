"""EXPERIMENT: mint a bearer token for a service account.

The token lets a client outside Sentry (curl, CI, an MCP server) call the API as the
account. See `sentry.service_accounts.tokens` for what it is and its limits.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.service_accounts.endpoints.organization_service_accounts import (
    SERVICE_ACCOUNT_ID,
    OrganizationServiceAccountEndpointBase,
)
from sentry.service_accounts.models import ServiceAccount
from sentry.service_accounts.tokens import (
    DEFAULT_TOKEN_TTL,
    MAX_TOKEN_TTL,
    encode_service_account_token,
)


class ServiceAccountTokenSerializer(serializers.Serializer):
    expiresIn = serializers.IntegerField(
        required=False,
        min_value=60,
        max_value=int(MAX_TOKEN_TTL.total_seconds()),
        help_text="Seconds until the token expires. Defaults to 24 hours, at most 30 days.",
    )


class ServiceAccountTokenResponse(TypedDict):
    token: str
    expiresAt: datetime
    scopes: list[str]


@control_silo_endpoint
class OrganizationServiceAccountTokenEndpoint(OrganizationServiceAccountEndpointBase):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    # A person mints tokens, so an account can't mint its own.
    requires_user = True

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            kwargs["service_account"] = ServiceAccount.objects.get(
                organization_id=kwargs["organization"].id,
                id=kwargs.pop("service_account_id"),
                is_active=True,
            )
        except ServiceAccount.DoesNotExist:
            raise ResourceDoesNotExist
        return args, kwargs

    @extend_schema(
        operation_id="Create a Service Account Token",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        request=ServiceAccountTokenSerializer,
        responses={
            201: inline_sentry_response_serializer(
                "ServiceAccountTokenResponse", ServiceAccountTokenResponse
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
        service_account: ServiceAccount,
    ) -> Response:
        serializer = ServiceAccountTokenSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        expires_in = serializer.validated_data.get("expiresIn")

        token, expires_at = encode_service_account_token(
            service_account_id=service_account.id,
            organization_id=organization.id,
            ttl=timedelta(seconds=expires_in) if expires_in else DEFAULT_TOKEN_TTL,
        )
        response: ServiceAccountTokenResponse = {
            "token": token,
            "expiresAt": expires_at,
            "scopes": sorted(service_account.scope_list),
        }
        return Response(response, status=201)
