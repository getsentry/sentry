from django.http import HttpRequest

from sentry.types.activity import ActivityType
from sentry.web.frontend.base import region_silo_view

from .mail import ActivityMailDebugView


@region_silo_view
class DebugUnassignedEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event):
        return {"type": ActivityType.UNASSIGNED.value, "user_id": request.user.id}
