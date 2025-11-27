import functools
import logging
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any

import sentry_sdk
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import start_span

from sentry import analytics, search
from sentry.analytics.events.issue_search_endpoint_queried import IssueSearchEndpointQueriedEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.event_search import SearchFilter
from sentry.api.helpers.group_index import (
    build_query_params_from_request,
    calculate_stats_period,
    get_by_short_id,
    schedule_tasks_to_delete_groups,
    track_slo_response,
    update_groups_with_search_fn,
)
from sentry.api.helpers.group_index.types import MutateIssueResponse
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.helpers.group_index.validators.group import GroupValidator
from sentry.api.paginator import DateTimePaginator, Paginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import (
    StreamGroupSerializerSnuba,
    StreamGroupSerializerSnubaResponse,
)
from sentry.api.utils import get_date_range_from_stats_period, handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.issue_examples import IssueExamples
from sentry.apidocs.parameters import (
    CursorQueryParam,
    GlobalParams,
    IssueParams,
    OrganizationParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ALLOWED_FUTURE_DELTA
from sentry.exceptions import InvalidParams, InvalidSearchQuery
from sentry.models.environment import Environment
from sentry.models.group import QUERY_STATUS_LOOKUP, Group, GroupStatus
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.groupinbox import GroupInbox
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.constants import EQUALITY_OPERATORS
from sentry.search.snuba.backend import assigned_or_suggested_filter
from sentry.search.snuba.executors import get_search_filter
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.validators import normalize_event_id

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', '14d' and 'auto'"
allowed_inbox_search_terms = frozenset(["date", "status", "for_review", "assigned_or_suggested"])

logger = logging.getLogger(__name__)


def inbox_search(
    projects: Sequence[Project],
    environments: Sequence[Environment] | None = None,
    limit: int = 100,
    cursor: Cursor | None = None,
    count_hits: bool = False,
    search_filters: Sequence[SearchFilter] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    max_hits: int | None = None,
    actor: Any | None = None,
) -> CursorResult[Group]:
    now: datetime = timezone.now()
    end: datetime | None = None
    end_params: list[datetime] = [
        _f for _f in [date_to, get_search_filter(search_filters, "date", "<")] if _f
    ]
    if end_params:
        end = min(end_params)

    end = end if end else now + ALLOWED_FUTURE_DELTA

    # We only want to search back a week at most, since that's the oldest inbox rows
    # can be.
    earliest_date = now - timedelta(days=7)
    start_params = [date_from, earliest_date, get_search_filter(search_filters, "date", ">")]
    start = max(_f for _f in start_params if _f)
    end = max([earliest_date, end])

    if start >= end:
        return Paginator(Group.objects.none()).get_result()

    # Make sure search terms are valid
    invalid_search_terms = (
        [str(sf) for sf in search_filters if sf.key.name not in allowed_inbox_search_terms]
        if search_filters
        else []
    )
    if invalid_search_terms:
        raise InvalidSearchQuery(f"Invalid search terms for 'inbox' search: {invalid_search_terms}")

    # Make sure this is an inbox search
    if not get_search_filter(search_filters, "for_review", "="):
        raise InvalidSearchQuery("Sort key 'inbox' only supported for inbox search")

    if get_search_filter(
        search_filters, "status", "="
    ) != GroupStatus.UNRESOLVED and get_search_filter(search_filters, "status", "IN") != [
        GroupStatus.UNRESOLVED
    ]:
        raise InvalidSearchQuery("Inbox search only works for 'unresolved' status")

    # We just filter on `GroupInbox.date_added` here, and don't filter by date
    # on the group. This keeps the query simpler and faster in some edge cases,
    # and date_added is a good enough proxy when we're using this sort.
    qs = GroupInbox.objects.filter(
        date_added__gte=start,
        date_added__lte=end,
        project__in=projects,
    ).using_replica()

    if environments is not None:
        environment_ids: list[int] = [environment.id for environment in environments]
        qs = qs.filter(
            group_id__in=GroupEnvironment.objects.filter(environment_id__in=environment_ids)
            .values_list("group_id", flat=True)
            .distinct()
        )

    owner_search = get_search_filter(search_filters, "assigned_or_suggested", "IN")
    if owner_search:
        qs = qs.filter(
            assigned_or_suggested_filter(owner_search, projects, field_filter="group_id")
        )

    paginator = DateTimePaginator(qs.order_by("date_added"), "-date_added")
    results = paginator.get_result(limit, cursor, count_hits=count_hits, max_hits=max_hits)

    # We want to return groups from the endpoint, but have the cursor be related to the
    # GroupInbox rows. So we paginate on the GroupInbox results queryset, then fetch
    # the group_ids out and use them to get the actual groups.
    group_qs = Group.objects.filter(
        id__in=[r.group_id for r in results.results],
        project__in=projects,
        status=GroupStatus.UNRESOLVED,
    )
    groups: Mapping[int, Group] = {g.id: g for g in group_qs}
    results.results = [groups[r.group_id] for r in results.results if r.group_id in groups]
    return results


@extend_schema(tags=["Events"])
@region_silo_endpoint
class OrganizationGroupIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationEventPermission,)
    enforce_rate_limit = True

    def _search(
        self,
        request: Request,
        organization: Organization,
        projects: Sequence[Project],
        environments: Sequence[Environment],
        extra_query_kwargs: None | Mapping[str, Any] = None,
    ) -> tuple[CursorResult[Group], Mapping[str, Any]]:
        with start_span(op="_search"):
            query_kwargs = build_query_params_from_request(
                request, organization, projects, environments
            )
            if extra_query_kwargs is not None:
                assert "environment" not in extra_query_kwargs
                query_kwargs.update(extra_query_kwargs)

            query_kwargs["environments"] = environments if environments else None

            query_kwargs["actor"] = request.user
            if query_kwargs["sort_by"] == "inbox":
                query_kwargs.pop("sort_by")
                query_kwargs.pop("referrer")
                result = inbox_search(**query_kwargs)
            else:
                result = search.backend.query(**query_kwargs)
            return result, query_kwargs

    @extend_schema(
        operation_id="List an Organization's Issues",
        description=(
            "Return a list of issues for an organization. "
            "All parameters are supplied as query string parameters. "
            "A default query of `is:unresolved` is applied. "
            "To return all results, use an empty query value (i.e. ``?query=`). "
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.ENVIRONMENT,
            OrganizationParams.PROJECT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            IssueParams.GROUP_STATS_PERIOD,
            IssueParams.SHORT_ID_LOOKUP,
            IssueParams.DEFAULT_QUERY,
            IssueParams.VIEW_ID,
            IssueParams.VIEW_SORT,
            IssueParams.LIMIT,
            IssueParams.GROUP_INDEX_EXPAND,
            IssueParams.GROUP_INDEX_COLLAPSE,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationGroupIndexGetResponse", list[StreamGroupSerializerSnubaResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueExamples.ORGANIZATION_GROUP_INDEX_GET,
    )
    @track_slo_response("workflow")
    def get(self, request: Request, organization: Organization) -> Response:
        stats_period = request.GET.get("groupStatsPeriod")
        try:
            start, end = get_date_range_from_stats_period(request.GET)
        except InvalidParams as e:
            raise ParseError(detail=str(e))

        expand = request.GET.getlist("expand", [])
        collapse = request.GET.getlist("collapse", [])
        if stats_period not in (None, "", "24h", "14d", "auto"):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        stats_period, stats_period_start, stats_period_end = calculate_stats_period(
            stats_period, start, end
        )

        environments = self.get_environments(request, organization)

        projects = self.get_projects(request, organization)
        project_ids = [p.id for p in projects]

        if not projects:
            return Response([])

        serializer = functools.partial(
            StreamGroupSerializerSnuba,
            environment_ids=[env.id for env in environments],
            stats_period=stats_period,
            stats_period_start=stats_period_start,
            stats_period_end=stats_period_end,
            expand=expand,
            collapse=collapse,
            project_ids=project_ids,
            organization_id=organization.id,
        )

        # we ignore date range for both short id and event ids
        query = request.GET.get("query", "").strip()

        # record analytics for search query
        if request.user:
            try:
                analytics.record(
                    IssueSearchEndpointQueriedEvent(
                        user_id=request.user.id,
                        organization_id=organization.id,
                        project_ids=",".join(map(str, project_ids)),
                        full_query_params=",".join(
                            f"{key}={value}" for key, value in request.GET.items()
                        ),
                        query=query,
                    )
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

        if query:
            # check to see if we've got an event ID
            event_id = normalize_event_id(query)
            if event_id:
                # For a direct hit lookup we want to use any passed project ids
                # (we've already checked permissions on these) plus any other
                # projects that the user is a member of. This gives us a better
                # chance of returning the correct result, even if the wrong
                # project is selected.
                direct_hit_projects = (
                    set(project_ids) | request.access.project_ids_with_team_membership
                )
                groups = list(
                    Group.objects.filter_by_event_id(
                        direct_hit_projects,
                        event_id,
                        tenant_ids={"organization_id": organization.id},
                    )
                )
                if len(groups) == 1:
                    serialized_groups = serialize(
                        groups, request.user, serializer(), request=request
                    )
                    if event_id:
                        serialized_groups[0]["matchingEventId"] = event_id
                    response = Response(serialized_groups)
                    response["X-Sentry-Direct-Hit"] = "1"
                    return response

                if groups:
                    return Response(serialize(groups, request.user, serializer(), request=request))

            group = get_by_short_id(organization.id, request.GET.get("shortIdLookup") or "0", query)
            if group is not None:
                # check all projects user has access to
                if request.access.has_project_access(group.project):
                    response = Response(
                        serialize([group], request.user, serializer(), request=request)
                    )
                    response["X-Sentry-Direct-Hit"] = "1"
                    return response

        # If group ids specified, just ignore any query components
        try:
            group_ids = set(map(int, request.GET.getlist("group")))
        except ValueError:
            return Response({"detail": "Group ids must be integers"}, status=400)

        if group_ids:
            groups = list(Group.objects.filter(id__in=group_ids, project_id__in=project_ids))
            if any(g for g in groups if not request.access.has_project_access(g.project)):
                raise PermissionDenied
            return Response(serialize(groups, request.user, serializer(), request=request))

        try:
            with handle_query_errors():
                cursor_result, query_kwargs = self._search(
                    request,
                    organization,
                    projects,
                    environments,
                    {"count_hits": True, "date_to": end, "date_from": start},
                )
        except ValidationError as exc:
            return Response({"detail": str(exc)}, status=400)

        results = list(cursor_result)

        context = serialize(
            results,
            request.user,
            serializer(
                start=start,
                end=end,
                search_filters=(
                    query_kwargs["search_filters"] if "search_filters" in query_kwargs else None
                ),
                organization_id=organization.id,
            ),
            request=request,
        )

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

        # Sanity check: if we're on the first and last page with no more results,
        # the estimated hits from sampling may be too high due to Snuba/Postgres
        # data inconsistency. Cap hits to match the actual number of results.
        if (
            cursor_result.hits is not None
            and cursor_result.next.has_results is False
            and not request.GET.get("cursor")
        ):
            actual_count = len(context)
            if cursor_result.hits > actual_count:
                cursor_result.hits = actual_count

        response = Response(context)

        self.add_cursor_headers(request, response, cursor_result)

        # TODO(jess): add metrics that are similar to project endpoint here
        return response

    @extend_schema(
        operation_id="Bulk Mutate an Organization's Issues",
        description=(
            "Bulk mutate various attributes on a maxmimum of 1000 issues. \n"
            "- For non-status updates, the `id` query parameter is required. \n"
            "- For status updates, the `id` query parameter may be omitted to update issues that match the filtering. \n"
            "If any IDs are out of scope, the data won't be mutated but the endpoint will still produce a successful response. "
            "For example, if no issues were found matching the criteria, a HTTP 204 is returned."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.ENVIRONMENT,
            OrganizationParams.PROJECT,
            IssueParams.MUTATE_ISSUE_ID_LIST,
            IssueParams.DEFAULT_QUERY,
            IssueParams.VIEW_ID,
            IssueParams.VIEW_SORT,
            IssueParams.LIMIT,
        ],
        request=GroupValidator,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationGroupIndexPutResponse", MutateIssueResponse
            ),
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueExamples.ORGANIZATION_GROUP_INDEX_PUT,
    )
    @track_slo_response("workflow")
    def put(self, request: Request, organization: Organization) -> Response:
        projects = self.get_projects(request, organization)

        search_fn = functools.partial(
            self._search,
            request,
            organization,
            projects,
            self.get_environments(request, organization),
        )

        ids = [int(id) for id in request.GET.getlist("id")]
        return update_groups_with_search_fn(request, ids, projects, organization.id, search_fn)

    @extend_schema(
        operation_id="Bulk Remove an Organization's Issues",
        description=(
            "Permanently remove the given issues. "
            "If IDs are provided, queries and filtering will be ignored. "
            "If any IDs are out of scope, the data won't be mutated but the endpoint will still produce a successful response. "
            "For example, if no issues were found matching the criteria, a HTTP 204 is returned."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.ENVIRONMENT,
            OrganizationParams.PROJECT,
            IssueParams.DELETE_ISSUE_ID_LIST,
            IssueParams.DEFAULT_QUERY,
            IssueParams.VIEW_ID,
            IssueParams.VIEW_SORT,
            IssueParams.LIMIT,
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
    def delete(self, request: Request, organization: Organization) -> Response:
        projects = self.get_projects(request, organization)

        search_fn = functools.partial(
            self._search,
            request,
            organization,
            projects,
            self.get_environments(request, organization),
        )

        try:
            return schedule_tasks_to_delete_groups(request, projects, organization.id, search_fn)
        except Exception:
            logger.exception("Error scheduling tasks to delete groups")
            return Response({"detail": "Error deleting groups"}, status=500)
