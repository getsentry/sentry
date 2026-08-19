from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.agent import biscuit_token
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.organization import Organization
from sentry.seer.agent_token import compute_token_scopes, readonly_scopes


class BiscuitRefreshPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read", "org:write", "org:admin"],
    }


class BiscuitRefreshSerializer(serializers.Serializer):
    requestedScopes = serializers.ListField(
        child=serializers.CharField(), required=False, default=None
    )


@cell_silo_endpoint
class OrganizationBiscuitTokenRefreshEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (BiscuitRefreshPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        """Self-renew a biscuit token.

        Without ``requestedScopes``, returns baseline read-only (auto-decay).
        With ``requestedScopes``, includes any matching active write grants.
        Scopes are always capped by the token's max_scopes ceiling.
        """
        if not features.has(biscuit_token.FEATURE_FLAG, organization, actor=request.user):
            raise ResourceDoesNotExist

        auth = request.auth
        if auth is None or auth.kind != biscuit_token.BISCUIT_TOKEN_KIND:
            return Response({"detail": "Refresh requires a biscuit token."}, status=400)

        raw_token = request.META.get("HTTP_AUTHORIZATION", "").split(" ", 1)[-1]
        claims = biscuit_token.verify_biscuit_token(raw_token)

        if claims.organization_id != organization.id:
            return Response({"detail": "Token was issued for a different organization."}, status=403)

        serializer = BiscuitRefreshSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)

        requested = serializer.validated_data.get("requestedScopes")
        if requested:
            # Cap to max_scopes ceiling
            allowed = set(claims.max_scopes)
            requested = [s for s in requested if s in allowed]
        else:
            requested = sorted(readonly_scopes())

        scopes = compute_token_scopes(
            caller_scopes=set(claims.max_scopes),
            organization_id=organization.id,
            user_id=claims.user_id,
            session_id=claims.session_id,
            requested_scopes=requested,
        )

        token, expires_at = biscuit_token.mint_biscuit_token(
            user_id=claims.user_id,
            organization_id=organization.id,
            scopes=scopes,
            session_id=claims.session_id,
            max_scopes=claims.max_scopes,
        )
        return Response(
            {
                "token": token,
                "expiresAt": expires_at.isoformat(),
                "scopes": scopes,
                "maxScopes": claims.max_scopes,
            }
        )
