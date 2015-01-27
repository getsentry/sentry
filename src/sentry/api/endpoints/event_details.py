from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Event
from sentry.web.helpers import group_is_public


class EventDetailsEndpoint(Endpoint):
    def _get_entries(self, request, event):
        # XXX(dcramer): These are called entries for future-proofing
        is_public = group_is_public(event.group, request.user)

        interface_list = []
        for interface in event.interfaces.itervalues():
            entry = {
                'data': interface.to_json(),
                'type': interface.get_alias(),
            }
            interface_list.append((interface, entry))
        interface_list.sort(key=lambda x: x[0].get_display_score(), reverse=True)

        return [i[1] for i in interface_list]

    def get(self, request, event_id):
        event = Event.objects.get(
            id=event_id
        )

        assert_perm(event, request.user, request.auth)

        Event.objects.bind_nodes([event], 'data')

        base_qs = Event.objects.filter(
            group=event.group_id,
        ).exclude(id=event.id)
        try:
            next_event = base_qs.filter(datetime__gte=event.datetime).order_by('datetime')[0:1].get()
        except Event.DoesNotExist:
            next_event = None

        try:
            prev_event = base_qs.filter(datetime__lte=event.datetime).order_by('-datetime')[0:1].get()
        except Event.DoesNotExist:
            prev_event = None

        data = serialize(event, request.user)

        if next_event:
            data['nextEventID'] = str(next_event.id)
        else:
            data['nextEventID'] = None
        if prev_event:
            data['previousEventID'] = str(prev_event.id)
        else:
            data['previousEventID'] = None

        data['entries'] = self._get_entries(request, event)

        return Response(data)
