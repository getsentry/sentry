import datetime
import logging

from django.contrib.auth.models import AnonymousUser
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.utils import jwt

logger = logging.getLogger(__name__)

# JWT is valid for 5 minutes
JWT_VALIDITY_WINDOW_SECONDS = 300


@control_silo_endpoint
class OrganizationIntercomJwtEndpoint(ControlSiloOrganizationEndpoint):
    """
    Generates a JWT for Intercom identity verification.

    This endpoint creates a signed JWT that Intercom uses to verify user identity
    in the Intercom Messenger. The JWT includes user and organization information.
    """

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE

    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        """
        Generate a JWT for Intercom identity verification.

        Returns a JWT signed with HS256 containing user identity claims,
        along with user data for the frontend to pass to Intercom.
        """
        if not features.has("organizations:intercom-support", organization):
            return Response(
                {"detail": "Intercom support is not enabled for this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if isinstance(request.user, AnonymousUser):
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        signing_secret = options.get("intercom.identity-verification-secret")
        if not signing_secret:
            logger.warning("intercom.identity-verification-secret is not configured")
            return Response(
                {"detail": "Intercom identity verification is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        user = request.user
        now = int(datetime.datetime.now(datetime.UTC).timestamp())
        exp = now + JWT_VALIDITY_WINDOW_SECONDS

        # Build JWT claims - user_id is required by Intercom
        claims = {
            "user_id": str(user.id),
            "email": user.email,
            "name": user.get_display_name(),
            "iat": now,
            "exp": exp,
        }

        # Generate the JWT using HS256 (required by Intercom)
        token = jwt.encode(claims, signing_secret, algorithm="HS256")

        # Return JWT and user data for frontend to use with Intercom boot
        # Note: RpcUser doesn't have date_joined, so we use last_active as a fallback
        created_at = now
        if hasattr(user, "date_joined") and user.date_joined:
            created_at = int(user.date_joined.timestamp())
        elif hasattr(user, "last_active") and user.last_active:
            created_at = int(user.last_active.timestamp())

        user_data = {
            "userId": str(user.id),
            "email": user.email,
            "name": user.get_display_name(),
            "createdAt": created_at,
            "organizationId": str(organization.id),
            "organizationName": organization.name,
        }

        return Response(
            {
                "jwt": token,
                "userData": user_data,
            },
            status=status.HTTP_200_OK,
        )
