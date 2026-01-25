from datetime import datetime
from typing import Any

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Condition

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import IssueEventSerializer, serialize
from sentry.api.serializers.models.event import IssueEventSerializerResponse
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.services import eventstore
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class GroupEventDetailsResponse(IssueEventSerializerResponse):
    nextEventID: str | None
    previousEventID: str | None


def wrap_event_response(
    request_user: Any,
    event: Event | GroupEvent,
    environments: list[str],
    include_full_release_data: bool = False,
    conditions: list[Condition] | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> GroupEventDetailsResponse:
    event_data = serialize(
        event,
        request_user,
        IssueEventSerializer(),
        include_full_release_data=include_full_release_data,
    )
    # Used for paginating through events of a single issue in group details
    # Skip next/prev for issueless events
    next_event_id = None
    prev_event_id = None

    if conditions is None:
        conditions = []

    if event.group_id:
        if options.get("eventstore.adjacent_event_ids_use_snql"):
            prev_ids, next_ids = eventstore.backend.get_adjacent_event_ids_snql(
                organization_id=event.organization.id,
                project_id=event.project_id,
                group_id=event.group_id,
                environments=environments,
                event=event,
                conditions=conditions,
                start=start,
                end=end,
            )
        else:
            legacy_conditions = []
            if environments:
                legacy_conditions.append(["environment", "IN", environments])

            _filter = eventstore.Filter(
                conditions=legacy_conditions,
                project_ids=[event.project_id],
                group_ids=[event.group_id],
                start=start,
                end=end,
            )

            prev_ids, next_ids = eventstore.backend.get_adjacent_event_ids(event, filter=_filter)

        next_event_id = next_ids[1] if next_ids else None
        prev_event_id = prev_ids[1] if prev_ids else None

    event_data["nextEventID"] = next_event_id
    event_data["previousEventID"] = prev_event_id
    return event_data


@region_silo_endpoint
class ProjectEventDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=5, window=1),
                RateLimitCategory.USER: RateLimit(limit=5, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=1),
            },
        }
    )

    def get(self, request: Request, project: Project, event_id: str) -> Response:
        """
        Retrieve an Event for a Project
        ```````````````````````````````

        Return details on an individual event.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          event belongs to.
        :pparam string project_id_or_slug: the id or slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event to retrieve.
                                 It is the hexadecimal id as
                                 reported by the raven client)
        :auth: required
        """
        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams:
            raise ParseError(detail="Invalid date range")

        group_id_s = request.GET.get("group_id")
        group_id = int(group_id_s) if group_id_s else None

        event = eventstore.backend.get_event_by_id(project.id, event_id, group_id=group_id)

        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        environments = set(request.GET.getlist("environment"))

        # TODO: Remove `for_group` check once performance issues are moved to the issue platform
        if hasattr(event, "for_group") and event.group:
            event = event.for_group(event.group)

        data = wrap_event_response(
            request_user=request.user,
            event=event,
            environments=list(environments),
            include_full_release_data=True,
            start=start,
            end=end,
        )
        return Response(data)


from sentry.api.bases.event import EventEndpoint


@region_silo_endpoint
class EventJsonEndpoint(EventEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project: Project, event: Event) -> Response:

        event_dict = event.as_dict()
        if isinstance(event_dict["datetime"], datetime):
            event_dict["datetime"] = event_dict["datetime"].isoformat()

        try:
            scrub_ip_addresses = project.organization.get_option(
                "sentry:require_scrub_ip_address", False
            ) or project.get_option("sentry:scrub_ip_address", False)

            if scrub_ip_addresses:
                if "spans" in event_dict:
                    for span in event_dict["spans"]:
                        if "sentry_tags" not in span:
                            continue
                        if "user.ip" in span["sentry_tags"]:
                            del span["sentry_tags"]["user.ip"]
                        if "user" in span["sentry_tags"] and span["sentry_tags"]["user"].startswith(
                            "ip:"
                        ):
                            span["sentry_tags"]["user"] = "ip:[ip]"
        except Exception as e:
            sentry_sdk.capture_exception(e)

        return Response(event_dict, status=200)
