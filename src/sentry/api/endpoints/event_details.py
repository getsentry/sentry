from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.bases.group import GroupPermission
from sentry.api.serializers import serialize
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
        event = Event.objects.get(
            id=event_id
        )

        self.check_object_permissions(request, event.group)

        Event.objects.bind_nodes([event], 'data')

        # HACK(dcramer): work around lack of unique sorting on datetime
        base_qs = Event.objects.filter(
            group=event.group_id,
        )
        try:
            next_event = sorted(
                base_qs.filter(
                    id__gt=event.id,
                    datetime__gte=event.datetime,
                ).order_by('datetime')[0:5],
                key=lambda x: (x.datetime, x.id),
            )[0]
        except IndexError:
            next_event = None

        try:
            prev_event = sorted(
                base_qs.filter(
                    id__lt=event.id,
                    datetime__lte=event.datetime,
                ).order_by('-datetime')[0:5],
                key=lambda x: (x.datetime, x.id),
                reverse=True,
            )[0]
        except IndexError:
            prev_event = None

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
            data['nextEventID'] = str(next_event.id)
        else:
            data['nextEventID'] = None
        if prev_event:
            data['previousEventID'] = str(prev_event.id)
        else:
            data['previousEventID'] = None

        return Response(data)
