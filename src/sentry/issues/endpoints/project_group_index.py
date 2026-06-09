import functools
import logging
from typing import TypedDict

import sentry_sdk
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.project_issue_searched import ProjectIssueSearchEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.helpers.environments import get_environment_func
from sentry.api.helpers.group_index import (
    get_by_short_id,
    prep_search,
    schedule_tasks_to_delete_groups,
    track_slo_response,
    update_groups_with_search_fn,
)
from sentry.api.helpers.group_index.types import MutateIssueResponse
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import (
    StreamGroupSerializer,
    StreamGroupSerializerResponse,
)
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import (
    CursorQueryParam,
    GlobalParams,
    IssueParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.exceptions import InvalidSearchQuery
from sentry.models.environment import Environment
from sentry.models.group import QUERY_STATUS_LOOKUP, Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.search.events.constants import EQUALITY_OPERATORS
from sentry.services import eventstore
from sentry.signals import advanced_search
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.validators import normalize_event_id

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"
ERR_HASHES_AND_OTHER_QUERY = "Cannot use 'hashes' with 'query'"
logger = logging.getLogger(__name__)


class ProjectGroupIndexResponseOptional(TypedDict, total=False):
    matchingEventId: str
    matchingEventEnvironment: str


class ProjectGroupIndexResponse(StreamGroupSerializerResponse, ProjectGroupIndexResponseOptional):
    pass


class ProjectGroupIndexDetailResponse(TypedDict):
    detail: str | list[str]


class ProjectGroupIndexStatusDetailsSerializer(serializers.Serializer):
    inRelease = serializers.CharField(required=False)
    inNextRelease = serializers.BooleanField(required=False)
    inCommit = serializers.CharField(required=False)
    ignoreDuration = serializers.IntegerField(required=False)
    ignoreCount = serializers.IntegerField(required=False)
    ignoreWindow = serializers.IntegerField(required=False)
    ignoreUserCount = serializers.IntegerField(required=False)
    ignoreUserWindow = serializers.IntegerField(required=False)


class ProjectGroupIndexBulkMutateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=["resolved", "resolvedInNextRelease", "unresolved", "ignored"],
        required=False,
        help_text="The new status for the issues.",
    )
    statusDetails = ProjectGroupIndexStatusDetailsSerializer(
        required=False,
        help_text="Additional details about the resolution.",
    )
    ignoreDuration = serializers.IntegerField(
        required=False,
        help_text="The number of minutes to ignore this issue.",
    )
    isPublic = serializers.BooleanField(
        required=False,
        help_text="If true, publishes the issue.",
    )
    merge = serializers.BooleanField(
        required=False,
        help_text="If true, merges the issues together.",
    )
    assignedTo = serializers.CharField(
        required=False,
        help_text="The actor ID, username, user email, or team ID to assign to this issue.",
    )
    hasSeen = serializers.BooleanField(
        required=False,
        help_text="If true, marks the issue as seen by the requestor.",
    )
    isBookmarked = serializers.BooleanField(
        required=False,
        help_text="If true, bookmarks the issue for the requestor.",
    )


_PROJECT_ISSUES_STATS_PERIOD_PARAM = OpenApiParameter(
    name="statsPeriod",
    location=OpenApiParameter.QUERY,
    required=False,
    type=OpenApiTypes.STR,
    enum=["", "24h", "14d"],
    description='An optional stats period. Valid values are `"24h"`, `"14d"`, and `""`.',
)
_PROJECT_ISSUES_HASHES_PARAM = OpenApiParameter(
    name="hashes",
    location=OpenApiParameter.QUERY,
    required=False,
    type=OpenApiTypes.STR,
    many=True,
    description=(
        "A list of hashes of groups to return. This is not compatible with `query`. "
        "The maximum number of hashes that can be sent is 100."
    ),
)
_PROJECT_ISSUES_STATUS_PARAM = OpenApiParameter(
    name="status",
    location=OpenApiParameter.QUERY,
    required=False,
    type=OpenApiTypes.STR,
    enum=["resolved", "reprocessing", "unresolved", "ignored"],
    description="Optionally limits mutations to issues of the specified status.",
)

