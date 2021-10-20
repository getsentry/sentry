from typing import Any, Mapping, Tuple

from sentry.models import Team, User

from .base import GroupActivityNotification


class AssignedActivityNotification(GroupActivityNotification):
    def get_activity_name(self) -> str:
        return "Assigned"

    def get_description(self) -> Tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        activity = self.activity
        data = activity.data

        # legacy Activity objects from before assignable teams
        if "assigneeType" not in data or data["assigneeType"] == "user":
            if activity.user_id and str(activity.user_id) == data["assignee"]:
                return "{author} assigned {an issue} to themselves", {}, {}

            try:
                assignee = User.objects.get_from_cache(id=data["assignee"])
            except User.DoesNotExist:
                pass
            else:
                return (
                    "{author} assigned {an issue} to {assignee}",
                    {"assignee": assignee.get_display_name()},
                    {},
                )

            if data.get("assigneeEmail"):
                return (
                    "{author} assigned {an issue} to {assignee}",
                    {"assignee": data["assigneeEmail"]},
                    {},
                )

            return "{author} assigned {an issue} to an unknown user", {}, {}

        if data["assigneeType"] == "team":
            try:
                assignee_team = Team.objects.get(
                    id=data["assignee"], organization=self.organization
                )
            except Team.DoesNotExist:
                return "{author} assigned {an issue} to an unknown team", {}, {}
            else:
                return (
                    "{author} assigned {an issue} to the {assignee} team",
                    {"assignee": assignee_team.slug},
                    {},
                )

        raise NotImplementedError("Unknown Assignee Type ")

    def get_category(self) -> str:
        return "assigned_activity_email"

    def build_notification_title(self) -> Tuple[str, str]:
        activity = self.activity
        data = activity.data
        user = self.activity.user
        if user:
            author = user.name or user.email
        else:
            author = "Sentry"

        # legacy Activity objects from before assignable teams
        if "assigneeType" not in data or data["assigneeType"] == "user":
            author = "themselves"

            try:
                assignee = User.objects.get_from_cache(id=data["assignee"])
            except User.DoesNotExist:
                assignee = data.get("assigneeEmail", "an unknown user")
            else:
                assignee = assignee.get_display_name()
            return author, assignee

        if data.get("assigneeType") == "team":
            try:
                assignee_team = Team.objects.get(
                    id=data["assignee"], organization=self.organization
                )
            except Team.DoesNotExist:
                assignee = "an unknown team"
            else:
                assignee = f"#{assignee_team.slug}"
        return author, assignee

    def get_notification_title(self) -> str:
        author, assignee = self.build_notification_title()
        if author == "Sentry":
            return f"Issue automatically assigned to {assignee}"
        return f"Issue assigned to {assignee} by {author}"
