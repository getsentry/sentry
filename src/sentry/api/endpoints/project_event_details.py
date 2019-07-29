from __future__ import absolute_import

from datetime import datetime
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import DetailedEventSerializer, serialize
from sentry.models import SnubaEvent

from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('RetrieveEventForProject')
def retrieve_event_for_project_scenario(runner):
    runner.request(
        method='GET',
        path='/projects/%s/%s/events/%s/' %
        (runner.org.slug, runner.default_project.slug, runner.default_event.event_id)
    )


class ProjectEventDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.EVENTS

    @attach_scenarios([retrieve_event_for_project_scenario])
    def get(self, request, project, event_id):
        """
        Retrieve an Event for a Project
        ```````````````````````````````

        Return details on an individual event.

        :pparam string organization_slug: the slug of the organization the
                                          event belongs to.
        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event to retrieve (either the
                                 numeric primary-key or the hexadecimal id as
                                 reported by the raven client)
        :auth: required
        """

        snuba_event = SnubaEvent.objects.from_event_id(event_id, project.id)

        if snuba_event is None:
            return Response({'detail': 'Event not found'}, status=404)

        data = serialize(snuba_event, request.user, DetailedEventSerializer())
        requested_environments = set(request.GET.getlist('environment'))

        next_event_id = snuba_event.next_event_id(environments=requested_environments)
        prev_event_id = snuba_event.prev_event_id(environments=requested_environments)

        data['nextEventID'] = next_event_id
        data['previousEventID'] = prev_event_id

        return Response(data)


class EventJsonEndpoint(ProjectEndpoint):

    def get(self, request, project, event_id):
        event = SnubaEvent.objects.from_event_id(event_id, project.id)

        if not event:
            return Response({'detail': 'Event not found'}, status=404)

        event_dict = event.as_dict()
        if isinstance(event_dict['datetime'], datetime):
            event_dict['datetime'] = event_dict['datetime'].isoformat()

        return Response(event_dict, status=200)
