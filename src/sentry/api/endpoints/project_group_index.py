from __future__ import absolute_import, division, print_function

import functools

import six
from rest_framework.response import Response

from sentry import analytics, eventstore, search
from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.helpers.group_index import (
    build_query_params_from_request,
    delete_groups,
    get_by_short_id,
    update_groups,
    ValidationError,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.models import Environment, Group, GroupStatus
from sentry.models.savedsearch import DEFAULT_SAVED_SEARCH_QUERIES
from sentry.signals import advanced_search
from sentry.utils.apidocs import attach_scenarios, scenario
from sentry.utils.cursors import CursorResult
from sentry.utils.validators import normalize_event_id

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


@scenario("BulkUpdateIssues")
def bulk_update_issues_scenario(runner):
    project = runner.default_project
    group1, group2 = Group.objects.filter(project=project)[:2]
    runner.request(
        method="PUT",
        path="/projects/%s/%s/issues/?id=%s&id=%s"
        % (runner.org.slug, project.slug, group1.id, group2.id),
        data={"status": "unresolved", "isPublic": False},
    )


@scenario("BulkRemoveIssuess")
def bulk_remove_issues_scenario(runner):
    with runner.isolated_project("Amazing Plumbing") as project:
        group1, group2 = Group.objects.filter(project=project)[:2]
        runner.request(
            method="DELETE",
            path="/projects/%s/%s/issues/?id=%s&id=%s"
            % (runner.org.slug, project.slug, group1.id, group2.id),
        )


@scenario("ListProjectIssuess")
def list_project_issues_scenario(runner):
    project = runner.default_project
    runner.request(
        method="GET",
        path="/projects/%s/%s/issues/?statsPeriod=24h" % (runner.org.slug, project.slug),
    )


class ProjectGroupIndexEndpoint(ProjectEndpoint, EnvironmentMixin):
    doc_section = DocSection.EVENTS

    permission_classes = (ProjectEventPermission,)

    def _search(self, request, project, extra_query_kwargs=None):
        try:
            environment = self._get_environment_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            # XXX: The 1000 magic number for `max_hits` is an abstraction leak
            # from `sentry.api.paginator.BasePaginator.get_result`.
            result = CursorResult([], None, None, hits=0, max_hits=1000)
            query_kwargs = {}
        else:
            environments = [environment] if environment is not None else environment
            query_kwargs = build_query_params_from_request(
                request, project.organization, [project], environments
            )
            if extra_query_kwargs is not None:
                assert "environment" not in extra_query_kwargs
                query_kwargs.update(extra_query_kwargs)

            query_kwargs["environments"] = environments
            result = search.query(**query_kwargs)
        return result, query_kwargs

    # statsPeriod=24h
    @attach_scenarios([list_project_issues_scenario])
    def get(self, request, project):
        """
        List a Project's Issues
        ```````````````````````

        Return a list of issues (groups) bound to a project.  All parameters are
        supplied as query string parameters.

        A default query of ``is:unresolved`` is applied. To return results
        with other statuses send an new query value (i.e. ``?query=`` for all
        results).

        The ``statsPeriod`` parameter can be used to select the timeline
        stats which should be present. Possible values are: ``""`` (disable),
        ``"24h"``, ``"14d"``

        :qparam string statsPeriod: an optional stat period (can be one of
                                    ``"24h"``, ``"14d"``, and ``""``).
        :qparam bool shortIdLookup: if this is set to true then short IDs are
                                    looked up by this function as well.  This
                                    can cause the return value of the function
                                    to return an event issue of a different
                                    project which is why this is an opt-in.
                                    Set to `1` to enable.
        :qparam querystring query: an optional Sentry structured search
                                   query.  If not provided an implied
                                   ``"is:unresolved"`` is assumed.)
        :qparam string environment: this restricts the issues to ones containing
                                    events from this environment
        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :pparam string project_slug: the slug of the project the issues
                                     belong to.
        :auth: required
        """
        stats_period = request.GET.get("statsPeriod")
        if stats_period not in (None, "", "24h", "14d"):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        elif stats_period is None:
            # default
            stats_period = "24h"
        elif stats_period == "":
            # disable stats
            stats_period = None

        serializer = functools.partial(
            StreamGroupSerializer,
            environment_func=self._get_environment_func(request, project.organization_id),
            stats_period=stats_period,
        )

        query = request.GET.get("query", "").strip()
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
                    matching_event = eventstore.get_event_by_id(project.id, event_id)
            elif matching_group is None:
                matching_group = get_by_short_id(
                    project.organization_id, request.GET.get("shortIdLookup"), query
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

                response = Response(
                    serialize(
                        [matching_group],
                        request.user,
                        serializer(
                            matching_event_id=getattr(matching_event, "event_id", None),
                            matching_event_environment=matching_event_environment,
                        ),
                    )
                )
                response["X-Sentry-Direct-Hit"] = "1"
                return response

        try:
            cursor_result, query_kwargs = self._search(request, project, {"count_hits": True})
        except ValidationError as exc:
            return Response({"detail": six.text_type(exc)}, status=400)

        results = list(cursor_result)

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

        if results and query not in DEFAULT_SAVED_SEARCH_QUERIES:
            advanced_search.send(project=project, sender=request.user)
            analytics.record(
                "project_issue.searched",
                user_id=request.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                query=query,
            )

        return response

    @attach_scenarios([bulk_update_issues_scenario])
    def put(self, request, project):
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
        :pparam string project_slug: the slug of the project the issues
                                     belong to.
        :param string status: the new status for the issues.  Valid values
                              are ``"resolved"``, ``"resolvedInNextRelease"``,
                              ``"unresolved"``, and ``"ignored"``.
        :param map statusDetails: additional details about the resolution.
                                  Valid values are ``"inRelease"``, ``"inNextRelease"``,
                                  ``"inCommit"``,  ``"ignoreDuration"``, ``"ignoreCount"``,
                                  ``"ignoreWindow"``, ``"ignoreUserCount"``, and
                                  ``"ignoreUserWindow"``.
        :param int ignoreDuration: the number of minutes to ignore this issue.
        :param boolean isPublic: sets the issue to public or private.
        :param boolean merge: allows to merge or unmerge different issues.
        :param string assignedTo: the user or team that should be assigned to
                                  this issue. Can be of the form ``"<user_id>"``,
                                  ``"user:<user_id>"``, ``"<username>"``,
                                  ``"<user_primary_email>"``, or ``"team:<team_id>"``.
        :param boolean hasSeen: in case this API call is invoked with a user
                                context this allows changing of the flag
                                that indicates if the user has seen the
                                event.
        :param boolean isBookmarked: in case this API call is invoked with a
                                     user context this allows changing of
                                     the bookmark flag.
        :auth: required
        """

        search_fn = functools.partial(self._search, request, project)
        return update_groups(request, [project], project.organization_id, search_fn)

    @attach_scenarios([bulk_remove_issues_scenario])
    def delete(self, request, project):
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
        :pparam string project_slug: the slug of the project the issues
                                     belong to.
        :auth: required
        """
        search_fn = functools.partial(self._search, request, project)
        return delete_groups(request, [project], project.organization_id, search_fn)
