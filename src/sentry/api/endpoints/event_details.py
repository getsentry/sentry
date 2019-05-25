from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.bases.group import GroupPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import DetailedEventSerializer, serialize
from sentry.models import Event


class EventDetailsEndpoint(Endpoint):
    permission_classes = (GroupPermission, )

    def get(self, request, event_id):
        """
        Retrieve an Event
        `````````````````

        This endpoint returns the data for a specific event.  The event ID
        is the event as it appears in the Sentry database and not the event
        ID that is reported by the client upon submission.

        This method is deprecated.
        """
        event = Event.objects.from_event_id(event_id, project_id=None)
        if event is None:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, event.group)

        Event.objects.bind_nodes([event], 'data')

        data = serialize(event, request.user, DetailedEventSerializer())

        data['nextEventID'] = event.next_event_id()
        data['previousEventID'] = event.prev_event_id()

        return Response(data)
