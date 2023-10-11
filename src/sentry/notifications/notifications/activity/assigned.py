from __future__ import annotations

from typing import Any, Iterable, Mapping

from sentry.models.activity import Activity
from sentry.models.notificationsetting import NotificationSetting
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.notifications.helpers import should_use_notifications_v2
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.types import (
    NOTIFICATION_SETTING_TYPES,
    GroupSubscriptionReason,
    NotificationSettingEnum,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.integrations import ExternalProviders

from ...utils.participants import ParticipantMap
from .base import GroupActivityNotification


def _get_user_option(assignee_id: int | None) -> RpcUser | None:
    if assignee_id is None:
        return None
    return user_service.get_user(user_id=assignee_id)


def _get_team_option(assignee_id: int | None, organization: Organization) -> Team | None:
    return Team.objects.filter(id=assignee_id, organization=organization).first()


def is_team_assignee(activity: Activity) -> bool:
    return activity.data.get("assigneeType") == "team"


def get_assignee_str(activity: Activity, organization: Organization) -> str:
    """Get a human-readable version of the assignment's target."""

    assignee_id = activity.data.get("assignee")
    assignee_email: str | None = activity.data.get("assigneeEmail")

    if is_team_assignee(activity):
        assignee_team = _get_team_option(assignee_id, organization)
        if assignee_team:
            return f"the {assignee_team.slug} team"
        return "an unknown team"

    # TODO(mgaeta): Refactor GroupAssigneeManager to not make IDs into strings.
    if str(activity.user_id) == str(assignee_id):
        return "themselves"

    assignee_user = _get_user_option(assignee_id)
    if assignee_user:
        assignee: str = assignee_user.get_display_name()
        return assignee
    if assignee_email:
        return assignee_email
    return "an unknown user"


class AssignedActivityNotification(GroupActivityNotification):
    metrics_key = "assigned_activity"
    title = "Assigned"

    def get_assignee(self) -> str:
        return get_assignee_str(self.activity, self.organization)

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return "{author} assigned {an issue} to {assignee}", {"assignee": self.get_assignee()}, {}

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        assignee = self.get_assignee()

        if not self.user:
            return f"Issue automatically assigned to {assignee}"

        author = self.user.get_display_name()
        if assignee == "themselves":
            author, assignee = assignee, author

        return f"Issue assigned to {assignee} by {author}"

    def get_participants_with_group_subscription_reason(self) -> ParticipantMap:
        """Hack to tack on the assigned team to the list of users subscribed to the group."""
        users_by_provider = super().get_participants_with_group_subscription_reason()
        if is_team_assignee(self.activity):
            assignee_id = self.activity.data.get("assignee")
            assignee_team = _get_team_option(assignee_id, self.organization)

            if assignee_team:
                teams_by_provider: Mapping[ExternalProviders, Iterable[RpcActor]] = {}
                if should_use_notifications_v2(self.project.organization):
                    setting_type = NotificationSettingEnum(
                        NOTIFICATION_SETTING_TYPES[self.notification_setting_type]
                    )
                    controller = NotificationController(
                        recipients=[assignee_team],
                        organization_id=self.project.organization_id,
                        project_ids=[self.project.id],
                        type=setting_type,
                    )
                    teams_by_provider = controller.get_notification_recipients(
                        type=setting_type, actor_type=ActorType.TEAM
                    )
                else:
                    teams_by_provider = NotificationSetting.objects.filter_to_accepting_recipients(
                        parent=self.project,
                        recipients=[assignee_team],
                        type=self.notification_setting_type,
                    )

                actors_by_provider = ParticipantMap()
                actors_by_provider.update(users_by_provider)
                for provider, teams in teams_by_provider.items():
                    for team in teams:
                        actors_by_provider.add(provider, team, GroupSubscriptionReason.assigned)
                return actors_by_provider

        return users_by_provider
