from __future__ import absolute_import

from rest_framework.response import Response
import six

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry import features
from sentry.models import SnubaEvent
from sentry.models.project import Project
from sentry.api.serializers import serialize
from sentry.utils.snuba import raw_query


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

        return Response(data)


class OrganizationEventDetailsLatestEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        if not features.has('organizations:events-v2', organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args_v2(request, organization, params)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response(status=404)

        result = raw_query(
            start=snuba_args['start'],
            end=snuba_args['end'],
            selected_columns=SnubaEvent.selected_columns,
            conditions=snuba_args['conditions'],
            filter_keys=snuba_args['filter_keys'],
            orderby=['-timestamp', '-event_id'],
            limit=2,
            referrer='api.organization-event-details-latest',
        )

        if 'error' in result or len(result['data']) == 0:
            return Response({'detail': 'Event not found'}, status=404)

        data = serialize(SnubaEvent(result['data'][0]))

        data['previousEventID'] = None
        data['nextEventID'] = None

        if len(result['data']) == 2:
            data['previousEventID'] = six.text_type(result['data'][1]['event_id'])

        return Response(data)


class OrganizationEventDetailsOldestEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        if not features.has('organizations:events-v2', organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args_v2(request, organization, params)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response(status=404)

        result = raw_query(
            start=snuba_args['start'],
            end=snuba_args['end'],
            selected_columns=SnubaEvent.selected_columns,
            conditions=snuba_args['conditions'],
            filter_keys=snuba_args['filter_keys'],
            orderby=['timestamp', 'event_id'],
            limit=2,
            referrer='api.organization-event-details-oldest',
        )

        if 'error' in result or len(result['data']) == 0:
            return Response(status=404)

        data = serialize(SnubaEvent(result['data'][0]))

        data['previousEventID'] = None
        data['nextEventID'] = None

        if len(result['data']) == 2:
            data['nextEventID'] = six.text_type(result['data'][1]['event_id'])

        return Response(data)
