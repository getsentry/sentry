from django.http import HttpRequest

from sentry.types.activity import ActivityType

from .mail import ActivityMailDebugView


class DebugRegressionEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.SET_REGRESSION.value}


class DebugRegressionReleaseEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.SET_REGRESSION.value, "data": {"version": "abcdef"}}
