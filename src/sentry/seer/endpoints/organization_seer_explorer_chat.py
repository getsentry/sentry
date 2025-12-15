from __future__ import annotations

import logging

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.models import SeerPermissionError
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


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
    on_page_context = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Optional context from the user's screen.",
    )


class OrganizationSeerExplorerChatPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }


@region_silo_endpoint
class OrganizationSeerExplorerChatEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
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
    )
    permission_classes = (OrganizationSeerExplorerChatPermission,)

    def get(
        self, request: Request, organization: Organization, run_id: int | None = None
    ) -> Response:
        """
        Get the current state of a Seer Explorer session.
        """
        if not run_id:
            return Response({"session": None}, status=404)

        try:
            client = SeerExplorerClient(organization, request.user)
            state = client.get_run(run_id=int(run_id))
            return Response({"session": state.dict()})
        except SeerPermissionError as e:
            raise PermissionDenied(e.message) from e
        except ValueError:
            logger.exception("Error getting Explorer run state")
            return Response({"session": None}, status=404)

    def post(
        self, request: Request, organization: Organization, run_id: int | None = None
    ) -> Response:
        """
        Start a new chat session or continue an existing one.

        Parameters:
        - run_id: Optional session ID to continue an existing session (from URL).
        - query: The user's query.
        - insert_index: Optional index to insert the message at.
        - on_page_context: Optional context from the user's screen.

        Returns:
        - run_id: The run ID.
        """
        serializer = SeerExplorerChatSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data
        query = validated_data["query"]
        insert_index = validated_data.get("insert_index")
        on_page_context = validated_data.get("on_page_context")

        try:
            client = SeerExplorerClient(
                organization,
                request.user,
                is_interactive=True,
                enable_coding=True,
            )
            if run_id:
                # Continue existing conversation
                result_run_id = client.continue_run(
                    run_id=int(run_id),
                    prompt=query,
                    insert_index=insert_index,
                    on_page_context=on_page_context,
                )
            else:
                # Start new conversation
                result_run_id = client.start_run(
                    prompt=query,
                    on_page_context=on_page_context,
                )
            return Response({"run_id": result_run_id})
        except SeerPermissionError as e:
            raise PermissionDenied(e.message) from e
