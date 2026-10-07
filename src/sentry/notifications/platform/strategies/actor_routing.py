from __future__ import annotations

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
from sentry.notifications.types import GroupSubscriptionReason, NotificationSettingEnum
from sentry.notifications.utils.participants import ParticipantMap
from sentry.types.actor import Actor, ActorType


def _get_participant_map(
    recipients: list[Actor], project: Project, settings_key: NotificationSettingEnum
) -> ParticipantMap:
    participant_map = ParticipantMap()
    if not recipients:
        return participant_map

    providers_by_recipient = notifications_service.get_participants(
        recipients=list(recipients),
        type=settings_key,
        project_ids=[project.id],
        organization_id=project.organization_id,
    )
    for recipient in recipients:
        for provider in providers_by_recipient.get(recipient.id, {}):
            participant_map.add(
                ExternalProviders(provider), recipient, GroupSubscriptionReason.implicit
            )
    return participant_map


@dataclass(frozen=True)
class UserRoutingStrategy(NotificationStrategy):
    project: Project
    user_ids: list[int]
    settings_key: NotificationSettingEnum

    def get_targets(self) -> list[NotificationTarget]:
        user_ids = OrganizationMember.objects.filter(
            organization_id=self.project.organization_id,
            user_id__in=self.user_ids,
            user_id__isnull=False,
        ).values_list("user_id", flat=True)
        recipients = [
            actor for user_id in user_ids if (actor := Actor.from_id(user_id=user_id)) is not None
        ]

        participant_map = _get_participant_map(
            recipients=recipients, project=self.project, settings_key=self.settings_key
        )
        return get_targets_from_participant_map(
            participant_map,
            organization_id=self.project.organization_id,
            project=self.project,
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
            recipients=team_actors, project=self.project, settings_key=self.settings_key
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
