from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Event, Release, UserReport
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.utils.validators import is_event_id


@scenario('RetrieveEventForProject')
def retrieve_event_for_project_scenario(runner):
    runner.request(
        method='GET',
        path='/projects/%s/%s/events/%s/' %
        (runner.org.slug, runner.default_project.slug, runner.default_event.event_id)
    )


class ProjectEventDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.EVENTS

    def _get_release_info(self, request, event):
        version = event.get_tag('sentry:release')
        if not version:
            return None
        try:
            release = Release.objects.get(
                projects=event.project,
                organization_id=event.project.organization_id,
                version=version,
            )
        except Release.DoesNotExist:
            return {'version': version}
        return serialize(release, request.user)

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

        event = None
        # If its a numeric string, check if it's an event Primary Key first
        if event_id.isdigit():
            try:
                event = Event.objects.get(
                    id=event_id,
                    project_id=project.id,
                )
            except Event.DoesNotExist:
                pass
        # If it was not found as a PK, and its a possible event_id, search by that instead.
        if event is None and is_event_id(event_id):
            try:
                event = Event.objects.get(
                    event_id=event_id,
                    project_id=project.id,
                )
            except Event.DoesNotExist:
                pass

        if event is None:
            return Response({'detail': 'Event not found'}, status=404)

        Event.objects.bind_nodes([event], 'data')

        # HACK(dcramer): work around lack of unique sorting on datetime
        base_qs = Event.objects.filter(
            group_id=event.group_id,
        ).exclude(id=event.id)
        try:
            next_event = sorted(
                base_qs.filter(datetime__gte=event.datetime).order_by('datetime')[0:5],
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
            data['nextEventID'] = six.text_type(next_event.event_id)
        else:
            data['nextEventID'] = None
        if prev_event:
            data['previousEventID'] = six.text_type(prev_event.event_id)
        else:
            data['previousEventID'] = None

        return Response(data)
