from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.auth.principal import require_user
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.team_linking import (
    ALREADY_LINKED_MESSAGE,
    INVALID_LINK_MESSAGE,
    IdentityNotFound,
    IdentityProviderNotFound,
    InvalidTeamLinkParams,
    SlackChannel,
    TeamLinkParams,
    TeamLinkResult,
    get_linkable_teams,
    link_team_to_channel,
)
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team


class LinkTeamPermission(OrganizationPermission):
    # Team admins without an elevated organization role may link their own
    # teams, so membership is enough to reach the endpoint. Which teams a
    # member may link is decided by `get_linkable_teams`.
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
    }


class LinkTeamSerializer(serializers.Serializer[None]):
    team = serializers.IntegerField()


@cell_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OrganizationSlackLinkTeamEndpoint(OrganizationEndpoint):
    owner = ApiOwner.MESSAGING_INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (LinkTeamPermission,)

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)

        try:
            params = TeamLinkParams.from_signed(kwargs.pop("signed_params"))
        except InvalidTeamLinkParams:
            raise ParseError(INVALID_LINK_MESSAGE)

        kwargs["params"] = params
        kwargs["channel"] = get_installed_channel(kwargs["organization"], params)
        return args, kwargs

    def get(
        self,
        request: Request,
        organization: Organization,
        params: TeamLinkParams,
        channel: SlackChannel,
    ) -> Response:
        """List the teams the user may link to the Slack channel in the link."""
        team_ids = [team.id for team in get_member_linkable_teams(request, organization)]

        return self.paginate(
            request=request,
            queryset=Team.objects.filter(id__in=team_ids),
            order_by="slug",
            paginator_cls=OffsetPaginator,
            on_results=lambda teams: serialize(teams, request.user),
        )

    def post(
        self,
        request: Request,
        organization: Organization,
        params: TeamLinkParams,
        channel: SlackChannel,
    ) -> Response:
        """Send the team's issue alert notifications to the Slack channel in the link."""
        serializer = LinkTeamSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        team_id = serializer.validated_data["team"]
        team = next(
            (t for t in get_member_linkable_teams(request, organization) if t.id == team_id), None
        )
        # The Django page only accepted sessions. Tokens reach this endpoint
        # with membership-level scopes, so require write access to the team.
        if team is None or not request.access.has_team_scope(team, "team:write"):
            return Response({"detail": "You do not have permission to link this team."}, status=403)

        try:
            result = link_team_to_channel(
                team=team, channel=channel, slack_user_id=params.slack_user_id
            )
        except (IdentityProviderNotFound, IdentityNotFound):
            # The identity checked belongs to the Slack user who ran the
            # command, not the user who opened the link, as in the Django page.
            return Response(
                {
                    "detail": "The Slack account that ran this command isn't linked to Sentry. "
                    "Run /sentry link, then try again."
                },
                status=403,
            )

        if result == TeamLinkResult.ALREADY_LINKED:
            return Response({"detail": ALREADY_LINKED_MESSAGE.format(slug=team.slug)}, status=409)

        return Response(status=201)


def get_installed_channel(organization: Organization, params: TeamLinkParams) -> SlackChannel:
    context = integration_service.organization_context(
        organization_id=organization.id, integration_id=params.integration_id
    )
    integration = context.integration
    org_integration = context.organization_integration

    if (
        integration is None
        or integration.status != ObjectStatus.ACTIVE
        or org_integration is None
        or org_integration.status != ObjectStatus.ACTIVE
    ):
        raise ResourceDoesNotExist(
            detail="The Slack workspace is not installed in this organization."
        )

    return SlackChannel(
        integration=integration,
        channel_id=params.channel_id,
        channel_name=params.channel_name,
    )


def get_member_linkable_teams(request: Request, organization: Organization) -> Sequence[Team]:
    user = require_user(request)
    member = OrganizationMember.objects.filter(organization=organization, user_id=user.id).first()

    if member is None:
        return []

    return get_linkable_teams(member, user)
