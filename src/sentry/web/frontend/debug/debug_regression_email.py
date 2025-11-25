from django.http import HttpRequest

from sentry.types.activity import ActivityType
from sentry.web.frontend.base import region_silo_view

from .mail import ActivityMailDebugView


@region_silo_view
class DebugRegressionEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.SET_REGRESSION.value}


@region_silo_view
class DebugRegressionReleaseEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.SET_REGRESSION.value, "data": {"version": "abcdef"}}
