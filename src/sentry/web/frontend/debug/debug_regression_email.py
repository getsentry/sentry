from rest_framework.request import Request

from sentry.models import Activity

from .mail import ActivityMailDebugView


class DebugRegressionEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {"type": Activity.SET_REGRESSION}


class DebugRegressionReleaseEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {"type": Activity.SET_REGRESSION, "data": {"version": "abcdef"}}
