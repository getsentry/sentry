from rest_framework.request import Request

from sentry.models import Activity

from .mail import ActivityMailDebugView


class DebugUnassignedEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {"type": Activity.UNASSIGNED, "user": request.user}
