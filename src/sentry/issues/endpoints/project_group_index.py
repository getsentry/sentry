import functools
import logging
from typing import Literal, TypedDict

import sentry_sdk
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, eventstore
from sentry.analytics.events.project_issue_searched import ProjectIssueSearchEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.fields import ActorField
from sentry.api.helpers.environments import get_environment_func
from sentry.api.helpers.group_index import (
    get_by_short_id,
    prep_search,
    schedule_tasks_to_delete_groups,
    track_slo_response,
    update_groups_with_search_fn,
)
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.helpers.group_index.validators.status_details import StatusDetailsValidator
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
)
from sentry.apidocs.examples.issue_examples import IssueExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.exceptions import InvalidSearchQuery
from sentry.models.environment import Environment
from sentry.models.group import QUERY_STATUS_LOOKUP, Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.search.events.constants import EQUALITY_OPERATORS
from sentry.signals import advanced_search
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.validators import normalize_event_id

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"
ERR_HASHES_AND_OTHER_QUERY = "Cannot use 'hashes' with 'query'"
logger = logging.getLogger(__name__)


class ProjectGroupIndexPutResponse(TypedDict):
    isPublic: bool
    status: Literal["resolved", "unresolved", "ignored"]
    statusDetails: dict


class ProjectGroupIndexMutateRequestSerializer(serializers.Serializer):
    status = serializers.CharField(
        help_text='The new status for the issues. Valid values are `"resolved"`, `"resolvedInNextRelease"`, `"unresolved"`, and `"ignored"`.',
        required=False,
    )
    statusDetails = StatusDetailsValidator(
        help_text='Additional details about the resolution. Valid values are `"inRelease"`, `"inNextRelease"`, `"inCommit"`, `"ignoreDuration"`, `"ignoreCount"`, `"ignoreWindow"`, `"ignoreUserCount"`, and `"ignoreUserWindow"`.',
        required=False,
    )
    ignoreDuration = serializers.IntegerField(
        help_text="The number of minutes to ignore this issue.",
        required=False,
    )
    isPublic = serializers.BooleanField(
        help_text="Sets the issue to public or private.",
        required=False,
    )
    merge = serializers.BooleanField(
        help_text="Allows to merge or unmerge different issues.",
        required=False,
    )
    assignedTo = ActorField(
        help_text="The actor ID (or username) of the user or team that should be assigned to this issue.",
        required=False,
    )
    hasSeen = serializers.BooleanField(
        help_text="In case this API call is invoked with a user context this allows changing of the flag that indicates if the user has seen the event.",
        required=False,
    )
    isBookmarked = serializers.BooleanField(
        help_text="In case this API call is invoked with a user context this allows changing of the bookmark flag.",
        required=False,
    )


@extend_schema(tags=["Events"])
@region_silo_endpoint
class ProjectGroupIndexEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    # TODO: is it alright for these to be updated to PUBLIC?
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
            "**Deprecated**: This endpoint has been replaced with the [Organization "
            "Issues endpoint](/api/events/list-an-organizations-issues/) which "
            "supports filtering on project and additional functionality.\n\n"
            "Return a list of issues (groups) bound to a project. All parameters are "
            "supplied as query string parameters. \n\n"
            "A default query of `is:unresolved` is applied. To return results with other statuses send an new query value (i.e. `?query=` for all results).\n\n"
            'The `statsPeriod` parameter can be used to select the timeline stats which should be present. Possible values are: `""` (disable),`"24h"` (default), `"14d"`\n\n'
            "User feedback items from the [User Feedback Widget](https://docs.sentry.io/product/user-feedback/#user-feedback-widget) are built off the issue platform, so to return a list of user feedback items for a specific project, filter for `issue.category:feedback`."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            OpenApiParameter(
                name="statsPeriod",
                location=OpenApiParameter.QUERY,
                type=OpenApiTypes.STR,
                description='An optional stat period (can be one of `"24h"`, `"14d"`, and `""`), defaults to "24h" if not provided.',
                required=False,
            ),
            OpenApiParameter(
                name="shortIdLookup",
                location=OpenApiParameter.QUERY,
                type=OpenApiTypes.BOOL,
                description="If this is set to true then short IDs are looked up by this function as well. This can cause the return value of the function to return an event issue of a different project which is why this is an opt-in. Set to 1 to enable.",
                required=False,
            ),
            OpenApiParameter(
                name="query",
                location=OpenApiParameter.QUERY,
                type=OpenApiTypes.STR,
                description='An optional Sentry structured search query. If not provided an implied `"is:unresolved"` is assumed.',
                required=False,
            ),
            OpenApiParameter(
                name="hashes",
                location=OpenApiParameter.QUERY,
                type=OpenApiTypes.STR,
                description="A list of hashes of groups to return. Is not compatible with 'query' parameter. The maximum number of hashes that can be sent is 100. If more are sent, only the first 100 will be used.",
                required=False,
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectGroupIndexGetResponse", list[StreamGroupSerializerResponse]
            ),
            403: RESPONSE_FORBIDDEN,
        },
        examples=IssueExamples.PROJECT_GROUP_INDEX_GET,
    )
    @track_slo_response("workflow")
    def get(self, request: Request, project: Project) -> Response:
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
            "Bulk mutate various attributes on issues. The list of issues to modify is given through the `id` query parameter. "
            "It is repeated for each issue that should be modified.\n\n"
            "- For non-status updates, the `id` query parameter is required.\n"
            "- For status updates, the `id` query parameter may be omitted\n"
            'for a batch "update all" query.\n'
            "- An optional `status` query parameter may be used to restrict\n"
            "mutations to only events with the given status.\n\n"
            "The following attributes can be modified and are supplied as JSON object in the body:\n\n"
            "If any IDs are out of scope this operation will succeed without any data mutation."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.MUTATE_ISSUE_ID_LIST,
            OpenApiParameter(
                name="status",
                location=OpenApiParameter.QUERY,
                type=OpenApiTypes.STR,
                description='Optionally limits the query to issues of the specified status. Valid values are `"resolved"`, `"reprocessing"`, `"unresolved"`, and `"ignored"`.',
                required=False,
            ),
        ],
        request=ProjectGroupIndexMutateRequestSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "ProjectGroupIndexPutResponse", ProjectGroupIndexPutResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueExamples.PROJECT_GROUP_INDEX_PUT,
    )
    @track_slo_response("workflow")
    def put(self, request: Request, project: Project) -> Response:
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
            "Permanently remove the given issues. The list of issues to modify is given through the `id` query parameter. "
            "It is repeated for each issue that should be removed.\n\n"
            "Only queries by 'id' are accepted.\n\n"
            "If any IDs are out of scope this operation will succeed without any data mutation."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.DELETE_ISSUE_ID_LIST,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @track_slo_response("workflow")
    def delete(self, request: Request, project: Project) -> Response:
        search_fn = functools.partial(prep_search, request, project)
        try:
            return schedule_tasks_to_delete_groups(
                request, [project], project.organization_id, search_fn
            )
        except Exception:
            logger.exception("Error deleting groups")
            return Response({"detail": "Error deleting groups"}, status=500)
