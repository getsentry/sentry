from __future__ import annotations

from dataclasses import dataclass

from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner
from sentry.models.team import Team
from sentry.notifications.platform.strategies.actor_routing import (
    TeamRoutingStrategy,
    UserRoutingStrategy,
)
from sentry.notifications.platform.types import NotificationStrategy, NotificationTarget
from sentry.notifications.types import NotificationSettingEnum


@dataclass(frozen=True)
class IssueOwnersActivityAlertStrategy(NotificationStrategy):
    """
    Strategy for sending activity alerts to Issue Owners.
    A bit different than that used for GroupEvent alerts, since determine_eligible_recipients
    cannot be used here, we don't have an event to parse.
    """

    group: Group

    def get_targets(self) -> list[NotificationTarget]:
        user_ids, team_ids = self.get_issue_owner_ids()
        project = self.group.project
        teams = list(Team.objects.filter(id__in=team_ids, organization_id=project.organization_id))

        targets = UserRoutingStrategy(
            project=project,
            user_ids=list(user_ids),
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()
        targets.extend(
            TeamRoutingStrategy(
                project=project,
                teams=teams,
                settings_key=NotificationSettingEnum.ISSUE_ALERTS,
            ).get_targets()
        )

        deduplicated_targets: list[NotificationTarget] = []
        for target in targets:
            if target not in deduplicated_targets:
                deduplicated_targets.append(target)
        return deduplicated_targets

    def get_issue_owner_ids(self) -> tuple[set[int], set[int]]:
        """
        Returns a tuple of (user_ids, team_ids) based on the issue owners.
        If a GroupAssignee is set, it will be the only identifier returned.
        If not, it will return the identifiers of the GroupOwners.
        """
        user_ids: set[int] = set()
        team_ids: set[int] = set()

        assignee = GroupAssignee.objects.filter(group=self.group).first()
        if assignee is not None:
            if assignee.user_id is not None:
                user_ids.add(assignee.user_id)
            elif assignee.team_id is not None:
                team_ids.add(assignee.team_id)
            return user_ids, team_ids

        owners = GroupOwner.objects.filter(group=self.group).exclude(
            user_id__isnull=True, team_id__isnull=True
        )
        for owner in owners:
            if owner.user_id is not None:
                user_ids.add(owner.user_id)
            elif owner.team_id is not None:
                team_ids.add(owner.team_id)

        return user_ids, team_ids
