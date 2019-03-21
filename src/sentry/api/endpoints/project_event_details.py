from __future__ import absolute_import

from rest_framework.response import Response

from sentry import options
from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import DetailedEventSerializer, serialize
from sentry.models import Event, SnubaEvent

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

        use_snuba = options.get('snuba.events-queries.enabled')

        if not use_snuba:
            return self.get_legacy(request, project, event_id)

        snuba_event = SnubaEvent.objects.from_event_id(event_id, project.id)

        if snuba_event is None:
            return Response({'detail': 'Event not found'}, status=404)

        data = serialize(snuba_event)

        requested_environments = set(request.GET.getlist('environment'))

        next_event_id = snuba_event.next_event_id(environments=requested_environments)
        prev_event_id = snuba_event.prev_event_id(environments=requested_environments)

        data['nextEventID'] = next_event_id
        data['previousEventID'] = prev_event_id

        return Response(data)

    def get_legacy(self, request, project, event_id):
        event = Event.objects.from_event_id(event_id, project.id)
        if event is None:
            return Response({'detail': 'Event not found'}, status=404)

        Event.objects.bind_nodes([event], 'data')

        data = serialize(event, request.user, DetailedEventSerializer())
        next_event_id = event.next_event_id()
        prev_event_id = event.prev_event_id()
        # TODO this is inconsistent with the event_details API which uses the
        # `id` instead of the `event_id`
        data['nextEventID'] = next_event_id
        data['previousEventID'] = prev_event_id

        return Response(data)
