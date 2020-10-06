from __future__ import absolute_import

from copy import deepcopy
from datetime import datetime
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import DetailedEventSerializer, serialize


class ProjectEventDetailsEndpoint(ProjectEndpoint):
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

        event = eventstore.get_event_by_id(project.id, event_id)

        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        data = serialize(event, request.user, DetailedEventSerializer())

        # Used for paginating through events of a single issue in group details
        # Skip next/prev for issueless events
        next_event_id = None
        prev_event_id = None

        if event.group_id:
            requested_environments = set(request.GET.getlist("environment"))
            conditions = [["event.type", "!=", "transaction"]]

            if requested_environments:
                conditions.append(["environment", "IN", requested_environments])

            _filter = eventstore.Filter(
                conditions=conditions, project_ids=[event.project_id], group_ids=[event.group_id]
            )

            # Ignore any time params and search entire retention period
            next_event_filter = deepcopy(_filter)
            next_event_filter.end = datetime.utcnow()
            next_event = eventstore.get_next_event_id(event, filter=next_event_filter)

            prev_event_filter = deepcopy(_filter)
            prev_event_filter.start = datetime.utcfromtimestamp(0)
            prev_event = eventstore.get_prev_event_id(event, filter=prev_event_filter)

            next_event_id = next_event[1] if next_event else None
            prev_event_id = prev_event[1] if prev_event else None

        data["nextEventID"] = next_event_id
        data["previousEventID"] = prev_event_id

        return Response(data)


class EventJsonEndpoint(ProjectEndpoint):
    def get(self, request, project, event_id):
        event = eventstore.get_event_by_id(project.id, event_id)

        if not event:
            return Response({"detail": "Event not found"}, status=404)

        event_dict = event.as_dict()
        if isinstance(event_dict["datetime"], datetime):
            event_dict["datetime"] = event_dict["datetime"].isoformat()

        return Response(event_dict, status=200)
