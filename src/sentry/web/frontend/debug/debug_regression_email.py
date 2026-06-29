from typing import Any

from django.http import HttpRequest

from sentry.services.eventstore.models import Event
from sentry.types.activity import ActivityType
from sentry.web.frontend.base import internal_cell_silo_view

from .mail import ActivityMailDebugView


@internal_cell_silo_view
class DebugRegressionEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event: Event) -> dict[str, Any]:
        return {"type": ActivityType.SET_REGRESSION.value}


@internal_cell_silo_view
class DebugRegressionReleaseEmailView(ActivityMailDebugView):
    def get_activity(self, request: HttpRequest, event: Event) -> dict[str, Any]:
        return {"type": ActivityType.SET_REGRESSION.value, "data": {"version": "abcdef"}}
