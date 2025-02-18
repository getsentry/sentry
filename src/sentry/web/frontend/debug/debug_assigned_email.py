from sentry.types.activity import ActivityType
from sentry.utils.auth import AuthenticatedHttpRequest

from .mail import ActivityMailDebugView


class DebugAssignedEmailView(ActivityMailDebugView):
    def get_activity(self, request: AuthenticatedHttpRequest, event):
        return {
            "type": ActivityType.ASSIGNED.value,
            "user_id": request.user.id,
            "data": {
                "assignee": "10000000",
                "assigneeEmail": "foo@example.com",
                "assigneeName": "Example User",
                "assigneeType": "user",
            },
        }


class DebugSelfAssignedEmailView(ActivityMailDebugView):
    def get_activity(self, request: AuthenticatedHttpRequest, event):
        return {
            "type": ActivityType.ASSIGNED.value,
            "user_id": request.user.id,
            "data": {
                "assignee": str(request.user.id),
                "assigneeEmail": request.user.email,
                "assigneeName": request.user.name,
                "assigneeType": "user",
            },
        }


class DebugSelfAssignedTeamEmailView(ActivityMailDebugView):
    def get_activity(self, request: AuthenticatedHttpRequest, event):
        return {
            "type": ActivityType.ASSIGNED.value,
            "user_id": request.user.id,
            "data": {"assignee": "1", "assigneeEmail": None, "assigneeName": "example-team", "assigneeType": "team"},
        }
