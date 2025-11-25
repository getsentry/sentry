from django.http import HttpRequest

from sentry.types.activity import ActivityType
from sentry.web.frontend.base import internal_region_silo_view

from .mail import ActivityMailDebugView


@internal_region_silo_view
class DebugResolvedInReleaseEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.SET_RESOLVED_IN_RELEASE.value, "data": {"version": "abcdef"}}


@internal_region_silo_view
class DebugResolvedInReleaseUpcomingEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.SET_RESOLVED_IN_RELEASE.value, "data": {"version": ""}}
