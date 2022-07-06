from rest_framework.request import Request

from sentry.types.activity import ActivityType

from .mail import ActivityMailDebugView


class DebugResolvedEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {"type": ActivityType.SET_RESOLVED.value}
