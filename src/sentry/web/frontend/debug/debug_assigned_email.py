from rest_framework.request import Request

from sentry.types.activity import ActivityType

from .mail import ActivityMailDebugView


class DebugAssignedEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {
            "type": ActivityType.ASSIGNED.value,
            "user_id": request.user.id,
            "data": {
                "assignee": "10000000",
                "assigneeEmail": "foo@example.com",
                "assigneeType": "user",
            },
        }


class DebugSelfAssignedEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {
            "type": ActivityType.ASSIGNED.value,
            "user_id": request.user.id,
            "data": {
                "assignee": str(request.user.id),
                "assigneeEmail": request.user.email,
                "assigneeType": "user",
            },
        }


class DebugSelfAssignedTeamEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {
            "type": ActivityType.ASSIGNED.value,
            "user_id": request.user.id,
            "data": {"assignee": "1", "assigneeEmail": None, "assigneeType": "team"},
        }
