from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from sentry.integrations.types import ExternalProviders
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.notifications.platform.strategies.utils import get_targets_from_participant_map
from sentry.notifications.platform.types import (
    NotificationStrategy,
    NotificationTarget,
)
from sentry.notifications.services import notifications_service
from sentry.notifications.types import (
    INBOX_NOTIFICATION_SETTINGS,
    GroupSubscriptionReason,
    NotificationSettingEnum,
)
from sentry.notifications.utils.participants import ParticipantMap
from sentry.types.actor import Actor, ActorType


def _get_providers_by_recipient(
    recipients: list[Actor],
    *,
    settings_key: NotificationSettingEnum,
    organization_id: int | None,
    project_ids: list[int] | None,
) -> Mapping[int, Mapping[int, str]]:
    providers_by_recipient = notifications_service.get_participants(
        recipients=recipients,
        type=settings_key,
        project_ids=project_ids,
        organization_id=organization_id,
    )
    if (
        settings_key not in INBOX_NOTIFICATION_SETTINGS
        or settings_key == NotificationSettingEnum.INBOX
    ):
        return providers_by_recipient

    # An Inbox category such as mentions only turns its notifications on or off. The master `inbox`
    # setting picks email and Slack for every category, and turns them all off when set to never.
    enabled_recipient_ids = {
        recipient_id for recipient_id, providers in providers_by_recipient.items() if providers
    }
    if not enabled_recipient_ids:
        return {}

    inbox_providers_by_recipient = notifications_service.get_participants(
        recipients=[recipient for recipient in recipients if recipient.id in enabled_recipient_ids],
        type=NotificationSettingEnum.INBOX,
        project_ids=project_ids,
        organization_id=organization_id,
    )
    return {
        recipient_id: providers
        for recipient_id, providers in inbox_providers_by_recipient.items()
        if recipient_id in enabled_recipient_ids
    }


def _get_participant_map(
    recipients: list[Actor],
    *,
    settings_key: NotificationSettingEnum,
    organization_id: int | None,
    project_ids: list[int] | None,
) -> ParticipantMap:
    participant_map = ParticipantMap()
    if not recipients:
        return participant_map

    providers_by_recipient = _get_providers_by_recipient(
        recipients,
        settings_key=settings_key,
        organization_id=organization_id,
        project_ids=project_ids,
    )
    for recipient in recipients:
        for provider in providers_by_recipient.get(recipient.id, {}):
            participant_map.add(
                ExternalProviders(provider), recipient, GroupSubscriptionReason.implicit
            )
    return participant_map


@dataclass(frozen=True)
class UserRoutingStrategy(NotificationStrategy):
    """
    Inbox settings are user-level and apply to all of a user's organizations, so they're never
    scoped to a project or organization. The organization still picks which members to notify and
    which Slack workspace to use: pass `organization_id`, or a `project` only to pick its
    organization. Every other setting needs a `project` for its project overrides and project email
    addresses.
    """

    user_ids: list[int]
    settings_key: NotificationSettingEnum
    project: Project | None = None
    organization_id: int | None = None

    def __post_init__(self) -> None:
        if self.project is not None:
            return
        if self.organization_id is None:
            raise ValueError("UserRoutingStrategy needs a project or an organization_id")
        if self.settings_key not in INBOX_NOTIFICATION_SETTINGS:
            raise ValueError(
                f"{self.settings_key.value} needs a project; only Inbox settings can use organization_id alone"
            )

    def get_targets(self) -> list[NotificationTarget]:
        organization_id = (
            self.project.organization_id if self.project is not None else self.organization_id
        )
        assert organization_id is not None
        is_inbox = self.settings_key in INBOX_NOTIFICATION_SETTINGS
        settings_project = None if is_inbox else self.project

        user_ids = OrganizationMember.objects.filter(
            organization_id=organization_id,
            user_id__in=self.user_ids,
            user_id__isnull=False,
        ).values_list("user_id", flat=True)
        recipients = [
            actor for user_id in user_ids if (actor := Actor.from_id(user_id=user_id)) is not None
        ]

        participant_map = _get_participant_map(
            recipients,
            settings_key=self.settings_key,
            organization_id=None if is_inbox else organization_id,
            project_ids=[settings_project.id] if settings_project is not None else None,
        )
        return get_targets_from_participant_map(
            participant_map,
            organization_id=organization_id,
            project=settings_project,
        )


@dataclass(frozen=True)
class TeamRoutingStrategy(NotificationStrategy):
    teams: list[Team]
    project: Project
    settings_key: NotificationSettingEnum

    def get_targets(self) -> list[NotificationTarget]:
        teams = [
            team for team in self.teams if team.organization_id == self.project.organization_id
        ]
        team_actors = [Actor.from_object(team) for team in teams]
        participant_map = _get_participant_map(
            team_actors,
            settings_key=self.settings_key,
            organization_id=self.project.organization_id,
            project_ids=[self.project.id],
        )

        # Team email is represented by member fallback, not a shared destination.
        for team in teams:
            participant_map.delete_participant_by_id(
                ExternalProviders.EMAIL, ActorType.TEAM, team.id
            )

        routed_team_ids = {
            actor.id
            for _, actors in participant_map.get_participant_sets()
            for actor in actors
            if actor.actor_type == ActorType.TEAM
        }
        fallback_team_ids = {team.id for team in teams} - routed_team_ids

        targets = get_targets_from_participant_map(
            participant_map,
            organization_id=self.project.organization_id,
            project=self.project,
        )
        if not fallback_team_ids:
            return targets

        fallback_user_ids = [
            user_id
            for user_id in OrganizationMemberTeam.objects.filter(
                team_id__in=fallback_team_ids,
                team__organization_id=self.project.organization_id,
                organizationmember__user_id__isnull=False,
            )
            .values_list("organizationmember__user_id", flat=True)
            .distinct()
            if user_id is not None
        ]
        fallback_targets = UserRoutingStrategy(
            project=self.project,
            user_ids=fallback_user_ids,
            settings_key=self.settings_key,
        ).get_targets()

        return [*targets, *fallback_targets]
