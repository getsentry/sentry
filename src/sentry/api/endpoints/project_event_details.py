from copy import deepcopy
from datetime import datetime
from typing import Any, List

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import DetailedEventSerializer, serialize
from sentry.eventstore.models import Event
from sentry.issues.query import apply_performance_conditions
from sentry.models.project import Project


def wrap_event_response(request_user: Any, event: Event, project: Project, environments: List[str]):
    event_data = serialize(event, request_user, DetailedEventSerializer())
    # Used for paginating through events of a single issue in group details
    # Skip next/prev for issueless events
    next_event_id = None
    prev_event_id = None

    if event.group_id:
        if (
            features.has("organizations:performance-issues", project.organization)
            and event.get_event_type() == "transaction"
        ):
            conditions = apply_performance_conditions([], event.group)
            _filter = eventstore.Filter(
                conditions=conditions,
                project_ids=[event.project_id],
            )
        else:
            conditions = [["event.type", "!=", "transaction"]]
            _filter = eventstore.Filter(
                conditions=conditions,
                project_ids=[event.project_id],
                group_ids=[event.group_id],
            )

        if environments:
            conditions.append(["environment", "IN", environments])

        # Ignore any time params and search entire retention period
        next_event_filter = deepcopy(_filter)
        next_event_filter.end = datetime.utcnow()
        next_event = eventstore.get_next_event_id(event, filter=next_event_filter)

        prev_event_filter = deepcopy(_filter)
        prev_event_filter.start = datetime.utcfromtimestamp(0)
        prev_event = eventstore.get_prev_event_id(event, filter=prev_event_filter)

        next_event_id = next_event[1] if next_event else None
        prev_event_id = prev_event[1] if prev_event else None

    event_data["nextEventID"] = next_event_id
    event_data["previousEventID"] = prev_event_id
    return event_data


@region_silo_endpoint
class ProjectEventDetailsEndpoint(ProjectEndpoint):
    def get(self, request: Request, project, event_id) -> Response:
        """
        Retrieve an Event for a Project
        ```````````````````````````````

        Return details on an individual event.

        :pparam string organization_slug: the slug of the organization the
                                          event belongs to.
        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event to retrieve.
                                 It is the hexadecimal id as
                                 reported by the raven client)
        :auth: required
        """

        group_id = request.GET.get("group_id")
        group_id = int(group_id) if group_id else None

        event = eventstore.get_event_by_id(project.id, event_id, group_id=group_id)

        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        environments = set(request.GET.getlist("environment"))

        data = wrap_event_response(request.user, event, project, environments)
        return Response(data)


from rest_framework.request import Request
from rest_framework.response import Response


@region_silo_endpoint
class EventJsonEndpoint(ProjectEndpoint):
    def get(self, request: Request, project, event_id) -> Response:
        event = eventstore.get_event_by_id(project.id, event_id)

        if not event:
            return Response({"detail": "Event not found"}, status=404)

        event_dict = event.as_dict()
        if isinstance(event_dict["datetime"], datetime):
            event_dict["datetime"] = event_dict["datetime"].isoformat()

        return Response(event_dict, status=200)
