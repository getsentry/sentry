from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.integrations.types import ExternalProviders
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

from .base import GroupActivityNotification


def _get_user_option(assignee_id: int | None) -> RpcUser | None:
    if assignee_id is None:
        return None
    return user_service.get_user(user_id=assignee_id)


def _get_team_option(assignee_id: int | None, organization: Organization) -> Team | None:
    if assignee_id is None:
        return None
    return Team.objects.filter(id=assignee_id, organization=organization).first()


def _is_team_assignee(data: Mapping[str, Any] | None) -> bool:
    return data is not None and data.get("assigneeType") == "team"


def is_team_assignee(activity: Activity) -> bool:
    return _is_team_assignee(activity.data)


def get_assignee_str_from_data(
    data: Mapping[str, Any] | None,
    actor_user_id: int | None,
    organization: Organization,
) -> str:
    """Get a human-readable version of the assignment's target."""

    assignee_id = data.get("assignee") if data else None
    assignee_email: str | None = data.get("assigneeEmail") if data else None

    if _is_team_assignee(data):
        assignee_team = _get_team_option(assignee_id, organization)
        if assignee_team:
            return f"the {assignee_team.slug} team"
        return "an unknown team"

    # TODO(mgaeta): Refactor GroupAssigneeManager to not make IDs into strings.
    if actor_user_id is not None and str(actor_user_id) == str(assignee_id):
        return "themselves"

    assignee_user = _get_user_option(assignee_id)
    if assignee_user:
        assignee: str = assignee_user.get_display_name()
        return assignee
    if assignee_email:
        return assignee_email
    return "an unknown user"


def get_assignee_str(activity: Activity, organization: Organization) -> str:
    return get_assignee_str_from_data(activity.data, activity.user_id, organization)


class AssignedActivityNotification(GroupActivityNotification):
    metrics_key = "assigned_activity"
    title = "Assigned"

    def get_assignee(self) -> str:
        return get_assignee_str(self.activity, self.organization)

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
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
