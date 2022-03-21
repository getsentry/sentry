from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api import client
from sentry.api.bases.group import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import EventSerializer, serialize
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class GroupEventsLatestEndpoint(GroupEndpoint):
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(15, 1),
            RateLimitCategory.USER: RateLimit(15, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(15, 1),
        }
    }

    def get(self, request: Request, group) -> Response:
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

        try:
            return client.get(
                f"/projects/{event.organization.slug}/{event.project.slug}/events/{event.event_id}/",
                request=request,
                data={"environment": environments, "group_id": event.group_id},
            )
        except client.ApiError as e:
            return Response(e.body, status=e.status_code)
