"""Service account token management APIs.

Tokens live in control next to `ServiceAccountToken`; each save writes the token's outbox,
which replicates it to the org's cell.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.service_accounts.endpoints.organization_service_accounts import (
    SERVICE_ACCOUNT_ID,
    ServiceAccountScopedEndpointBase,
)
from sentry.service_accounts.models import ServiceAccount, ServiceAccountToken


class ServiceAccountTokenResponse(TypedDict):
    id: str
    name: str
    scopes: list[str]
    tokenLastCharacters: str
    dateCreated: datetime
    dateLastUsed: datetime | None
    dateExpires: datetime | None


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


class ServiceAccountTokenEndpointBase(ServiceAccountScopedEndpointBase):
    # A token outlives whoever minted it, so only a person signed in as themselves may
    # manage tokens, not a service account.
    requires_user = True


@control_silo_endpoint
class OrganizationServiceAccountTokenIndexEndpoint(ServiceAccountTokenEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
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
