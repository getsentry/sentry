from django.http import HttpRequest

from sentry.types.activity import ActivityType

from .mail import ActivityMailDebugView


class DebugResolvedEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.SET_RESOLVED.value}
