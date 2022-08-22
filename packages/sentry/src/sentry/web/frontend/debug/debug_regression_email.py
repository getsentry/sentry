from rest_framework.request import Request

from sentry.types.activity import ActivityType

from .mail import ActivityMailDebugView


class DebugRegressionEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {"type": ActivityType.SET_REGRESSION.value}


class DebugRegressionReleaseEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {"type": ActivityType.SET_REGRESSION.value, "data": {"version": "abcdef"}}
