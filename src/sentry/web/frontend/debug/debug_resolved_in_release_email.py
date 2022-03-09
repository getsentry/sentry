from rest_framework.request import Request

from sentry.models import Activity

from .mail import ActivityMailDebugView


class DebugResolvedInReleaseEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {"type": Activity.SET_RESOLVED_IN_RELEASE, "data": {"version": "abcdef"}}


class DebugResolvedInReleaseUpcomingEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        return {"type": Activity.SET_RESOLVED_IN_RELEASE, "data": {"version": ""}}
