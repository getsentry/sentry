from __future__ import annotations

import orjson
import requests
from django.conf import settings
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.seer.seer_setup import get_seer_org_acknowledgement
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class SeerExplorerChatSerializer(serializers.Serializer):
    query = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="The user's query to send to the Seer Explorer.",
    )
    insert_index = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Optional index to insert the message at.",
    )
    message_timestamp = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text="Optional timestamp for the message.",
    )


def _call_seer_explorer_chat(
    organization: Organization,
    run_id: int | None,
    query: str,
    insert_index: int | None = None,
    message_timestamp: float | None = None,
):
    """Call Seer explorer chat endpoint."""
    path = "/v1/automation/explorer/chat"
    body = orjson.dumps(
        {
            "organization_id": organization.id,
            "run_id": run_id,
            "query": query,
            "insert_index": insert_index,
            "message_timestamp": message_timestamp,
        },
        option=orjson.OPT_NON_STR_KEYS,
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()
    return response.json()


def _call_seer_explorer_state(organization: Organization, run_id: int):
    """Call Seer explorer state endpoint."""
    path = "/v1/automation/explorer/state"
    body = orjson.dumps(
        {
            "run_id": run_id,
            "organization_id": organization.id,
        },
        option=orjson.OPT_NON_STR_KEYS,
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()
    return response.json()


@region_silo_endpoint
class OrganizationSeerExplorerChatEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=25, window=60),
            RateLimitCategory.USER: RateLimit(limit=25, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60 * 60),
        },
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=100, window=60),
            RateLimitCategory.USER: RateLimit(limit=100, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=1000, window=60),
        },
    }

    def get(
        self, request: Request, organization: Organization, run_id: int | None = None
    ) -> Response:
        """
        Get the current state of a Seer Explorer session.
        """
        user = request.user
        if not features.has(
            "organizations:gen-ai-features", organization, actor=user
        ) or not features.has("organizations:seer-explorer", organization, actor=user):
            return Response({"detail": "Feature flag not enabled"}, status=400)
        if organization.get_option("sentry:hide_ai_features"):
            return Response(
                {"detail": "AI features are disabled for this organization."}, status=403
            )
        if not get_seer_org_acknowledgement(organization.id):
            return Response(
                {"detail": "Seer has not been acknowledged by the organization."}, status=403
            )

        if not run_id:
            return Response({"session": None}, status=404)

        response_data = _call_seer_explorer_state(organization, run_id)
        return Response(response_data)

    def post(
        self, request: Request, organization: Organization, run_id: int | None = None
    ) -> Response:
        """
        Start a new chat session or continue an existing one.

        Parameters:
        - run_id: Optional session ID to continue an existing session (from URL or request body).
        - query: The user's query.
        - insert_index: Optional index to insert the message at.

        Returns:
        - session_id: The session ID.
        """
        user = request.user
        if not features.has(
            "organizations:gen-ai-features", organization, actor=user
        ) or not features.has("organizations:seer-explorer", organization, actor=user):
            return Response({"detail": "Feature flag not enabled"}, status=400)
        if organization.get_option("sentry:hide_ai_features"):
            return Response(
                {"detail": "AI features are disabled for this organization."}, status=403
            )
        if not get_seer_org_acknowledgement(organization.id):
            return Response(
                {"detail": "Seer has not been acknowledged by the organization."}, status=403
            )

        serializer = SeerExplorerChatSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data
        query = validated_data["query"]
        insert_index = validated_data.get("insert_index")
        message_timestamp = validated_data.get("message_timestamp")

        response_data = _call_seer_explorer_chat(
            organization, run_id, query, insert_index, message_timestamp
        )
        return Response(response_data)
