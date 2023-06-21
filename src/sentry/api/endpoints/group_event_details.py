from __future__ import annotations

from typing import TYPE_CHECKING, Sequence

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Condition, Or
from snuba_sdk.legacy import is_condition, parse_condition

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.endpoints.project_event_details import wrap_event_response
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.group_index import validate_search_filter_permissions
from sentry.api.issue_search import convert_query_values, parse_search_query
from sentry.api.serializers import EventSerializer, serialize
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Environment, Project, User
from sentry.search.events.filter import convert_search_filter_to_snuba_query, format_search_filter
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models.group import Group


def issue_search_query_to_conditions(
    query: str, projects: Sequence[Project], user: User, environments: Sequence[Environment]
) -> Sequence[Condition]:
    try:
        search_filters = convert_query_values(
            parse_search_query(query),
            projects,
            user,
            [e.name for e in environments],
        )
    except InvalidSearchQuery:
        raise ParseError(detail=f"Error parsing search query: {query}")

    validate_search_filter_permissions(projects[0].organization, search_filters, user)
    legacy_conditions = []

    if search_filters:
        for search_filter in search_filters:
            from sentry.api.serializers import GroupSerializerSnuba

            if search_filter.key.name not in GroupSerializerSnuba.skip_snuba_fields:
                filter_keys = {
                    "organization_id": [p.organization.id for p in projects],
                    "project_id": [p.id for p in projects],
                    "environment_id": [env.id for env in environments],
                }
                legacy_condition, projects_to_filter, group_ids = format_search_filter(
                    search_filter, params=filter_keys
                )

                # if no re-formatted conditions, use fallback method
                new_condition = None
                if legacy_condition:
                    new_condition = legacy_condition[0]
                elif group_ids:
                    new_condition = convert_search_filter_to_snuba_query(
                        search_filter, params=filter_keys
                    )

                if new_condition:
                    legacy_conditions.append(new_condition)

    snql_conditions = []
    for cond in legacy_conditions or ():
        if not is_condition(cond):
            # this shouldn't be possible since issue search only allows ands
            or_conditions = []
            for or_cond in cond:
                or_conditions.append(parse_condition(or_cond))

            if len(or_conditions) > 1:
                snql_conditions.append(Or(or_conditions))
            else:
                snql_conditions.extend(or_conditions)
        else:
            snql_conditions.append(parse_condition(cond))

    return snql_conditions


@region_silo_endpoint
class GroupEventDetailsEndpoint(GroupEndpoint):
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(15, 1),
            RateLimitCategory.USER: RateLimit(15, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(15, 1),
        }
    }

    def get(self, request: Request, group: Group, event_id: str) -> Response:
        """
        Retrieve the latest(most recent), oldest, or most helpful Event for an Issue
        ``````````````````````````````````````

        Retrieves the details of the latest/oldest/most-helpful event for an issue.

        :pparam string group_id: the ID of the issue
        """
        environments = [e for e in get_environments(request, group.project.organization)]
        environment_names = [e.name for e in environments]

        if event_id == "latest":
            with metrics.timer("api.endpoints.group_event_details.get", tags={"type": "latest"}):
                event = group.get_latest_event_for_environments(environments)
        elif event_id == "oldest":
            with metrics.timer("api.endpoints.group_event_details.get", tags={"type": "oldest"}):
                event = group.get_oldest_event_for_environments(environments)
        elif event_id == "helpful":
            if features.has(
                "organizations:issue-details-most-helpful-event",
                group.project.organization,
                actor=request.user,
            ):
                with metrics.timer(
                    "api.endpoints.group_event_details.get", tags={"type": "helpful"}
                ):
                    event = group.get_helpful_event_for_environments(environments)
            else:
                return Response(status=404)
        else:
            with metrics.timer("api.endpoints.group_event_details.get", tags={"type": "event"}):
                event = eventstore.backend.get_event_by_id(
                    group.project.id, event_id, group_id=group.id
                )
            # TODO: Remove `for_group` check once performance issues are moved to the issue platform
            if hasattr(event, "for_group") and event.group:
                event = event.for_group(event.group)

        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        collapse = request.GET.getlist("collapse", [])
        if "stacktraceOnly" in collapse:
            return Response(serialize(event, request.user, EventSerializer()))

        data = wrap_event_response(
            request.user,
            event,
            environment_names,
            include_full_release_data="fullRelease" not in collapse,
        )
        return Response(data)
