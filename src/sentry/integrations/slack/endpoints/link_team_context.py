from __future__ import annotations

from typing import TypedDict

from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import (
    ControlSiloOrganizationMappingSerializer,
    ControlSiloOrganizationMappingSerializerResponse,
)
from sentry.auth.principal import require_user
from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.slack.team_linking import (
    INVALID_LINK_MESSAGE,
    InvalidTeamLinkParams,
    TeamLinkParams,
)
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping


class SlackLinkTeamContextResponse(TypedDict):
    channelName: str
    channelUrl: str
    organizations: list[ControlSiloOrganizationMappingSerializerResponse]


@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class SlackLinkTeamContextEndpoint(Endpoint):
    owner = ApiOwner.MESSAGING_INTEGRATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    permission_classes = (SentryIsAuthenticated,)

    def get(self, request: Request, signed_params: str) -> Response:
        """
        Describe a `/sentry link team` request: the Slack channel being linked,
        with a deep link back to it, and the user's organizations, across every
        cell, that have the Slack workspace installed.
        """
        try:
            params = TeamLinkParams.from_signed(signed_params)
        except InvalidTeamLinkParams:
            return Response({"detail": INVALID_LINK_MESSAGE}, status=400)

        integration = Integration.objects.filter(
            id=params.integration_id, status=ObjectStatus.ACTIVE
        ).first()
        if integration is None:
            return Response({"detail": "The Slack workspace is no longer installed."}, status=404)

        installed_org_ids = OrganizationIntegration.objects.filter(
            integration_id=params.integration_id, status=ObjectStatus.ACTIVE
        ).values("organization_id")
        member_org_ids = OrganizationMemberMapping.objects.filter(
            user_id=require_user(request).id, organization_id__in=installed_org_ids
        ).values("organization_id")
        organizations = OrganizationMapping.objects.filter(
            organization_id__in=member_org_ids, status=OrganizationStatus.ACTIVE
        ).order_by("name")

        response: SlackLinkTeamContextResponse = {
            "channelName": params.channel_name,
            "channelUrl": f"slack://channel?team={integration.external_id}&id={params.channel_id}",
            "organizations": serialize(
                list(organizations),
                request.user,
                serializer=ControlSiloOrganizationMappingSerializer(),
            ),
        }
        return Response(response)
