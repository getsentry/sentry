from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.agent import biscuit_token
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.models.organization import Organization
from sentry.seer import agent_token


class BiscuitTokenRequestSerializer(serializers.Serializer):
    sessionId = serializers.CharField(max_length=128)
    requestedScopes = serializers.ListField(child=serializers.CharField(), required=False)
    maxScopes = serializers.ListField(child=serializers.CharField(), required=False)


class BiscuitTokenResponseSerializer(serializers.Serializer):
    token = serializers.CharField()
    expiresAt = serializers.DateTimeField()
    scopes = serializers.ListField(child=serializers.CharField())
    maxScopes = serializers.ListField(child=serializers.CharField())


class BiscuitTokenPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read", "org:write", "org:admin"],
    }


@cell_silo_endpoint
class OrganizationBiscuitTokenEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (BiscuitTokenPermission,)

    @extend_schema(
        operation_id="Mint a biscuit agent capability token",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=BiscuitTokenRequestSerializer,
        responses={
            200: BiscuitTokenResponseSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        if not features.has(biscuit_token.FEATURE_FLAG, organization, actor=request.user):
            raise ResourceDoesNotExist

        minting_principal = agent_token.resolve_minting_principal(request.user, request.auth)
        if not agent_token.is_mintable_agent_principal(minting_principal):
            raise PermissionDenied("Minting requires a user principal.")

        data: Any = request.data
        if not isinstance(data, Mapping):
            return Response({"detail": "Request body must be an object."}, status=400)

        serializer = BiscuitTokenRequestSerializer(data=data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        validated = serializer.validated_data
        session_id = validated["sessionId"]
        requested_scopes = validated.get("requestedScopes")
        max_scopes_input = validated.get("maxScopes")

        user_id = minting_principal.id
        caller_scopes = set(request.access.scopes)

        scopes = agent_token.compute_token_scopes(
            caller_scopes=caller_scopes,
            organization_id=organization.id,
            user_id=user_id,
            session_id=session_id,
            requested_scopes=requested_scopes,
        )

        if max_scopes_input is not None:
            max_scopes = sorted(set(max_scopes_input) & caller_scopes)
        else:
            max_scopes = sorted(caller_scopes)

        token, expires_at = biscuit_token.mint_biscuit_token(
            user_id=user_id,
            organization_id=organization.id,
            scopes=scopes,
            session_id=session_id,
            max_scopes=max_scopes,
            ttl=biscuit_token.INITIAL_TOKEN_TTL,
        )
        return Response(
            {
                "token": token,
                "expiresAt": expires_at.isoformat(),
                "scopes": scopes,
                "maxScopes": max_scopes,
            }
        )
