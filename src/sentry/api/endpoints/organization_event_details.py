from __future__ import absolute_import

from rest_framework.response import Response
from enum import Enum

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.event_search import get_reference_event_conditions
from sentry import eventstore, features
from sentry.models.project import Project
from sentry.api.serializers import serialize


class EventOrdering(Enum):
    LATEST = 0
    OLDEST = 1


class OrganizationEventDetailsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization, project_slug, event_id):
        if not features.has("organizations:events-v2", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args(request, organization, params)
        except OrganizationEventsError as exc:
            return Response({"detail": exc.message}, status=400)
        except NoProjects:
            return Response(status=404)

        try:
            project = Project.objects.get(slug=project_slug, organization_id=organization.id)
        except Project.DoesNotExist:
            return Response(status=404)

        # We return the requested event if we find a match regardless of whether
        # it occurred within the range specified
        event = eventstore.get_event_by_id(project.id, event_id)

        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        # Scope the pagination related event ids to the current event
        # This ensure that if a field list/groupby conditions were provided
        # that we constrain related events to the query + current event values
        event_slug = u"{}:{}".format(project.slug, event_id)
        snuba_args["conditions"].extend(get_reference_event_conditions(snuba_args, event_slug))

        data = serialize(event)
        data["nextEventID"] = self.next_event_id(snuba_args, event)
        data["previousEventID"] = self.prev_event_id(snuba_args, event)
        data["oldestEventID"] = self.oldest_event_id(snuba_args, event)
        data["latestEventID"] = self.latest_event_id(snuba_args, event)
        data["projectSlug"] = project_slug

        return Response(data)
