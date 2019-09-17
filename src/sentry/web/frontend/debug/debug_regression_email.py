from __future__ import absolute_import

from sentry.models import Activity

from .mail import ActivityMailDebugView


class DebugRegressionEmailView(ActivityMailDebugView):
    def get_activity(self, request, event):
        return {"type": Activity.SET_REGRESSION}


class DebugRegressionReleaseEmailView(ActivityMailDebugView):
    def get_activity(self, request, event):
        return {"type": Activity.SET_REGRESSION, "data": {"version": "abcdef"}}
