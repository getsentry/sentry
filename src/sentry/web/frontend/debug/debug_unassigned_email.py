from rest_framework.request import Request

from sentry.types.activity import ActivityType

from .mail import ActivityMailDebugView


class DebugUnassignedEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {"type": ActivityType.UNASSIGNED.value, "user_id": request.user.id}
