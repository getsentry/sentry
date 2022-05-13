from __future__ import annotations

from typing import Any, Mapping

from sentry.models import Activity, Organization, Team, User

from .base import GroupActivityNotification


def _get_user_option(assignee_id: int) -> User | None:
    try:
        return User.objects.get_from_cache(id=assignee_id)
    except User.DoesNotExist:
        return None


def _get_team_option(assignee_id: int, organization: Organization) -> Team | None:
    return Team.objects.filter(id=assignee_id, organization=organization).first()


def get_assignee_str(activity: Activity, organization: Organization) -> str:
    """Get a human-readable version of the assignment's target."""

    assignee_id = activity.data.get("assignee")
    assignee_type = activity.data.get("assigneeType", "user")
    assignee_email: str | None = activity.data.get("assigneeEmail")

    if assignee_type == "user":
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

    if assignee_type == "team":
        assignee_team = _get_team_option(assignee_id, organization)
        if assignee_team:
            return f"the {assignee_team.slug} team"
        return "an unknown team"

    raise NotImplementedError("Unknown Assignee Type")


class AssignedActivityNotification(GroupActivityNotification):
    title = "Assigned"
    referrer_base = "assigned-activity"

    def get_assignee(self) -> str:
        return get_assignee_str(self.activity, self.organization)

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return "{author} assigned {an issue} to {assignee}", {"assignee": self.get_assignee()}, {}

    def get_category(self) -> str:
        return "assigned_activity_email"

    def get_notification_title(self) -> str:
        assignee = self.get_assignee()

        if not self.activity.user:
            return f"Issue automatically assigned to {assignee}"

        author = self.activity.user.get_display_name()
        if assignee == "themselves":
            author, assignee = assignee, author

        return f"Issue assigned to {assignee} by {author}"
