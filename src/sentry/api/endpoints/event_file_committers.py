from typing import int
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.services import eventstore
from sentry.utils.committers import get_serialized_event_file_committers


@region_silo_endpoint
class EventFileCommittersEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project, event_id) -> Response:
        """
        Retrieve Suspect Commit information for an event
        ```````````````````````````````````````````

        Return suspect commits on an individual event.

        :pparam string project_id_or_slug: the id or slug of the project the event
                                     belongs to.
        :pparam string event_id: the hexadecimal ID of the event to
                                 retrieve (as reported by the raven client).
        :auth: required
        """
        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")
        elif event.group_id is None:
            raise NotFound(detail="Issue not found")

        committers = get_serialized_event_file_committers(project, event)

        if not committers:
            raise NotFound(detail="No committers found")

        data = {
            "committers": committers,
        }

        return Response(data)
