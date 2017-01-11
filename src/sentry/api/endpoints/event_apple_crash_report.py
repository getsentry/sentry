from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.bases.group import GroupPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Event


class EventAppleCrashReportEndpoint(Endpoint):
    permission_classes = (GroupPermission,)

    def get(self, request, event_id):
        """
        Retrieve an Event
        `````````````````

        This endpoint returns the data for a specific event.  The event ID
        is the event as it appears in the Sentry database and not the event
        ID that is reported by the client upon submission.
        """
        try:
            event = Event.objects.get(
                id=event_id
            )
        except Event.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, event.group)

        Event.objects.bind_nodes([event], 'data')

        data = serialize(event, request.user)
        
        if event.platform != 'cocoa':
            return Response({
                'message': 'Only cocoa events can return an apple crash report',
            }, status=403)

        import pprint; 
        pprint.pprint(event.data.get('debug_meta'))
        #pprint.pprint(event.data.get('sentry.interfaces.threads', event.data.get('threads')))

        return Response(data)
