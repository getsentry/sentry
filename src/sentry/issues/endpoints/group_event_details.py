from __future__ import annotations

import logging
from collections.abc import Sequence

from django.contrib.auth.models import AnonymousUser
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Op, Or
from snuba_sdk.legacy import is_condition, parse_condition

from sentry import eventstore
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.group_index import parse_and_convert_issue_search_query
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.serializers import EventSerializer, serialize
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.event_examples import EventExamples
from sentry.apidocs.parameters import EventParams, GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.eventstore.models import Event, GroupEvent
from sentry.exceptions import InvalidParams
from sentry.issues.endpoints.project_event_details import (
    GroupEventDetailsResponse,
    wrap_event_response,
)
from sentry.issues.grouptype import GroupCategory
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.search.events.filter import (
    FilterConvertParams,
    convert_search_filter_to_snuba_query,
    format_search_filter,
)
from sentry.snuba.dataset import Dataset
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.utils import metrics


def issue_search_query_to_conditions(
    query: str, group: Group, user: User | AnonymousUser, environments: Sequence[Environment]
) -> list[Condition]:
    from sentry.utils.snuba import resolve_column, resolve_conditions

    dataset = (
        Dataset.Events if group.issue_category == GroupCategory.ERROR else Dataset.IssuePlatform
    )

    # syntactically correct search filters
    search_filters = parse_and_convert_issue_search_query(
        query, group.project.organization, [group.project], environments, user
    )

    # transform search filters -> the legacy condition format
    legacy_conditions = []
    if search_filters:
        for search_filter in search_filters:
            from sentry.api.serializers import GroupSerializerSnuba

            if search_filter.key.name not in GroupSerializerSnuba.skip_snuba_fields:
                filter_keys: FilterConvertParams = {
                    "organization_id": group.project.organization.id,
                    "project_id": [group.project.id],
                    "environment": [env.name for env in environments],
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
                        search_filter,
                        params=filter_keys,
                    )

                if new_condition:
                    legacy_conditions.append(new_condition)

    # the transformed conditions is generic and isn't 'dataset aware', we need to map the generic columns
    # being queried to the appropriate dataset column
    resolved_legacy_conditions = resolve_conditions(legacy_conditions, resolve_column(dataset))

    # convert the legacy condition format into the SnQL condition format
    snql_conditions = []
    for cond in resolved_legacy_conditions or ():
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


@extend_schema(tags=["Events"])
@region_silo_endpoint
class GroupEventDetailsEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=15, window=1),
            RateLimitCategory.USER: RateLimit(limit=15, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=15, window=1),
        }
    }

    @extend_schema(
        operation_id="Retrieve an Issue Event",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            GlobalParams.ENVIRONMENT,
            EventParams.EVENT_ID_EXTENDED,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "IssueEventDetailsResponse", GroupEventDetailsResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EventExamples.GROUP_EVENT_DETAILS,
    )
    def get(self, request: Request, group: Group, event_id: str) -> Response:
        """
        Retrieves the details of an issue event.
        """
        organization = group.project.organization
        environments = [e for e in get_environments(request, organization)]
        environment_names = [e.name for e in environments]

        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams:
            raise ParseError(detail="Invalid date range")

        query = request.GET.get("query")
        try:
            conditions: list[Condition] = (
                issue_search_query_to_conditions(query, group, request.user, environments)
                if query
                else []
            )
        except ValidationError:
            raise ParseError(detail="Invalid event query")
        except Exception:
            logging.exception(
                "group_event_details.parse_query",
                extra={"query": query, "group": group.id, "organization": organization.id},
            )
            raise ParseError(detail="Unable to parse query")

        if environments:
            conditions.append(Condition(Column("environment"), Op.IN, environment_names))

        metric = "api.endpoints.group_event_details.get"
        error_response = {"detail": "Unable to apply query. Change or remove it and try again."}

        event: Event | GroupEvent | None = None

        if event_id == "latest":
            with metrics.timer(metric, tags={"type": "latest", "query": bool(query)}):
                try:
                    event = group.get_latest_event(conditions=conditions, start=start, end=end)
                except ValueError:
                    return Response(error_response, status=400)

        elif event_id == "oldest":
            with metrics.timer(metric, tags={"type": "oldest", "query": bool(query)}):
                try:
                    event = group.get_oldest_event(conditions=conditions, start=start, end=end)
                except ValueError:
                    return Response(error_response, status=400)

        elif event_id == "recommended":
            with metrics.timer(metric, tags={"type": "helpful", "query": bool(query)}):
                try:
                    event = group.get_recommended_event(conditions=conditions, start=start, end=end)
                except ValueError:
                    return Response(error_response, status=400)

        else:
            with metrics.timer(metric, tags={"type": "event"}):
                event = eventstore.backend.get_event_by_id(
                    project_id=group.project.id, event_id=event_id, group_id=group.id
                )
            if isinstance(event, Event) and event.group:
                event = event.for_group(event.group)

        if event is None:
            error_text = (
                "Event not found. The event ID may be incorrect, or its age exceeded the retention period."
                if event_id not in {"recommended", "latest", "oldest"}
                else "No matching event found. Try changing the environments, date range, or query."
            )
            return Response({"detail": error_text}, status=404)

        collapse = request.GET.getlist("collapse", [])
        if "stacktraceOnly" in collapse:
            return Response(serialize(event, request.user, EventSerializer()))

        data = wrap_event_response(
            request_user=request.user,
            event=event,
            environments=environments,
            include_full_release_data="fullRelease" not in collapse,
            conditions=conditions,
        )
        return Response(data)
