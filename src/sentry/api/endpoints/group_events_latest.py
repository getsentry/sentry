from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.endpoints.project_event_details import wrap_event_response
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import EventSerializer, serialize
from sentry.types.ratelimit import RateLimit, RateLimitCategory

if TYPE_CHECKING:
    from sentry.models.group import Group


@region_silo_endpoint
class GroupEventsLatestEndpoint(GroupEndpoint):  # type: ignore
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(15, 1),
            RateLimitCategory.USER: RateLimit(15, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(15, 1),
        }
    }

    def get(self, request: Request, group: Group) -> Response:
        """
        Retrieve the Latest Event for an Issue
        ``````````````````````````````````````

        Retrieves the details of the latest event for an issue.

        :pparam string group_id: the ID of the issue
        """
        environments = [e.name for e in get_environments(request, group.project.organization)]

        event = group.get_latest_event_for_environments(environments)

        if not event:
            return Response({"detail": "No events found for group"}, status=404)

        collapse = request.GET.getlist("collapse", [])
        if "stacktraceOnly" in collapse:
            return Response(serialize(event, request.user, EventSerializer()))

        data = wrap_event_response(request.user, event, event.project, environments)
        return Response(data)
