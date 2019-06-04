from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import SnubaEvent
from sentry.models.project import Project
from sentry.api.serializers import serialize


class OrganizationEventDetailsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization, project_slug, event_id):
        try:
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args_v2(request, organization, params)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response([])

        try:
            project = Project.objects.get(
                slug=project_slug,
                organization_id=organization.id
            )
        except Project.DoesNotExist:
            raise ResourceDoesNotExist

        snuba_event = SnubaEvent.objects.from_event_id(event_id, project.id)

        if snuba_event is None:
            return Response({'detail': 'Event not found'}, status=404)

        data = serialize(snuba_event)

        data['nextEventID'] = self.next_event_id(request, organization, snuba_args, snuba_event)
        data['previousEventID'] = self.prev_event_id(request, organization, snuba_args, snuba_event)

        return Response(data)
