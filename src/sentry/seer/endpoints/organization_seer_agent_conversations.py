from __future__ import annotations

import logging
import re
from typing import Any, Literal

from django.conf import settings
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3.exceptions import HTTPError

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.auth.principal import acting_user_id
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client_utils import has_seer_agent_access_with_detail
from sentry.seer.endpoints.utils import refuse_service_account_token
from sentry.seer.signed_seer_api import SeerViewerContext, make_agent_conversations_request
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

SEER_TIMEOUT = 10

# The URL pattern matches any path segment, so Seer's id format is enforced here.
CONVERSATION_ID_RE = re.compile(r"[A-Za-z0-9_-]+")


class OrganizationSeerAgentConversationPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }

    def has_permission(self, request: Request, view: Any) -> bool:
        if request.method == "POST":
            refuse_service_account_token(request)
        return super().has_permission(request, view)


class OrganizationSeerAgentConversationEndpointBase(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerAgentConversationPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.USER: RateLimit(limit=100, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=1000, window=60),
            },
            "POST": {
                RateLimitCategory.USER: RateLimit(limit=25, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=1000, window=60 * 60),
            },
        }
    )

    def check_access(self, request: Request, organization: Organization) -> None:
        if not features.has("organizations:enable-harness-v2", organization, actor=request.user):
            raise NotFound
        has_access, detail = has_seer_agent_access_with_detail(organization, request.user)
        if not has_access:
            raise PermissionDenied(detail)

    def proxy(
        self,
        request: Request,
        organization: Organization,
        method: Literal["GET", "POST"],
        agent: str,
        conversation_id: str | None = None,
        *,
        messages: bool = False,
    ) -> Response:
        self.check_access(request, organization)
        if conversation_id is not None and not CONVERSATION_ID_RE.fullmatch(conversation_id):
            raise NotFound

        body: dict[str, Any] | None = None
        idempotency_key: str | None = None
        if method == "POST":
            data: object = request.data
            if not isinstance(data, dict):
                return Response({"detail": "Expected a JSON object."}, status=400)
            idempotency_key = request.headers.get("Idempotency-Key")
            if not idempotency_key:
                return Response({"detail": "The Idempotency-Key header is required."}, status=400)
            body = data

        query = request.GET.dict()

        if not settings.SEER_AUTOFIX_URL:
            return Response({"detail": "Seer is not configured."}, status=503)

        try:
            response = make_agent_conversations_request(
                method,
                agent,
                conversation_id,
                messages=messages,
                query=query,
                body=body,
                timeout=SEER_TIMEOUT,
                viewer_context=SeerViewerContext(
                    organization_id=organization.id, user_id=acting_user_id(request.user)
                ),
                idempotency_key=idempotency_key,
            )
        except HTTPError:
            logger.warning("seer.agent_conversations.request_failed", exc_info=True)
            return Response({"detail": "Seer is unavailable."}, status=502)

        if response.status < 300:
            try:
                return Response(response.json(), status=response.status)
            except ValueError:
                logger.warning(
                    "seer.agent_conversations.invalid_response",
                    extra={"status": response.status, "agent": agent},
                )
                return Response({"detail": "Seer is unavailable."}, status=502)

        if response.status >= 500:
            logger.warning(
                "seer.agent_conversations.error_response",
                extra={"status": response.status, "agent": agent},
            )
        try:
            data = response.json()
        except ValueError:
            data = {"detail": "Seer returned an error."}
        return Response(data, status=response.status)


@cell_silo_endpoint
class OrganizationSeerAgentConversationsEndpoint(OrganizationSeerAgentConversationEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization, agent: str) -> Response:
        return self.proxy(request, organization, "GET", agent)

    def post(self, request: Request, organization: Organization, agent: str) -> Response:
        return self.proxy(request, organization, "POST", agent)


@cell_silo_endpoint
class OrganizationSeerAgentConversationDetailsEndpoint(
    OrganizationSeerAgentConversationEndpointBase
):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(
        self, request: Request, organization: Organization, agent: str, conversation_id: str
    ) -> Response:
        return self.proxy(request, organization, "GET", agent, conversation_id)


@cell_silo_endpoint
class OrganizationSeerAgentConversationMessagesEndpoint(
    OrganizationSeerAgentConversationEndpointBase
):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def get(
        self, request: Request, organization: Organization, agent: str, conversation_id: str
    ) -> Response:
        return self.proxy(request, organization, "GET", agent, conversation_id, messages=True)

    def post(
        self, request: Request, organization: Organization, agent: str, conversation_id: str
    ) -> Response:
        return self.proxy(request, organization, "POST", agent, conversation_id, messages=True)
