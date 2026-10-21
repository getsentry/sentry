"""Hand Seer a service account's ViewerContext.

The one Seer-only call in the service account API, and the service-account
counterpart of agent token minting. Seer authenticates with its own org-only
ViewerContext and gets back a signed ViewerContext that acts as the service
account, which it sends on its calls to Sentry in place of its own.

It runs in the cell, unlike the management endpoints, because Seer only reaches
its region's Sentry.

Mocked for now: it returns Seer's own org-only ViewerContext, so swapping it in
changes nothing until the service-account actor exists.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TypedDict

from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.organization_service_accounts import (
    FEATURE_FLAG,
    MOCK_SERVICE_ACCOUNT_SCOPES,
    SERVICE_ACCOUNT_ID,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.seer.auth import SeerRpcViewerContextAuthentication
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context


class ServiceAccountViewerContextResponse(TypedDict):
    viewerContext: str
    expiresAt: datetime
    scopes: list[str]


class SeerSystemViewerContextPermission(BasePermission):
    """Only Seer, calling with an org-only ViewerContext for this organization."""

    def has_permission(self, request: Request, view: object) -> bool:
        return isinstance(request.successful_authenticator, SeerRpcViewerContextAuthentication)

    def has_object_permission(self, request: Request, view: object, obj: Organization) -> bool:
        vc = getattr(request, "_seer_rpc_viewer_context", None)
        return vc is not None and vc.user_id is None and vc.organization_id == obj.id


@cell_silo_endpoint
class OrganizationServiceAccountViewerContextEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.COMMUNITY
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
        if not features.has(FEATURE_FLAG, organization):
            raise ResourceDoesNotExist

        ttl = getattr(settings, "VIEWER_CONTEXT_JWT_TTL", 900)
        viewer_context = encode_viewer_context(
            ViewerContext(organization_id=organization.id, actor_type=ActorType.SYSTEM),
            ttl=ttl,
        )
        response: ServiceAccountViewerContextResponse = {
            "viewerContext": viewer_context,
            "expiresAt": timezone.now() + timedelta(seconds=ttl),
            "scopes": MOCK_SERVICE_ACCOUNT_SCOPES,
        }
        return Response(response)
