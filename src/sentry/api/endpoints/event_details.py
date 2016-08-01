from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.bases.group import GroupPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.constants import EVENT_ORDERING_KEY
from sentry.models import Event, Release, UserReport


class EventDetailsEndpoint(Endpoint):
    permission_classes = (GroupPermission,)

    def _get_release_info(self, request, event):
        version = event.get_tag('sentry:release')
        if not version:
            return None
        try:
            release = Release.objects.get(
                project=event.project,
                version=version,
            )
        except Release.DoesNotExist:
            return {'version': version}
        return serialize(release, request.user)

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

        # HACK(dcramer): work around lack of unique sorting on datetime
        base_qs = Event.objects.filter(
            group_id=event.group_id,
        ).exclude(id=event.id)

        # First, we collect 5 leading/trailing events
        next_events = sorted(
            base_qs.filter(
                datetime__gte=event.datetime,
            ).order_by('datetime')[0:5],
            key=EVENT_ORDERING_KEY,
        )
        prev_events = sorted(
            base_qs.filter(
                datetime__lte=event.datetime,
            ).order_by('-datetime')[0:5],
            key=EVENT_ORDERING_KEY,
            reverse=True,
        )

        # Now, try and find the real next event.
        # "next" means:
        #  * If identical timestamps, greater of the ids
        #  * else greater of the timestamps
        next_event = None
        for e in next_events:
            if e.datetime == event.datetime and e.id > event.id:
                next_event = e
                break

            if e.datetime > event.datetime:
                next_event = e
                break

        # Last, pick the previous event
        # "previous" means:
        #  * If identical timestamps, lesser of the ids
        #  * else lesser of the timestamps
        prev_event = None
        for e in prev_events:
            if e.datetime == event.datetime and e.id < event.id:
                prev_event = e
                break

            if e.datetime < event.datetime:
                prev_event = e
                break

        try:
            user_report = UserReport.objects.get(
                event_id=event.event_id,
                project=event.project,
            )
        except UserReport.DoesNotExist:
            user_report = None

        data = serialize(event, request.user)
        data['userReport'] = serialize(user_report, request.user)
        data['release'] = self._get_release_info(request, event)

        if next_event:
            data['nextEventID'] = six.text_type(next_event.id)
        else:
            data['nextEventID'] = None
        if prev_event:
            data['previousEventID'] = six.text_type(prev_event.id)
        else:
            data['previousEventID'] = None

        return Response(data)
