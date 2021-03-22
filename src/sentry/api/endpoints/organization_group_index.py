import functools
from datetime import datetime, timedelta
from typing import List, Mapping, Optional, Sequence

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventPermission
from sentry.constants import ALLOWED_FUTURE_DELTA
from sentry.api.event_search import SearchFilter
from sentry.api.helpers.group_index import (
    build_query_params_from_request,
    calculate_stats_period,
    delete_groups,
    get_by_short_id,
    rate_limit_endpoint,
    track_slo_response,
    update_groups,
    ValidationError,
)
from sentry.api.paginator import DateTimePaginator, Paginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializerSnuba
from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.models import Environment, Group, GroupEnvironment, GroupInbox, GroupStatus, Project
from sentry.search.snuba.backend import (
    assigned_or_suggested_filter,
    EventsDatasetSnubaSearchBackend,
)
from sentry.search.snuba.executors import get_search_filter, InvalidSearchQuery
from sentry.snuba import discover
from sentry.utils.compat import map
from sentry.utils.cursors import Cursor, CursorResult

from sentry.utils.validators import normalize_event_id


ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


search = EventsDatasetSnubaSearchBackend(**settings.SENTRY_SEARCH_OPTIONS)


allowed_inbox_search_terms = frozenset(["date", "status", "for_review", "assigned_or_suggested"])


def inbox_search(
    projects: Sequence[Project],
    environments: Optional[Sequence[Environment]] = None,
    limit: int = 100,
    cursor: Optional[Cursor] = None,
    count_hits: bool = False,
    search_filters: Optional[Sequence[SearchFilter]] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    max_hits: Optional[int] = None,
) -> CursorResult:
    now: datetime = timezone.now()
    end: Optional[datetime] = None
    end_params: List[datetime] = [
        _f for _f in [date_to, get_search_filter(search_filters, "date", "<")] if _f
    ]
    if end_params:
        end = min(end_params)

    end = end if end else now + ALLOWED_FUTURE_DELTA

    # We only want to search back a week at most, since that's the oldest inbox rows
    # can be.
    earliest_date = now - timedelta(days=7)
    start_params = [date_from, earliest_date, get_search_filter(search_filters, "date", ">")]
    start = max([_f for _f in start_params if _f])
    end = max([earliest_date, end])

    if start >= end:
        return Paginator(Group.objects.none()).get_result()

    # Make sure search terms are valid
    invalid_search_terms = [
        str(sf) for sf in search_filters if sf.key.name not in allowed_inbox_search_terms
    ]
    if invalid_search_terms:
        raise InvalidSearchQuery(f"Invalid search terms for 'inbox' search: {invalid_search_terms}")

    # Make sure this is an inbox search
    if not get_search_filter(search_filters, "for_review", "="):
        raise InvalidSearchQuery("Sort key 'inbox' only supported for inbox search")

    if get_search_filter(search_filters, "status", "=") != GroupStatus.UNRESOLVED:
        raise InvalidSearchQuery("Inbox search only works for 'unresolved' status")

    # We just filter on `GroupInbox.date_added` here, and don't filter by date
    # on the group. This keeps the query simpler and faster in some edge cases,
    # and date_added is a good enough proxy when we're using this sort.
    qs = GroupInbox.objects.filter(
        date_added__gte=start,
        date_added__lte=end,
        project__in=projects,
    )

    if environments is not None:
        environment_ids: List[int] = [environment.id for environment in environments]
        qs = qs.filter(
            group_id__in=GroupEnvironment.objects.filter(environment_id__in=environment_ids)
            .values_list("group_id", flat=True)
            .distinct()
        )

    owner_search = get_search_filter(search_filters, "assigned_or_suggested", "=")
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


