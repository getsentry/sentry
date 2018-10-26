from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Event
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
        :pparam string event_id: the hexadecimal ID of the event to
                                 retrieve (as reported by the raven client).
        :auth: required
        """
        try:
            event = Event.objects.get(
                event_id=event_id,
                project_id=project.id,
            )
        except Event.DoesNotExist:
            return Response({'detail': 'Event not found'}, status=404)

        Event.objects.bind_nodes([event], 'data')

        data = serialize(event, request.user)

        next_event = event.next_event
        prev_event = event.prev_event
        # TODO this is inconsistent with the event_details API which uses the
        # `id` instead of the `event_id`
        data['nextEventID'] = next_event and six.text_type(next_event.event_id)
        data['previousEventID'] = prev_event and six.text_type(prev_event.event_id)

        return Response(data)
