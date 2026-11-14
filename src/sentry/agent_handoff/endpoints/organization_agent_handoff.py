import logging
from typing import Any, TypedDict

from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.agent_handoff.applications import get_handoff_application
from sentry.agent_handoff.codes import HandoffContext, HandoffFlow, issue_handoff
from sentry.agent_handoff.flows import get_flow
from sentry.analytics.events.agent_handoff import AgentHandoffPromptCreatedEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationPermission
from sentry.api.permissions import DisallowImpersonatedTokenCreation, SentryIsAuthenticated
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.apidocs.constants import RESPONSE_FORBIDDEN
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import require_user
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


class AgentHandoffRequest(TypedDict):
    flow: str
    context: HandoffContext
    disable_ip_pinning: bool


class AgentHandoffRequestSerializer(CamelSnakeSerializer[AgentHandoffRequest]):
    flow = serializers.ChoiceField(choices=list(HandoffFlow), default=HandoffFlow.GUIDED_NEXT_STEPS)
    disable_ip_pinning = serializers.BooleanField(default=False)

    # DRF reserves Serializer.context for rendering metadata.
    def get_fields(self) -> dict[str, serializers.Field[Any, Any, Any, Any]]:
        return {
            **super().get_fields(),
            "context": serializers.JSONField(required=False, allow_null=True, default=None),
        }

    def validate(self, attrs: AgentHandoffRequest) -> AgentHandoffRequest:
        context_serializer = get_flow(HandoffFlow(attrs["flow"])).get_context_serializer()
        if context_serializer is None:
            if attrs["context"] is not None:
                raise serializers.ValidationError(
                    {"context": ["Context is not supported for this flow."]}
                )

            return attrs

        serializer = context_serializer(data=attrs["context"], context=self.context)
        try:
            # The enclosing serializer owns error-key casing for nested fields.
            context = serializer.run_validation(serializer.initial_data)
        except serializers.ValidationError as error:
            raise serializers.ValidationError({"context": error.detail}) from error

        return {**attrs, "context": context}


class AgentHandoffResponse(TypedDict):
    code: str
    prompt: str
    guideUrl: str
    expiresAt: str


class AgentHandoffPermission(OrganizationPermission):
    scope_map = {"GET": ["org:read"], "POST": ["org:read"]}


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
        request=AgentHandoffRequestSerializer,
        responses={
            201: inline_sentry_response_serializer("AgentHandoff", AgentHandoffResponse),
            403: RESPONSE_FORBIDDEN,
        },
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

        serializer = AgentHandoffRequestSerializer(
            data=request.data, context={"user_id": user.id, "organization_id": organization.id}
        )
        serializer.is_valid(raise_exception=True)

        application = get_handoff_application(HANDOFF_SCOPES)
        if application is None:
            return Response({"detail": "Agent onboarding is not configured."}, status=503)

        values = serializer.validated_data
        flow = HandoffFlow(values["flow"])
        issued = issue_handoff(
            flow=flow,
            context=values["context"],
            user_id=user.id,
            organization_id=organization.id,
            application_id=application.id,
            scope_list=HANDOFF_SCOPES,
            ip_address=request.META["REMOTE_ADDR"],
            disable_ip_pinning=serializer.validated_data["disable_ip_pinning"],
        )
        guide_url = absolute_uri(reverse("sentry-agent-handoff"))
        data: AgentHandoffResponse = {
            "code": issued.code,
            "prompt": (
                f"Follow the instructions verbatim at {guide_url}. "
                f"Your handoff code is `{issued.code}`."
            ),
            "guideUrl": guide_url,
            "expiresAt": issued.expires_at.isoformat(),
        }
        logger.info(
            "agent-handoff.generated",
            extra={"user_id": user.id, "organization_id": organization.id},
        )
        analytics.record(
            AgentHandoffPromptCreatedEvent(
                user_id=user.id,
                organization_id=organization.id,
                flow=flow.value,
                run_id=values["context"].run_id if values["context"] is not None else None,
                ip_pinning=not values["disable_ip_pinning"],
            )
        )
        return Response(data, status=201)
