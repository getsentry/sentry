from __future__ import annotations

import logging
from collections.abc import Sequence

from django.contrib.auth.models import AnonymousUser
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Condition, Or
from snuba_sdk.legacy import is_condition, parse_condition

from sentry import eventstore, features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.group_index import parse_and_convert_issue_search_query
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.serializers import EventSerializer, serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.event_examples import EventExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.eventstore.models import Event, GroupEvent
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
) -> Sequence[Condition]:
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
            OpenApiParameter(
                name="event_id",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.PATH,
                description="The ID of the event to retrieve, or 'latest', 'oldest', or 'recommended'.",
                required=True,
                enum=["latest", "oldest", "recommended"],
            ),
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
        environments = [e for e in get_environments(request, group.project.organization)]
        environment_names = [e.name for e in environments]
        # The streamlined UI doesn't want a fallback if a query has no results.
        should_always_return_event = not features.has(
            "organizations:issue-details-streamline", group.organization, actor=request.user
        )

        if event_id == "latest":
            with metrics.timer("api.endpoints.group_event_details.get", tags={"type": "latest"}):
                event: Event | GroupEvent | None = group.get_latest_event_for_environments(
                    environment_names
                )
        elif event_id == "oldest":
            with metrics.timer("api.endpoints.group_event_details.get", tags={"type": "oldest"}):
                event = group.get_oldest_event_for_environments(environment_names)
        elif event_id == "recommended":
            query = request.GET.get("query")
            if query:
                with metrics.timer(
                    "api.endpoints.group_event_details.get",
                    tags={"type": "helpful", "query": True},
                ):
                    try:
                        conditions = issue_search_query_to_conditions(
                            query, group, request.user, environments
                        )
                        event = group.get_recommended_event_for_environments(
                            environments=environments,
                            conditions=conditions,
                            always_return_event=should_always_return_event,
                        )
                    except ValidationError:
                        return Response(status=400)
                    except Exception:
                        logging.exception(
                            "group_event_details:get_helpful",
                        )
                        return Response(status=500)
            else:
                with metrics.timer(
                    "api.endpoints.group_event_details.get",
                    tags={"type": "helpful", "query": False},
                ):
                    event = group.get_recommended_event_for_environments(
                        environments=environments,
                        always_return_event=should_always_return_event,
                    )
        else:
            with metrics.timer("api.endpoints.group_event_details.get", tags={"type": "event"}):
                event = eventstore.backend.get_event_by_id(
                    group.project.id, event_id, group_id=group.id
                )
            # TODO: Remove `for_group` check once performance issues are moved to the issue platform

            if event is not None and hasattr(event, "for_group") and event.group:
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
