from django.http import HttpRequest

from sentry.types.activity import ActivityType

from .mail import ActivityMailDebugView


class DebugUnassignedEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.UNASSIGNED.value, "user_id": request.user.id}
