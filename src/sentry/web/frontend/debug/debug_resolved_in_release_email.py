from __future__ import absolute_import

from sentry.models import Activity

from .mail import ActivityMailDebugView


class DebugResolvedInReleaseEmailView(ActivityMailDebugView):
    def get_activity(self, request, event):
        return {"type": Activity.SET_RESOLVED_IN_RELEASE, "data": {"version": "abcdef"}}


class DebugResolvedInReleaseUpcomingEmailView(ActivityMailDebugView):
    def get_activity(self, request, event):
        return {"type": Activity.SET_RESOLVED_IN_RELEASE, "data": {"version": ""}}
