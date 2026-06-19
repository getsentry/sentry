from __future__ import annotations

from dataclasses import dataclass

from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationStrategy,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.notifications.utils.participants import determine_eligible_recipients
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.types.actor import ActorType
from sentry.users.services.user.service import user_service


@dataclass(frozen=True)
class IssueOwnersNotificationStrategy(NotificationStrategy):
    project: Project
    fallthrough_choice: FallthroughChoiceType | None = None
    event: Event | GroupEvent | None = None

    def get_targets(self) -> list[NotificationTarget]:
        recipients = determine_eligible_recipients(
            project=self.project,
            target_type=ActionTargetType.ISSUE_OWNERS,
            event=self.event,
            fallthrough_choice=self.fallthrough_choice,
        )

        user_ids: set[int] = set()
        team_ids: set[int] = set()
        for actor in recipients:
            if actor.actor_type == ActorType.USER:
                user_ids.add(actor.id)
            elif actor.actor_type == ActorType.TEAM:
                team_ids.add(actor.id)

        if team_ids:
            teams = OrganizationMemberTeam.objects.filter(team_id__in=team_ids).select_related(
                "organizationmember"
            )
            for team in teams:
                uid = team.organizationmember.user_id
                if uid is not None:
                    user_ids.add(uid)

        if not user_ids:
            return []

        users = user_service.get_many_by_id(ids=list(user_ids))
        targets: list[NotificationTarget] = []
        for user in users:
            if not user.email:
                continue
            targets.append(
                GenericNotificationTarget(
                    provider_key=NotificationProviderKey.EMAIL,
                    resource_type=NotificationTargetResourceType.EMAIL,
                    resource_id=user.email,
                )
            )
        return targets
