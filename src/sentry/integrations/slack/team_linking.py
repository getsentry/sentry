from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

import sentry_sdk
from slack_sdk.errors import SlackApiError

from sentry import analytics
from sentry.identity.services.identity import identity_service
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.analytics import SlackIntegrationIdentityLinked
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.types import (
    ExternalActorSource,
    ExternalProviderEnum,
    ExternalProviders,
    IntegrationProviderSlug,
)
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.notifications.services import notifications_service
from sentry.notifications.types import NotificationSettingEnum
from sentry.users.services.user import RpcUser

ALREADY_LINKED_MESSAGE = "The {slug} team has already been linked to a Slack channel."
SUCCESS_LINKED_MESSAGE = (
    "The {team} team will now receive issue alert notifications in the {channel} channel."
)

TEAM_LINKING_ROLES = frozenset(["admin", "manager", "owner"])


class TeamLinkResult(StrEnum):
    LINKED = "linked"
    ALREADY_LINKED = "already_linked"


class IdentityProviderNotFound(Exception):
    pass


class IdentityNotFound(Exception):
    pass


@dataclass(frozen=True)
class SlackChannel:
    integration: RpcIntegration
    channel_id: str
    channel_name: str


def get_linkable_teams(member: OrganizationMember, user: RpcUser) -> Sequence[Team]:
    """
    Teams the member may link to a Slack channel. Organization admins, managers,
    and owners may link any of their teams; other members may only link teams
    they are a team admin of.
    """
    return Team.objects.get_for_user(
        member.organization, user, is_team_admin=member.role not in TEAM_LINKING_ROLES
    )


def build_team_linked_message(*, team: Team, channel_id: str) -> str:
    """Build the Slack success message after linking a team to a channel."""
    team_url = team.organization.absolute_url(
        f"/settings/{team.organization.slug}/teams/{team.slug}/"
    )
    return SUCCESS_LINKED_MESSAGE.format(
        team=f"<{team_url}|{team.slug}>",
        # Slack channel mentions render as clickable #channel-name.
        channel=f"<#{channel_id}>",
    )


def link_team_to_channel(
    *, team: Team, channel: SlackChannel, slack_user_id: str
) -> TeamLinkResult:
    """
    Route the team's issue alert notifications to the Slack channel and announce
    the outcome in that channel. The Slack user requesting the link must have
    linked their Slack identity to Sentry.
    """
    integration = channel.integration
    _require_slack_identity(integration, slack_user_id)

    try:
        _, created = ExternalActor.objects.get_or_create(
            team_id=team.id,
            organization=team.organization,
            integration_id=integration.id,
            provider=ExternalProviders.SLACK.value,
            defaults=dict(
                external_name=channel.channel_name,
                external_id=channel.channel_id,
                source=ExternalActorSource.MANUAL.value,
            ),
        )
    # The external team API can link one team to several Slack channels, and
    # those rows all match this lookup.
    except ExternalActor.MultipleObjectsReturned:
        created = False

    try:
        analytics.record(
            SlackIntegrationIdentityLinked(
                provider=IntegrationProviderSlug.SLACK.value,
                actor_id=team.id,
                actor_type="team",
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)

    if not created:
        _post_message(channel, ALREADY_LINKED_MESSAGE.format(slug=team.slug))
        return TeamLinkResult.ALREADY_LINKED

    notifications_service.enable_all_settings_for_provider(
        external_provider=ExternalProviderEnum.SLACK,
        team_id=team.id,
        types=[NotificationSettingEnum.ISSUE_ALERTS],
    )
    _post_message(channel, build_team_linked_message(team=team, channel_id=channel.channel_id))

    return TeamLinkResult.LINKED


def _require_slack_identity(integration: RpcIntegration, slack_user_id: str) -> None:
    idp = identity_service.get_provider(
        provider_type=IntegrationProviderSlug.SLACK.value,
        provider_ext_id=integration.external_id,
    )
    if idp is None:
        raise IdentityProviderNotFound

    identity = identity_service.get_identity(
        filter={"provider_id": idp.id, "identity_ext_id": slack_user_id}
    )
    if identity is None:
        raise IdentityNotFound


def _post_message(channel: SlackChannel, text: str) -> None:
    try:
        client = SlackSdkClient(integration_id=channel.integration.id)
        client.chat_postMessage(channel=channel.channel_id, text=text)
    except SlackApiError:
        # The link outcome stands whether or not Slack accepts the message.
        pass
