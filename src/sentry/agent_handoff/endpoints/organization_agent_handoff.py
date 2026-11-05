import logging
from typing import TypedDict

from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.agent_handoff.codes import issue_handoff
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationPermission
from sentry.api.permissions import DisallowImpersonatedTokenCreation, SentryIsAuthenticated
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import require_user
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)

# Match OAUTH_SCOPES in getsentry/toolkit's packages/cli/src/lib/oauth.ts.
HANDOFF_SCOPES = (
    "project:read",
    "project:write",
    "project:admin",
    "org:read",
    "org:integrations",
    "event:read",
    "event:write",
    "member:read",
    "team:read",
    "team:write",
    "team:admin",
    "alerts:read",
    "alerts:write",
)


class AgentHandoffResponse(TypedDict):
    prompt: str
    guideUrl: str
    expiresAt: str


class AgentHandoffPermission(OrganizationPermission):
    scope_map = {"POST": ["org:read"]}


@extend_schema(tags=["Organizations"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OrganizationAgentHandoffEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.VALUE_DISCOVERY
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (
        SentryIsAuthenticated,
        DisallowImpersonatedTokenCreation,
        AgentHandoffPermission,
    )
    requires_user = True
    csrf_protect = True
    include_organization_projects = False
    include_organization_teams = False
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.USER: RateLimit(limit=10, window=60),
                RateLimitCategory.IP: RateLimit(limit=30, window=60),
            }
        }
    )

    @extend_schema(
        operation_id="Create a private agent onboarding prompt",
        request=None,
        responses={201: inline_sentry_response_serializer("AgentHandoff", AgentHandoffResponse)},
    )
    def post(
        self,
        request: Request,
        organization: RpcOrganization,
        organization_context: RpcUserOrganizationContext,
    ) -> Response:
        """Create a short-lived private prompt when the user chooses to copy it."""
        user = require_user(request)
        if organization_context.member is None:
            return Response({"detail": "Organization membership is required."}, status=403)

        client_id = options.get("onboarding.agent-handoff.client-id")
        application = ApiApplication.objects.filter(
            client_id=client_id, status=ApiApplicationStatus.active
        ).first()
        if (
            not client_id
            or client_id not in options.get("oauth.setup-code.allowed-client-ids")
            or application is None
            or not application.is_public
            or (
                application.requires_org_level_access
                and not set(HANDOFF_SCOPES).issubset(application.scopes)
            )
        ):
            return Response({"detail": "Agent onboarding is not configured."}, status=503)

        issued = issue_handoff(
            user_id=user.id,
            organization_id=organization.id,
            application_id=application.id,
            scope_list=HANDOFF_SCOPES,
        )
        # Fragments are withheld from HTTP requests, including access logs and previews.
        guide_url = f"{absolute_uri('/onboard/')}#{issued.code}"
        data: AgentHandoffResponse = {
            "prompt": f"Follow these instructions to get started with Sentry:\n{guide_url}",
            "guideUrl": guide_url,
            "expiresAt": issued.expires_at.isoformat(),
        }
        logger.info(
            "agent-handoff.generated",
            extra={"user_id": user.id, "organization_id": organization.id},
        )
        return Response(data, status=201)
