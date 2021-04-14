from sentry.models import Team, User

from .base import ActivityEmail


class AssignedActivityEmail(ActivityEmail):
    def get_activity_name(self):
        return "Assigned"

    def get_description(self):
        activity = self.activity
        data = activity.data

        # legacy Activity objects from before assignable teams
        if "assigneeType" not in data or data["assigneeType"] == "user":
            if activity.user_id and str(activity.user_id) == data["assignee"]:
                return "{author} assigned {an issue} to themselves"

            try:
                assignee = User.objects.get_from_cache(id=data["assignee"])
            except User.DoesNotExist:
                pass
            else:
                return (
                    "{author} assigned {an issue} to {assignee}",
                    {"assignee": assignee.get_display_name()},
                )

            if data.get("assigneeEmail"):
                return (
                    "{author} assigned {an issue} to {assignee}",
                    {"assignee": data["assigneeEmail"]},
                )

            return "{author} assigned {an issue} to an unknown user"

        if data["assigneeType"] == "team":
            try:
                assignee_team = Team.objects.get(
                    id=data["assignee"], organization=self.organization
                )
            except Team.DoesNotExist:
                return "{author} assigned {an issue} to an unknown team"
            else:
                return (
                    "{author} assigned {an issue} to the {assignee} team",
                    {"assignee": assignee_team.slug},
                )

        raise NotImplementedError("Unknown Assignee Type ")

    def get_category(self):
        return "assigned_activity_email"