_PROJECT_ISSUES_GET_EXAMPLE = OpenApiExample(
    "List project issues",
    value=[
        {
            "annotations": [],
            "assignedTo": None,
            "count": "1",
            "culprit": "raven.scripts.runner in main",
            "firstSeen": "2018-11-06T21:19:55Z",
            "hasSeen": False,
            "id": "1",
            "isBookmarked": False,
            "isPublic": False,
            "isSubscribed": True,
            "lastSeen": "2018-11-06T21:19:55Z",
            "level": "error",
            "logger": None,
            "metadata": {"title": "This is an example Python exception"},
            "numComments": 0,
            "permalink": "https://sentry.io/the-interstellar-jurisdiction/pump-station/issues/1/",
            "platform": "python",
            "priority": "medium",
            "priorityLockedAt": None,
            "project": {
                "id": "2",
                "name": "Pump Station",
                "slug": "pump-station",
                "platform": "python",
            },
            "seerAutofixLastTriggered": None,
            "seerExplorerAutofixLastTriggered": None,
            "seerFixabilityScore": None,
            "shareId": None,
            "shortId": "PUMP-STATION-1",
            "stats": {
                "24h": [
                    [1541455200.0, 473],
                    [1541458800.0, 914],
                ]
            },
            "status": "unresolved",
            "statusDetails": {},
            "substatus": "ongoing",
            "subscriptionDetails": None,
            "title": "This is an example Python exception",
            "type": "default",
            "issueType": "error",
            "issueCategory": "error",
            "userCount": 0,
        }
    ],
    response_only=True,
    status_codes=["200"],
)
_PROJECT_ISSUES_PUT_REQUEST_EXAMPLE = OpenApiExample(
    "Bulk mutate project issues request",
    value={"isPublic": False, "status": "unresolved"},
    request_only=True,
)
_PROJECT_ISSUES_PUT_RESPONSE_EXAMPLE = OpenApiExample(
    "Bulk mutate project issues response",
    value={"isPublic": False, "status": "unresolved", "statusDetails": {}},
    response_only=True,
    status_codes=["200"],
)


