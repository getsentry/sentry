from __future__ import annotations

from typing import Any, Mapping, Optional

from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.integrations import ExternalProviders

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

    def get_description(self) -> tuple[str, Optional[str], Mapping[str, Any]]:
        return "{author} assigned {an issue} to {assignee}", None, {"assignee": self.get_assignee()}

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
