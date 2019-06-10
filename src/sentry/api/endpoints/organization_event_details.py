from __future__ import absolute_import

from rest_framework.response import Response
import six
from enum import Enum

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry import features
from sentry.models import SnubaEvent
from sentry.models.project import Project
from sentry.api.serializers import serialize
from sentry.utils.snuba import raw_query


class EventOrdering(Enum):
    LATEST = 0
    OLDEST = 1


class OrganizationEventDetailsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization, project_slug, event_id):
        if not features.has('organizations:events-v2', organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args_v2(request, organization, params)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response(status=404)

        try:
            project = Project.objects.get(
                slug=project_slug,
                organization_id=organization.id
            )
        except Project.DoesNotExist:
            return Response(status=404)

        # We return the requested event if we find a match regardless of whether
        # it occurred within the range specified
        event = SnubaEvent.objects.from_event_id(event_id, project.id)

        if event is None:
            return Response({'detail': 'Event not found'}, status=404)

        data = serialize(event)

        data['nextEventID'] = self.next_event_id(request, organization, snuba_args, event)
        data['previousEventID'] = self.prev_event_id(request, organization, snuba_args, event)
        data['projectSlug'] = project_slug

        return Response(data)


class OrganizationEventsLatestOrOldest(OrganizationEventsEndpointBase):
    def get(self, latest_or_oldest, request, organization):
        if not features.has('organizations:events-v2', organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args_v2(request, organization, params)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response(status=404)

        if latest_or_oldest == EventOrdering.LATEST:
            orderby = ['-timestamp', '-event_id']
        else:
            orderby = ['timestamp', 'event_id']

        result = raw_query(
            start=snuba_args['start'],
            end=snuba_args['end'],
            selected_columns=SnubaEvent.selected_columns,
            conditions=snuba_args['conditions'],
            filter_keys=snuba_args['filter_keys'],
            orderby=orderby,
            limit=2,
            referrer='api.organization-event-details-latest-or-oldest',
        )

        if 'error' in result or len(result['data']) == 0:
            return Response({'detail': 'Event not found'}, status=404)

        try:
            project_id = result['data'][0]['project_id']
            project_slug = Project.objects.get(
                organization=organization, id=project_id).slug
        except Project.DoesNotExist:
            project_slug = None

        data = serialize(SnubaEvent(result['data'][0]))
        data['previousEventID'] = None
        data['nextEventID'] = None
        data['projectSlug'] = project_slug

        if latest_or_oldest == EventOrdering.LATEST and len(result['data']) == 2:
            data['previousEventID'] = six.text_type(result['data'][1]['event_id'])

        if latest_or_oldest == EventOrdering.OLDEST and len(result['data']) == 2:
            data['nextEventID'] = six.text_type(result['data'][1]['event_id'])

        return Response(data)


class OrganizationEventDetailsLatestEndpoint(OrganizationEventsLatestOrOldest):
    def get(self, request, organization):
        return super(OrganizationEventDetailsLatestEndpoint, self).get(
            EventOrdering.LATEST, request, organization)


class OrganizationEventDetailsOldestEndpoint(OrganizationEventsLatestOrOldest):
    def get(self, request, organization):
        return super(OrganizationEventDetailsOldestEndpoint, self).get(
            EventOrdering.OLDEST, request, organization)
