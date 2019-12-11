from __future__ import absolute_import

import six

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry import eventstore, features
from sentry.snuba import discover
from sentry.models.project import Project, ProjectStatus
from sentry.api.serializers import serialize


class OrganizationEventDetailsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization, project_slug, event_id):
        if not features.has("organizations:events-v2", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_filter_params(request, organization)
        except OrganizationEventsError as exc:
            return Response({"detail": exc.message}, status=400)
        except NoProjects:
            return Response(status=404)

        try:
            project = Project.objects.get(
                slug=project_slug, organization_id=organization.id, status=ProjectStatus.VISIBLE
            )
        except Project.DoesNotExist:
            return Response(status=404)
        # Check access to the project as this endpoint doesn't use membership checks done
        # get_filter_params().
        if not request.access.has_project_access(project):
            return Response(status=404)

        # We return the requested event if we find a match regardless of whether
        # it occurred within the range specified
        event = eventstore.get_event_by_id(project.id, event_id)

        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        reference = None
        fields = request.query_params.getlist("field")
        if fields:
            event_slug = u"{}:{}".format(project.slug, event_id)
            reference = discover.ReferenceEvent(organization, event_slug, fields)
        try:
            pagination = discover.get_pagination_ids(
                event=event,
                query=request.query_params.get("query"),
                params=params,
                reference_event=reference,
                referrer="api.organization-event-details",
            )
        except discover.InvalidSearchQuery as err:
            raise ParseError(detail=six.text_type(err))

        data = serialize(event)
        data["nextEventID"] = pagination.next
        data["previousEventID"] = pagination.previous
        data["oldestEventID"] = pagination.oldest
        data["latestEventID"] = pagination.latest
        data["projectSlug"] = project_slug

        return Response(data)

    def next_event_id(self, snuba_args, event):
        """
        Returns the next event ID if there is a subsequent event matching the
        conditions provided. Ignores the project_id.
        """
        next_event = eventstore.get_next_event_id(event, filter=self._get_filter(snuba_args))

        if next_event:
            return next_event[1]

    def prev_event_id(self, snuba_args, event):
        """
        Returns the previous event ID if there is a previous event matching the
        conditions provided. Ignores the project_id.
        """
        prev_event = eventstore.get_prev_event_id(event, filter=self._get_filter(snuba_args))

        if prev_event:
            return prev_event[1]

    def latest_event_id(self, snuba_args, event):
        """
        Returns the latest event ID if there is a newer event matching the
        conditions provided
        """
        latest_event = eventstore.get_latest_event_id(event, filter=self._get_filter(snuba_args))

        if latest_event:
            return latest_event[1]

    def oldest_event_id(self, snuba_args, event):
        """
        Returns the oldest event ID if there is a subsequent event matching the
        conditions provided
        """
        oldest_event = eventstore.get_earliest_event_id(event, filter=self._get_filter(snuba_args))

        if oldest_event:
            return oldest_event[1]

    def _get_filter(self, snuba_args):
        return eventstore.Filter(
            conditions=snuba_args["conditions"],
            start=snuba_args.get("start", None),
            end=snuba_args.get("end", None),
            project_ids=snuba_args["filter_keys"].get("project_id", None),
            group_ids=snuba_args["filter_keys"].get("issue", None),
        )
