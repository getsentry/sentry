from __future__ import absolute_import, division, print_function

import functools
import six

from django.conf import settings

from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventPermission
from sentry.api.helpers.group_index import (
    build_query_params_from_request,
    delete_groups,
    get_by_short_id,
    rate_limit_endpoint,
    update_groups,
    ValidationError,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializerSnuba
from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.models import Group, GroupStatus
from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend
from sentry.snuba import discover
from sentry.utils.validators import normalize_event_id
from sentry.utils.compat import map


ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


search = EventsDatasetSnubaSearchBackend(**settings.SENTRY_SEARCH_OPTIONS)


class OrganizationGroupIndexEndpoint(OrganizationEventsEndpointBase):
    permission_classes = (OrganizationEventPermission,)
    skip_snuba_fields = {
        "query",
        "status",
        "bookmarked_by",
        "assigned_to",
        "unassigned",
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
        result = search.query(**query_kwargs)
        return result, query_kwargs

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
        """
        stats_period = request.GET.get("groupStatsPeriod")
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams as e:
            raise ParseError(detail=six.text_type(e))

        has_dynamic_issue_counts = features.has(
            "organizations:dynamic-issue-counts", organization, actor=request.user
        )

        if stats_period not in (None, "", "24h", "14d"):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        elif stats_period is None:
            # default if no dynamic-issue-counts
            stats_period = "24h"
        elif stats_period == "":
            # disable stats
            stats_period = None

        if stats_period == "auto":
            stats_period_start = start
            stats_period_end = end
        else:
            stats_period_start = None
            stats_period_end = None

        environments = self.get_environments(request, organization)

        serializer = functools.partial(
            StreamGroupSerializerSnuba,
            environment_ids=[env.id for env in environments],
            stats_period=stats_period,
            stats_period_start=stats_period_start,
            stats_period_end=stats_period_end,
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
                direct_hit_projects = set(project_ids) | set(
                    [project.id for project in request.access.projects]
                )
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
            return Response({"detail": six.text_type(exc)}, status=400)

        results = list(cursor_result)

        if has_dynamic_issue_counts:
            context = serialize(
                results,
                request.user,
                serializer(
                    start=start,
                    end=end,
                    search_filters=query_kwargs["search_filters"]
                    if "search_filters" in query_kwargs
                    else None,
                    has_dynamic_issue_counts=True,
                ),
            )
        else:
            context = serialize(results, request.user, serializer())

        # HACK: remove auto resolved entries
        # TODO: We should try to integrate this into the search backend, since
        # this can cause us to arbitrarily return fewer results than requested.
        status = [
            search_filter
            for search_filter in query_kwargs.get("search_filters", [])
            if search_filter.key.name == "status"
        ]
        if status and status[0].value.raw_value == GroupStatus.UNRESOLVED:
            context = [r for r in context if r["status"] == "unresolved"]

        response = Response(context)

        self.add_cursor_headers(request, response, cursor_result)

        # TODO(jess): add metrics that are similar to project endpoint here
        return response

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
        return update_groups(request, projects, organization.id, search_fn)

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
