import functools
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any

import sentry_sdk
from django.utils import timezone
from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import start_span

from sentry import analytics, features, search
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.event_search import SearchFilter
from sentry.api.helpers.group_index import (
    build_query_params_from_request,
    calculate_stats_period,
    delete_groups,
    get_by_short_id,
    track_slo_response,
    update_groups_with_search_fn,
)
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.paginator import DateTimePaginator, Paginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnuba
from sentry.api.utils import get_date_range_from_stats_period
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
from sentry.search.snuba.executors import FIRST_RELEASE_FILTERS, get_search_filter
from sentry.snuba import discover
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.validators import normalize_event_id

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"
allowed_inbox_search_terms = frozenset(["date", "status", "for_review", "assigned_or_suggested"])


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


@region_silo_endpoint
class OrganizationGroupIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
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
                result = inbox_search(**query_kwargs)
            else:

                def use_group_snuba_dataset() -> bool:
                    # if useGroupSnubaDataset is present, override the flag so we can test the new dataset
                    req_param_value: str | None = request.GET.get("useGroupSnubaDataset")
                    if req_param_value and req_param_value.lower() == "true":
                        return True

                    if not features.has("organizations:issue-search-snuba", organization):
                        return False

                    # haven't migrated trends
                    if query_kwargs["sort_by"] == "trends":
                        return False

                    # check for the first_release search filters, which require postgres if the environment is specified
                    if environments:
                        return all(
                            sf.key.name not in FIRST_RELEASE_FILTERS
                            for sf in query_kwargs.get("search_filters", [])
                        )

                    return True

                query_kwargs["referrer"] = "search.group_index"
                query_kwargs["use_group_snuba_dataset"] = use_group_snuba_dataset()
                sentry_sdk.set_tag(
                    "search.use_group_snuba_dataset", query_kwargs["use_group_snuba_dataset"]
                )

                result = search.backend.query(**query_kwargs)
            return result, query_kwargs

    @track_slo_response("workflow")
    def get(self, request: Request, organization: Organization) -> Response:
        """
        List an Organization's Issues
        `````````````````````````````

        Return a list of issues (groups) bound to an organization.  All parameters are
        supplied as query string parameters.

        A default query of ``is:unresolved issue.priority:[high,medium]`` is applied.
        To return results with other statuses send a new query value
        (i.e. ``?query=`` for all results).

        The ``groupStatsPeriod`` parameter can be used to select the timeline
        stats which should be present. Possible values are: '' (disable),
        '24h', '14d'

        The ``statsPeriod`` parameter can be used to select a date window starting
        from now. Ex. ``14d``.

        The ``start`` and ``end`` parameters can be used to select an absolute
        date period to fetch issues from.

        :qparam string statsPeriod: an optional stat period (can be one of
                                    ``"24h"``, ``"14d"``, and ``""``).
        :qparam string groupStatsPeriod: an optional stat period (can be one of
                                    ``"24h"``, ``"14d"``, and ``""``).
        :qparam string start:       Beginning date. You must also provide ``end``.
        :qparam string end:         End date. You must also provide ``start``.
        :qparam bool shortIdLookup: if this is set to true then short IDs are
                                    looked up by this function as well.  This
                                    can cause the return value of the function
                                    to return an event issue of a different
                                    project which is why this is an opt-in.
                                    Set to `1` to enable.
        :qparam querystring query: an optional Sentry structured search
                                   query.  If not provided an implied
                                   ``"is:unresolved issue.priority:[high,medium]"`` is assumed.)
        :qparam bool savedSearch:  if this is set to False, then we are making the request without
                                   a saved search and will look for the default search from this endpoint.
        :qparam string searchId:   if passed in, this is the selected search
        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          issues belong to.
        :auth: required
        :qparam list expand: an optional list of strings to opt in to additional data. Supports `inbox`
        :qparam list collapse: an optional list of strings to opt out of certain pieces of data. Supports `stats`, `lifetime`, `base`, `unhandled`
        """
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

        is_fetching_replay_data = request.headers.get("X-Sentry-Replay-Request") == "1"
        if (
            len(projects) > 1
            and not features.has("organizations:global-views", organization, actor=request.user)
            and not is_fetching_replay_data
        ):
            return Response(
                {"detail": "You do not have the multi project stream feature enabled"}, status=400
            )

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
            analytics.record(
                "issue_search.endpoint_queried",
                user_id=request.user.id,
                organization_id=organization.id,
                project_ids=",".join(map(str, project_ids)),
                full_query_params=",".join(f"{key}={value}" for key, value in request.GET.items()),
                query=query,
            )

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
            cursor_result, query_kwargs = self._search(
                request,
                organization,
                projects,
                environments,
                {"count_hits": True, "date_to": end, "date_from": start},
            )
        except (ValidationError, discover.InvalidSearchQuery) as exc:
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

        response = Response(context)

        self.add_cursor_headers(request, response, cursor_result)

        # TODO(jess): add metrics that are similar to project endpoint here
        return response

    @track_slo_response("workflow")
    def put(self, request: Request, organization: Organization) -> Response:
        """
        Bulk Mutate a List of Issues
        ````````````````````````````

        Bulk mutate various attributes on issues.  The list of issues
        to modify is given through the `id` query parameter.  It is repeated
        for each issue that should be modified.

        - For non-status updates, the `id` query parameter is required.
        - For status updates, the `id` query parameter may be omitted
          for a batch "update all" query.
        - An optional `status` query parameter may be used to restrict
          mutations to only events with the given status.

        The following attributes can be modified and are supplied as
        JSON object in the body:

        If any ids are out of scope this operation will succeed without
        any data mutation.

        :qparam int id: a list of IDs of the issues to be mutated.  This
                        parameter shall be repeated for each issue.  It
                        is optional only if a status is mutated in which
                        case an implicit `update all` is assumed.
        :qparam string status: optionally limits the query to issues of the
                               specified status.  Valid values are
                               ``"resolved"``, ``"unresolved"`` and
                               ``"ignored"``.
        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          issues belong to.
        :param string status: the new status for the issues.  Valid values
                              are ``"resolved"``, ``"resolvedInNextRelease"``,
                              ``"unresolved"``, and ``"ignored"``. Status
                              updates that include release data are only allowed
                              for groups within a single project.
        :param map statusDetails: additional details about the resolution.
                                  Valid values are ``"inRelease"``, ``"inNextRelease"``,
                                  ``"inCommit"``,  ``"ignoreDuration"``, ``"ignoreCount"``,
                                  ``"ignoreWindow"``, ``"ignoreUserCount"``, and
                                  ``"ignoreUserWindow"``. Status detail
                                  updates that include release data are only allowed
                                  for groups within a single project.
        :param int ignoreDuration: the number of minutes to ignore this issue.
        :param boolean isPublic: sets the issue to public or private.
        :param boolean merge: allows to merge or unmerge different issues.
        :param string assignedTo: the user or team that should be assigned to
                                  these issues. Can be of the form ``"<user_id>"``,
                                  ``"user:<user_id>"``, ``"<username>"``,
                                  ``"<user_primary_email>"``, or ``"team:<team_id>"``.
                                  Bulk assigning issues is limited to groups
                                  within a single project.
        :param boolean hasSeen: in case this API call is invoked with a user
                                context this allows changing of the flag
                                that indicates if the user has seen the
                                event.
        :param boolean isBookmarked: in case this API call is invoked with a
                                     user context this allows changing of
                                     the bookmark flag.
        :param string substatus: the new substatus for the issues. Valid values
                                 defined in GroupSubStatus.
        :auth: required
        """
        projects = self.get_projects(request, organization)
        is_fetching_replay_data = request.headers.get("X-Sentry-Replay-Request") == "1"

        if (
            len(projects) > 1
            and not features.has("organizations:global-views", organization, actor=request.user)
            and not is_fetching_replay_data
        ):
            return Response(
                {"detail": "You do not have the multi project stream feature enabled"}, status=400
            )

        search_fn = functools.partial(
            self._search,
            request,
            organization,
            projects,
            self.get_environments(request, organization),
        )

        ids = [int(id) for id in request.GET.getlist("id")]
        return update_groups_with_search_fn(request, ids, projects, organization.id, search_fn)

    @track_slo_response("workflow")
    def delete(self, request: Request, organization: Organization) -> Response:
        """
        Bulk Remove a List of Issues
        ````````````````````````````

        Permanently remove the given issues. The list of issues to
        modify is given through the `id` query parameter.  It is repeated
        for each issue that should be removed.

        Only queries by 'id' are accepted.

        If any IDs are out of scope this operation will succeed without
        any data mutation.

        :qparam int id: a list of IDs of the issues to be removed.  This
                        parameter shall be repeated for each issue, e.g.
                        `?id=1&id=2&id=3`. If this parameter is not provided,
                        it will attempt to remove the first 1000 issues.
        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          issues belong to.
        :auth: required
        """
        projects = self.get_projects(request, organization)

        is_fetching_replay_data = request.headers.get("X-Sentry-Replay-Request") == "1"

        if (
            len(projects) > 1
            and not features.has("organizations:global-views", organization, actor=request.user)
            and not is_fetching_replay_data
        ):
            return Response(
                {"detail": "You do not have the multi project stream feature enabled"}, status=400
            )

        search_fn = functools.partial(
            self._search,
            request,
            organization,
            projects,
            self.get_environments(request, organization),
        )

        return delete_groups(request, projects, organization.id, search_fn)
