"""Service account token management APIs.

Tokens live in control next to `ServiceAccountToken`; each save writes the token's outbox,
which replicates it to the org's cell.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, NotRequired, TypedDict, cast

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import DisallowImpersonatedTokenCreation
from sentry.api.serializers import Serializer, serialize
from sentry.api.utils import generate_locality_url
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import acting_user_id
from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.seer.agent_token import is_agent_auth
from sentry.service_accounts.endpoints.organization_service_accounts import (
    SERVICE_ACCOUNT_ID,
    ServiceAccountPermission,
    ServiceAccountScopedEndpointBase,
)
from sentry.service_accounts.models import MAX_NAME_LENGTH, ServiceAccount, ServiceAccountToken
from sentry.service_accounts.tokens import generate_token, stored_token_fields
from sentry.types.cell import get_locality_name_for_cell
from sentry.utils.security.orgauthtoken_token import SystemUrlPrefixMissingException

DEFAULT_TOKEN_LIFETIME = timedelta(days=30)


class ServiceAccountTokenResponse(TypedDict):
    id: str
    name: str
    scopes: list[str]
    tokenLastCharacters: str
    dateCreated: datetime
    dateLastUsed: datetime | None
    dateExpires: datetime | None
    # Only in the response to the request that creates the token.
    token: NotRequired[str]


class ServiceAccountTokenCreateRequestData(TypedDict):
    name: str
    scopes: list[str]
    expiresAt: NotRequired[datetime | None]


class ServiceAccountTokenSerializer(Serializer[ServiceAccountTokenResponse]):
    def serialize(
        self, obj: ServiceAccountToken, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> ServiceAccountTokenResponse:
        return {
            "id": str(obj.id),
            "name": obj.name,
            "scopes": sorted(obj.scope_list),
            "tokenLastCharacters": obj.token_last_characters,
            "dateCreated": obj.date_added,
            "dateLastUsed": obj.date_last_used,
            "dateExpires": obj.date_expires,
        }


class ServiceAccountTokenCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=MAX_NAME_LENGTH, help_text="The name of the token.")
    scopes = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=False,
        help_text="Scopes granted to the token. Each must be granted to the account and held by you.",
    )
    expiresAt = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="When the token stops working. Defaults to 30 days from now. Send null for a token that never expires.",
    )

    def validate_expiresAt(self, expires_at: datetime | None) -> datetime | None:
        if expires_at is not None and expires_at <= timezone.now():
            raise serializers.ValidationError("The expiration date must be in the future.")
        return expires_at

    def validate_scopes(self, scopes: list[str]) -> list[str]:
        service_account: ServiceAccount = self.context["service_account"]
        missing_on_account = set(scopes) - set(service_account.scope_list)
        if missing_on_account:
            raise serializers.ValidationError(
                "The service account doesn't have scopes: " + ", ".join(sorted(missing_on_account))
            )
        # A token is a bearer credential handed to the caller, so it must not carry
        # scopes the caller couldn't use themselves.
        missing_on_caller = set(scopes) - self.context["access"].scopes
        if missing_on_caller:
            raise serializers.ValidationError(
                "You can't grant scopes you don't have: " + ", ".join(sorted(missing_on_caller))
            )
        return sorted(set(scopes))


class DisallowAgentTokenWrites(BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return request.method in SAFE_METHODS or not is_agent_auth(request.auth)


def _audit_log_data(service_account: ServiceAccount, token: ServiceAccountToken) -> dict[str, Any]:
    # Never the token or its hash.
    return {
        "name": token.name,
        "scopes": sorted(token.scope_list),
        "service_account_id": service_account.id,
        "service_account_name": service_account.name,
    }


class ServiceAccountTokenEndpointBase(ServiceAccountScopedEndpointBase):
    # A token outlives whoever minted it, so only a person signed in as themselves may
    # manage tokens: not a service account, a Seer agent, or an impersonating admin.
    requires_user = True
    permission_classes = (
        ServiceAccountPermission,
        DisallowAgentTokenWrites,
        DisallowImpersonatedTokenCreation,
    )


@control_silo_endpoint
class OrganizationServiceAccountTokenIndexEndpoint(ServiceAccountTokenEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List a Service Account's Tokens",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        responses={
            200: inline_sentry_response_serializer(
                "ListServiceAccountTokensResponse", list[ServiceAccountTokenResponse]
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
        service_account: ServiceAccount,
    ) -> Response:
        """Return the account's active tokens, newest first, without their values."""
        return self.paginate(
            request=request,
            queryset=ServiceAccountToken.objects.filter(
                service_account=service_account,
                organization_id=organization.id,
                date_deactivated__isnull=True,
            ),
            order_by="-id",
            paginator_cls=OffsetPaginator,
            on_results=lambda results: serialize(
                results, request.user, serializer=ServiceAccountTokenSerializer()
            ),
        )

    @extend_schema(
        operation_id="Create a Service Account Token",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        request=ServiceAccountTokenCreateSerializer,
        responses={
            201: inline_sentry_response_serializer(
                "CreateServiceAccountTokenResponse", ServiceAccountTokenResponse
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
        """
        Create a token that acts as the service account. The response includes the token
        in `token`. It's the only time the token is returned.
        """
        serializer = ServiceAccountTokenCreateSerializer(
            data=request.data,
            context={"service_account": service_account, "access": request.access},
        )
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        data = cast(ServiceAccountTokenCreateRequestData, serializer.validated_data)

        cell_name = OrganizationMapping.objects.get(organization_id=organization.id).cell_name
        try:
            token_str = generate_token(
                organization.slug, generate_locality_url(get_locality_name_for_cell(cell_name))
            )
        except SystemUrlPrefixMissingException:
            return Response(
                {"detail": "system.url-prefix is not set. You need to set this to create a token."},
                status=400,
            )
        stored = stored_token_fields(token_str)

        token = ServiceAccountToken.objects.create(
            service_account=service_account,
            organization_id=organization.id,
            name=data["name"],
            scope_list=data["scopes"],
            token_hashed=stored.token_hashed,
            token_last_characters=stored.token_last_characters,
            created_by_id=acting_user_id(request.user),
            date_expires=data.get("expiresAt", timezone.now() + DEFAULT_TOKEN_LIFETIME),
        )

        self.create_audit_entry(
            request,
            organization=organization,
            target_object=token.id,
            event=audit_log.get_event_id("SERVICE_ACCOUNT_TOKEN_ADD"),
            data=_audit_log_data(service_account, token),
        )
        response: ServiceAccountTokenResponse = serialize(
            token, request.user, serializer=ServiceAccountTokenSerializer()
        )
        response["token"] = token_str
        return Response(response, status=201)
