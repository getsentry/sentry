from __future__ import annotations

import logging

import sentry_sdk
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.conduit.auth import get_conduit_credentials
from sentry.conduit.channel import channel_id_for_seer_run
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client_utils import has_seer_agent_access_with_detail
from sentry.seer.endpoints.utils import resolve_seer_run
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class ConduitCredentialsSerializer(serializers.Serializer):
    token = serializers.CharField()
    channel_id = serializers.UUIDField()
    url = serializers.URLField()


class ConduitCredentialsResponseSerializer(serializers.Serializer):
    conduit = ConduitCredentialsSerializer()


class OrganizationSeerExplorerStreamPermission(OrganizationPermission):
    scope_map = {
        # Reading a run's output. POST only because minting a credential is a
        # side-effecting operation, not because it mutates the run.
        "POST": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationSeerExplorerStreamCredentialsEndpoint(OrganizationEndpoint):
    """Mint the credentials a browser needs to stream a Seer run from Conduit.

    This is the authorization boundary for streaming. Conduit's gateway will serve
    any channel to anyone holding a token whose ``org_id``/``channel_id`` claims
    match, and only Sentry can sign one -- so the checks here are what stand between
    a user and another org's agent output. They deliberately mirror the GET on
    ``OrganizationSeerAgentChatEndpoint``: anything you can stream, you can already
    poll.

    Shaped for ``conduit-client``, which POSTs this URL to start a stream and again
    on every reconnect. Tokens are therefore short-lived by design (10 min) with no
    refresh path -- a reconnect just mints a new one.
    """

    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerExplorerStreamPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            # Sized for connects and reconnects, not messages -- the stream itself
            # costs nothing here. Generous enough to survive a flapping network
            # without locking a user out of their own conversation.
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=60, window=60),
                RateLimitCategory.USER: RateLimit(limit=60, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=600, window=60),
            },
        }
    )

    def post(self, request: Request, organization: Organization, run_id: str) -> Response:
        """
        Return the token, channel, and gateway URL for streaming ``run_id``.
        """
        if not features.has(
            "organizations:seer-explorer-conduit", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        has_agent_access, error = has_seer_agent_access_with_detail(organization, request.user)
        has_seer_access, _ = has_seer_access_with_detail(organization, request.user)
        if not has_agent_access and not has_seer_access:
            raise PermissionDenied(error)

        resolved = resolve_seer_run(run_id, organization)
        if isinstance(resolved, Response):
            # A run that isn't resolvable yet (still mirroring, or failed) has nothing
            # to stream. The client falls back to polling, which is what surfaces those
            # states to the user anyway.
            return resolved

        try:
            credentials = get_conduit_credentials(
                organization.id,
                # Derived, not minted: the browser must land on the channel Seer is
                # already publishing to, and must return to it after a reconnect.
                channel_id=channel_id_for_seer_run(resolved.seer_run_state_id),
                referrer="seer-explorer",
            )
        except ValueError as e:
            # Conduit isn't configured. Not an error the user can act on, and not
            # fatal -- the client keeps polling.
            sentry_sdk.capture_exception(e, level="warning")
            return Response(
                {"detail": "Streaming is unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = ConduitCredentialsResponseSerializer({"conduit": credentials._asdict()})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