class OrganizationGroupIndexEndpoint(OrganizationEventsEndpointBase):
    permission_classes = (OrganizationEventPermission,)
    skip_snuba_fields = {
        "query",
        "status",
        "bookmarked_by",
        "assigned_to",
        "unassigned",
        "linked",
        "subscribed_by",
        "active_at",
        "first_release",
        "first_seen",
    }

    def _search(self, request, organization, projects, environments, extra_query_kwargs=None):
        query_kwargs = build_query_params_from_request(
            request, organization, projects, environments
        )
        if extra_query_kwargs is not None:
            assert "environment" not in extra_query_kwargs
            query_kwargs.update(extra_query_kwargs)

        query_kwargs["environments"] = environments if environments else None
        if query_kwargs["sort_by"] == "inbox":
            query_kwargs.pop("sort_by")
            result = inbox_search(**query_kwargs)
        else:
            result = search.query(**query_kwargs)
        return result, query_kwargs

    @track_slo_response("workflow")
    @rate_limit_endpoint(limit=10, window=1)
    def get(self, request, organization):
        """
        List an Organization's Issues
        `````````````````````````````

        Return a list of issues (groups) bound to an organization.  All parameters are
        supplied as query string parameters.

        A default query of ``is:unresolved`` is applied. To return results
        with other statuses send an new query value (i.e. ``?query=`` for all
        results).

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
                                   ``"is:unresolved"`` is assumed.)
        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :auth: required
        :qparam list expand: an optional list of strings to opt in to additional data. Supports `inbox`
        :qparam list collapse: an optional list of strings to opt out of certain pieces of data. Supports `stats`, `lifetime`, `base`
        """
        stats_period = request.GET.get("groupStatsPeriod")
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams as e:
            raise ParseError(detail=str(e))

        expand = request.GET.getlist("expand", [])
        collapse = request.GET.getlist("collapse", [])
        has_inbox = features.has("organizations:inbox", organization, actor=request.user)
        if stats_period not in (None, "", "24h", "14d", "auto"):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        stats_period, stats_period_start, stats_period_end = calculate_stats_period(
            stats_period, start, end
        )

        environments = self.get_environments(request, organization)

        serializer = functools.partial(
            StreamGroupSerializerSnuba,
            environment_ids=[env.id for env in environments],
            stats_period=stats_period,
            stats_period_start=stats_period_start,
            stats_period_end=stats_period_end,
            expand=expand,
            collapse=collapse,
            has_inbox=has_inbox,
        )

        projects = self.get_projects(request, organization)
        project_ids = [p.id for p in projects]

        if not projects:
            return Response([])

        if len(projects) > 1 and not features.has(
            "organizations:global-views", organization, actor=request.user
        ):
            return Response(
                {"detail": "You do not have the multi project stream feature enabled"}, status=400
            )

        # we ignore date range for both short id and event ids
        query = request.GET.get("query", "").strip()
        if query:
            # check to see if we've got an event ID
            event_id = normalize_event_id(query)
            if event_id:
                # For a direct hit lookup we want to use any passed project ids
                # (we've already checked permissions on these) plus any other
                # projects that the user is a member of. This gives us a better
                # chance of returning the correct result, even if the wrong
                # project is selected.
                direct_hit_projects = set(project_ids) | {
                    project.id for project in request.access.projects
                }
                groups = list(Group.objects.filter_by_event_id(direct_hit_projects, event_id))
                if len(groups) == 1:
                    response = Response(
                        serialize(groups, request.user, serializer(matching_event_id=event_id))
                    )
                    response["X-Sentry-Direct-Hit"] = "1"
                    return response

                if groups:
                    return Response(serialize(groups, request.user, serializer()))

            group = get_by_short_id(organization.id, request.GET.get("shortIdLookup"), query)
            if group is not None:
                # check all projects user has access to
                if request.access.has_project_access(group.project):
                    response = Response(serialize([group], request.user, serializer()))
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
            return Response(serialize(groups, request.user, serializer()))

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
                search_filters=query_kwargs["search_filters"]
                if "search_filters" in query_kwargs
                else None,
            ),
        )

        # HACK: remove auto resolved entries
        # TODO: We should try to integrate this into the search backend, since
        # this can cause us to arbitrarily return fewer results than requested.
        status = [
            search_filter
            for search_filter in query_kwargs.get("search_filters", [])
            if search_filter.key.name == "status"
        ]
        if status and status[0].value.raw_value == GroupStatus.UNRESOLVED:
            context = [r for r in context if "status" not in r or r["status"] == "unresolved"]

        response = Response(context)

        self.add_cursor_headers(request, response, cursor_result)

        # TODO(jess): add metrics that are similar to project endpoint here
        return response

    @track_slo_response("workflow")
    @rate_limit_endpoint(limit=10, window=1)
    def put(self, request, organization):
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
        :pparam string organization_slug: the slug of the organization the
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
        :auth: required
        """
        projects = self.get_projects(request, organization)
        has_inbox = features.has("organizations:inbox", organization, actor=request.user)
        if len(projects) > 1 and not features.has(
            "organizations:global-views", organization, actor=request.user
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

        return update_groups(
            request, request.GET.getlist("id"), projects, organization.id, search_fn, has_inbox
        )

    @track_slo_response("workflow")
    @rate_limit_endpoint(limit=10, window=1)
    def delete(self, request, organization):
        """
        Bulk Remove a List of Issues
        ````````````````````````````

        Permanently remove the given issues. The list of issues to
        modify is given through the `id` query parameter.  It is repeated
        for each issue that should be removed.

        Only queries by 'id' are accepted.

        If any ids are out of scope this operation will succeed without
        any data mutation.

        :qparam int id: a list of IDs of the issues to be removed.  This
                        parameter shall be repeated for each issue.
        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :auth: required
        """
        projects = self.get_projects(request, organization)
        if len(projects) > 1 and not features.has(
            "organizations:global-views", organization, actor=request.user
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
