from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.integrations.types import ExternalProviders
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.notifications.services import notifications_service
from sentry.notifications.types import GroupSubscriptionReason, NotificationSettingEnum
from sentry.notifications.utils.participants import ParticipantMap
from sentry.types.actor import Actor
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

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

    def get_participants_with_group_subscription_reason(self) -> ParticipantMap:
        if is_team_assignee(self.activity):
            assignee_id = self.activity.data.get("assignee")
            assignee_team = _get_team_option(assignee_id, self.organization)
            actors = Actor.many_from_object([assignee_team])
            team_actor = actors[0]
            providers_by_recipient = notifications_service.get_participants(
                type=NotificationSettingEnum.WORKFLOW,
                recipients=actors,
                organization_id=self.organization.id,
            )
            team_settings = providers_by_recipient.get(team_actor.id, {})
            participant_map = ParticipantMap()
            for provider_str, val_str in team_settings.items():
                provider = ExternalProviders(provider_str)
                participant_map.add(provider, team_actor, GroupSubscriptionReason.assigned)
            return participant_map

        return super().get_participants_with_group_subscription_reason()

    def get_assignee(self) -> str:
        return get_assignee_str(self.activity, self.organization)

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} assigned {an issue} to {assignee}", None, {"assignee": self.get_assignee()}

    def get_message_description(self, recipient: Actor, provider: ExternalProviders) -> Any:
        text_template, _, params = self.get_description()
        return self.description_as_text(text_template, params)

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
