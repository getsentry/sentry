from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.agent import biscuit_token, elevation
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.organization import Organization


class ElevationPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
    }


class ElevationRequestSerializer(serializers.Serializer):
    requestedScopes = serializers.ListField(child=serializers.CharField(), min_length=1)


@cell_silo_endpoint
class OrganizationBiscuitElevationEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (ElevationPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        """Create an elevation request. Returns a URL for the user to approve in-browser."""
        if not features.has(biscuit_token.FEATURE_FLAG, organization, actor=request.user):
            raise ResourceDoesNotExist

        auth = request.auth
        if auth is None or auth.kind != biscuit_token.BISCUIT_TOKEN_KIND:
            return Response({"detail": "Elevation requires a biscuit token."}, status=400)

        serializer = ElevationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)

        raw_token = request.META.get("HTTP_AUTHORIZATION", "").split(" ", 1)[-1]
        claims = biscuit_token.verify_biscuit_token(raw_token)

        if claims.organization_id != organization.id:
            return Response({"detail": "Token was issued for a different organization."}, status=403)

        requested = serializer.validated_data["requestedScopes"]
        allowed = set(claims.max_scopes)
        invalid = set(requested) - allowed
        if invalid:
            return Response(
                {"detail": f"Requested scopes exceed ceiling: {sorted(invalid)}"},
                status=400,
            )

        req = elevation.create_elevation_request(
            session_id=claims.session_id,
            user_id=claims.user_id,
            organization_id=organization.id,
            requested_scopes=sorted(requested),
            max_scopes=claims.max_scopes,
        )

        base_url = settings.SENTRY_OPTIONS.get("system.url-prefix", "").rstrip("/")
        elevation_url = f"{base_url}/agent/elevate/?elevation_id={req.elevation_id}"

        return Response(
            {
                "elevationId": req.elevation_id,
                "url": elevation_url,
                "expiresAt": (
                    (req.created_at + timedelta(seconds=elevation.PENDING_TTL_SECONDS)).isoformat()
                    if req.created_at
                    else None
                ),
            }
        )


@cell_silo_endpoint
class OrganizationBiscuitElevationDetailEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (ElevationPermission,)

    def get(
        self,
        request: Request,
        organization: Organization,
        elevation_id: str,
    ) -> Response:
        """Poll an elevation request's status."""
        if not features.has(biscuit_token.FEATURE_FLAG, organization, actor=request.user):
            raise ResourceDoesNotExist

        auth = request.auth
        if auth is None or auth.kind != biscuit_token.BISCUIT_TOKEN_KIND:
            return Response({"detail": "Polling requires a biscuit token."}, status=400)

        raw_token = request.META.get("HTTP_AUTHORIZATION", "").split(" ", 1)[-1]
        claims = biscuit_token.verify_biscuit_token(raw_token)

        if claims.organization_id != organization.id:
            return Response({"detail": "Token was issued for a different organization."}, status=403)

        req = elevation.get_elevation_request(elevation_id)
        if req is None:
            return Response({"detail": "Elevation request expired or not found."}, status=410)

        if req.user_id != claims.user_id or req.session_id != claims.session_id:
            return Response({"detail": "Elevation request does not match token."}, status=403)

        if req.status == "pending":
            return Response({"status": "pending"})

        if req.status == "denied":
            return Response({"status": "denied"})

        return Response(
            {
                "status": "approved",
                "token": req.elevated_token,
                "scopes": req.requested_scopes,
                "expiresAt": (
                    req.elevated_expires_at.isoformat() if req.elevated_expires_at else None
                ),
            }
        )