@extend_schema(tags=["Events"])
@cell_silo_endpoint
class ProjectGroupIndexEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (ProjectEventPermission,)
    enforce_rate_limit = True

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=5, window=1),
                RateLimitCategory.USER: RateLimit(limit=5, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=1),
            }
        }
    )

    @extend_schema(
        operation_id="List a Project's Issues",
        description=(
            "**Deprecated**: This endpoint has been replaced with the "
            "[Organization Issues endpoint](/api/events/list-an-organizations-issues/), "
            "which supports filtering on project and additional functionality.\n\n"
            "Return a list of issues bound to a project. A default query of "
            "`is:unresolved` is applied. To return results with other statuses, "
            "send a new query value, such as `?query=` for all results.\n\n"
            "User feedback items from the "
            "[User Feedback Widget](https://docs.sentry.io/product/user-feedback/#user-feedback-widget) "
            "are built on the issue platform. To return user feedback items for a "
            "specific project, filter for `issue.category:feedback`."
        ),
        parameters=[
            IssueParams.ISSUES_OR_GROUPS,
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            GlobalParams.ENVIRONMENT,
            _PROJECT_ISSUES_STATS_PERIOD_PARAM,
            CursorQueryParam,
            IssueParams.DEFAULT_QUERY,
            IssueParams.SHORT_ID_LOOKUP,
            _PROJECT_ISSUES_HASHES_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectGroupIndexResponse", list[ProjectGroupIndexResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[_PROJECT_ISSUES_GET_EXAMPLE],
    )
    @track_slo_response("workflow")
    def get(
        self, request: Request, project: Project
    ) -> Response[list[ProjectGroupIndexResponse]] | Response[ProjectGroupIndexDetailResponse]:
        stats_period = request.GET.get("statsPeriod")
        if stats_period not in (None, "", "24h", "14d"):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        elif stats_period is None:
            # default
            stats_period = "24h"
        elif stats_period == "":
            # disable stats
            stats_period = None

        serializer = StreamGroupSerializer(
            environment_func=get_environment_func(request, project.organization_id),
            stats_period=stats_period,
        )

        hashes = request.GET.getlist("hashes", [])
        query = request.GET.get("query", "").strip()

        if hashes:
            if query:
                return Response({"detail": ERR_HASHES_AND_OTHER_QUERY}, status=400)

            # limit to 100 hashes
            hashes = hashes[:100]
            groups_from_hashes = GroupHash.objects.filter(
                hash__in=hashes, project=project
            ).values_list("group_id", flat=True)
            groups = list(Group.objects.filter(id__in=groups_from_hashes))

            serialized_groups = serialize(groups, request.user, serializer)
            return Response(serialized_groups)

        if query:
            matching_group = None
            matching_event = None
            event_id = normalize_event_id(query)
            if event_id:
                # check to see if we've got an event ID
                try:
                    matching_group = Group.objects.from_event_id(project, event_id)
                except Group.DoesNotExist:
                    pass
                else:
                    matching_event = eventstore.backend.get_event_by_id(project.id, event_id)
            elif matching_group is None:
                matching_group = get_by_short_id(
                    project.organization_id, request.GET.get("shortIdLookup", "0"), query
                )
                if matching_group is not None and matching_group.project_id != project.id:
                    matching_group = None

            if matching_group is not None:
                matching_event_environment = None

                try:
                    matching_event_environment = (
                        matching_event.get_environment().name if matching_event else None
                    )
                except Environment.DoesNotExist:
                    pass

                serialized_groups = serialize([matching_group], request.user, serializer)
                matching_event_id = getattr(matching_event, "event_id", None)
                if matching_event_id:
                    serialized_groups[0]["matchingEventId"] = getattr(
                        matching_event, "event_id", None
                    )
                if matching_event_environment:
                    serialized_groups[0]["matchingEventEnvironment"] = matching_event_environment

                response = Response(serialized_groups)

                response["X-Sentry-Direct-Hit"] = "1"
                return response

        try:
            cursor_result, query_kwargs = prep_search(request, project, {"count_hits": True})
        except (ValidationError, InvalidSearchQuery) as exc:
            return Response({"detail": str(exc)}, status=400)

        results = list(cursor_result)

        context = serialize(results, request.user, serializer)

        # HACK: remove auto resolved entries
        # TODO: We should try to integrate this into the search backend, since
        # this can cause us to arbitrarily return fewer results than requested.
        status = [
            search_filter
            for search_filter in query_kwargs.get("search_filters", [])
            if search_filter.key.name == "status" and search_filter.operator in EQUALITY_OPERATORS
        ]
        if status and (GroupStatus.UNRESOLVED in status[0].value.raw_value):
            status_labels = {QUERY_STATUS_LOOKUP[s] for s in status[0].value.raw_value}
            context = [r for r in context if "status" not in r or r["status"] in status_labels]

        response = Response(context)

        self.add_cursor_headers(request, response, cursor_result)

        if results and query:
            advanced_search.send(project=project, sender=request.user)
            try:
                analytics.record(
                    ProjectIssueSearchEvent(
                        user_id=request.user.id,
                        organization_id=project.organization_id,
                        project_id=project.id,
                        query=query,
                    )
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

        return response

    @extend_schema(
        operation_id="Bulk Mutate a List of Issues",
        description=(
            "Bulk mutate various attributes on issues. The list of issues to modify "
            "is given through the repeated `id` query parameter.\n\n"
            "- For non-status updates, the `id` query parameter is required.\n"
            "- For status updates, the `id` query parameter may be omitted for a "
            'batch "update all" query.\n'
            "- An optional `status` query parameter may restrict mutations to only "
            "events with the given status.\n\n"
            "If any IDs are out of scope, this operation succeeds without mutating "
            "those issues."
        ),
        parameters=[
            IssueParams.ISSUES_OR_GROUPS,
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            IssueParams.MUTATE_ISSUE_ID_LIST,
            _PROJECT_ISSUES_STATUS_PARAM,
        ],
        request=ProjectGroupIndexBulkMutateSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "ProjectGroupIndexPutResponse", MutateIssueResponse
            ),
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[_PROJECT_ISSUES_PUT_REQUEST_EXAMPLE, _PROJECT_ISSUES_PUT_RESPONSE_EXAMPLE],
    )
    @track_slo_response("workflow")
    def put(
        self, request: Request, project: Project
    ) -> Response[MutateIssueResponse] | Response[None] | Response[ProjectGroupIndexDetailResponse]:
        search_fn = functools.partial(prep_search, request, project)
        return update_groups_with_search_fn(
            request,
            request.GET.getlist("id"),
            [project],
            project.organization_id,
            search_fn,
        )

    @extend_schema(
        operation_id="Bulk Remove a List of Issues",
        description=(
            "Permanently remove the given issues. The list of issues to remove is "
            "given through the repeated `id` query parameter.\n\n"
            "Only queries by `id` are accepted. If any IDs are out of scope, this "
            "operation succeeds without mutating those issues."
        ),
        parameters=[
            IssueParams.ISSUES_OR_GROUPS,
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            IssueParams.DELETE_ISSUE_ID_LIST,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @track_slo_response("workflow")
    def delete(
        self, request: Request, project: Project
    ) -> Response[None] | Response[ProjectGroupIndexDetailResponse]:
        search_fn = functools.partial(prep_search, request, project)
        try:
            return schedule_tasks_to_delete_groups(
                request, [project], project.organization_id, search_fn
            )
        except Exception:
            logger.exception("Error deleting groups")
            return Response({"detail": "Error deleting groups"}, status=500)
