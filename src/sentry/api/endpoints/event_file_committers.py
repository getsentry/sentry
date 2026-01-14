from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.event import EventEndpoint
from sentry.models.project import Project
from sentry.services.eventstore.models import Event
from sentry.utils.committers import get_serialized_event_file_committers


@region_silo_endpoint
class EventFileCommittersEndpoint(EventEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project, event: Event) -> Response:
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
        if event.group_id is None:
            raise NotFound(detail="Issue not found")

        committers = get_serialized_event_file_committers(project, event)

        if not committers:
            raise NotFound(detail="No committers found")

        data = {
            "committers": committers,
        }

        return Response(data)
