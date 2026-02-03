from django.http import HttpRequest

from sentry.types.activity import ActivityType
from sentry.web.frontend.base import internal_region_silo_view

from .mail import ActivityMailDebugView


@internal_region_silo_view
class DebugResolvedEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.SET_RESOLVED.value}
