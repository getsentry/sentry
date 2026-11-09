from typing import TypedDict

from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.agent_handoff.applications import get_handoff_application
from sentry.agent_handoff.codes import HandoffFlow
from sentry.agent_handoff.endpoints.organization_agent_handoff import (
    HANDOFF_SCOPES,
    AgentHandoffPermission,
)
from sentry.agent_handoff.flows import get_flow
from sentry.agent_handoff.runbook import render_agent_runbook
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint
from sentry.api.permissions import DisallowImpersonatedTokenCreation, SentryIsAuthenticated
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import require_user
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)


class AgentHandoffPreviewRequest(TypedDict):
    flow: str


class AgentHandoffPreviewRequestSerializer(CamelSnakeSerializer[AgentHandoffPreviewRequest]):
    flow = serializers.ChoiceField(choices=list(HandoffFlow), default=HandoffFlow.GUIDED_NEXT_STEPS)


class AgentHandoffPreviewResponse(TypedDict):
    markdown: str


@extend_schema(tags=["Organizations"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OrganizationAgentHandoffPreviewEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.VALUE_DISCOVERY
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (
        SentryIsAuthenticated,
        DisallowImpersonatedTokenCreation,
        AgentHandoffPermission,
    )
    requires_user = True
    include_organization_projects = False
    include_organization_teams = False

    @extend_schema(
        operation_id="Preview private agent handoff instructions",
        parameters=[AgentHandoffPreviewRequestSerializer],
        responses={
            200: inline_sentry_response_serializer(
                "AgentHandoffPreview", AgentHandoffPreviewResponse
            )
        },
    )
    def get(
        self,
        request: Request,
        organization: RpcOrganization,
        organization_context: RpcUserOrganizationContext,
    ) -> Response:
        user = require_user(request)
        if organization_context.member is None:
            return Response({"detail": "Organization membership is required."}, status=403)

        serializer = AgentHandoffPreviewRequestSerializer(data=request.query_params.dict())
        serializer.is_valid(raise_exception=True)
        flow = HandoffFlow(serializer.validated_data["flow"])
        application = get_handoff_application(HANDOFF_SCOPES)
        if application is None:
            return Response({"detail": "Agent onboarding is not configured."}, status=503)

        data: AgentHandoffPreviewResponse = {
            "markdown": render_agent_runbook(
                organization_slug=organization.slug,
                organization_name=organization.name,
                user_email=user.email,
                sentry_url=options.get("system.url-prefix"),
                client_id=application.client_id,
                setup_code="<setup-code>",
                flow_instructions=get_flow(flow).preview(),
            )
        }
        return Response(data)
