from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Event


class ProjectEventDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, project, event_id):
        """
        Retrieve an event for a project

        Return details on an individual event.

            {method} {path}

        """
        event = Event.objects.get(
            event_id=event_id,
            project=project,
        )

        Event.objects.bind_nodes([event], 'data')

        # HACK(dcramer): work around lack of unique sorting on datetime
        base_qs = Event.objects.filter(
            group=event.group_id,
        ).exclude(id=event.id)
        try:
            next_event = sorted(
                base_qs.filter(
                    datetime__gte=event.datetime
                ).order_by('datetime')[0:5],
                key=lambda x: (x.datetime, x.id)
            )[0]
        except IndexError:
            next_event = None

        try:
            prev_event = sorted(
                base_qs.filter(
                    datetime__lte=event.datetime,
                ).order_by('-datetime')[0:5],
                key=lambda x: (x.datetime, x.id),
                reverse=True
            )[0]
        except IndexError:
            prev_event = None

        data = serialize(event, request.user)

        if next_event:
            data['nextEventID'] = str(next_event.event_id)
        else:
            data['nextEventID'] = None
        if prev_event:
            data['previousEventID'] = str(prev_event.event_id)
        else:
            data['previousEventID'] = None

        return Response(data)
