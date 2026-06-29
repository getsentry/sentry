from typing import Any

from sentry.services.eventstore.models import Event
from sentry.types.activity import ActivityType
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.web.frontend.base import internal_cell_silo_view

from .mail import ActivityMailDebugView, get_random, make_message


@internal_cell_silo_view
class DebugNoteEmailView(ActivityMailDebugView):
    def get_activity(self, request: AuthenticatedHttpRequest, event: Event) -> dict[str, Any]:
        random = get_random(request)
        return {
            "type": ActivityType.NOTE.value,
            "user_id": request.user.id,
            "data": {"text": make_message(random, max(2, int(random.weibullvariate(12, 0.4))))},
        }
