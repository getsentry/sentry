from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.endpoints.project_event_details import wrap_event_response
from sentry.api.helpers.environments import get_environments

if TYPE_CHECKING:
    from sentry.models.group import Group


@region_silo_endpoint
class GroupEventsOldestEndpoint(GroupEndpoint):  # type: ignore
    def get(self, request: Request, group: Group) -> Response:
        """
        Retrieve the Oldest Event for an Issue
        ``````````````````````````````````````

        Retrieves the details of the oldest event for an issue.

        :pparam string group_id: the ID of the issue
        """

        environments = [e.name for e in get_environments(request, group.project.organization)]

        event = group.get_oldest_event_for_environments(environments)

        if not event:
            return Response({"detail": "No events found for group"}, status=404)

        data = wrap_event_response(request.user, event, event.project, environments)
        return Response(data)
