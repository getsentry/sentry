from typing import Any

from sentry.services.eventstore.models import Event
from sentry.types.activity import ActivityType
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.web.frontend.base import internal_cell_silo_view

from .mail import ActivityMailDebugView


@internal_cell_silo_view
class DebugUnassignedEmailView(ActivityMailDebugView):
    def get_activity(self, request: AuthenticatedHttpRequest, event: Event) -> dict[str, Any]:
        return {"type": ActivityType.UNASSIGNED.value, "user_id": request.user.id}
