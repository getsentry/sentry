import functools

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.helpers.group_index import (
    delete_groups,
    get_by_short_id,
    prep_search,
    track_slo_response,
    update_groups_with_search_fn,
)
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializer
from sentry.models.environment import Environment
from sentry.models.group import QUERY_STATUS_LOOKUP, Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.search.events.constants import EQUALITY_OPERATORS
from sentry.signals import advanced_search
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.validators import normalize_event_id

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"
ERR_HASHES_AND_OTHER_QUERY = "Cannot use 'hashes' with 'query'"


@region_silo_endpoint
class ProjectGroupIndexEndpoint(ProjectEndpoint, EnvironmentMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectEventPermission,)
    enforce_rate_limit = True

    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=5, window=1),
            RateLimitCategory.USER: RateLimit(limit=5, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=1),
        }
    }

    @track_slo_response("workflow")
    def get(self, request: Request, project) -> Response:
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
        :qparam list hashes: hashes of groups to return, overrides 'query' parameter, only returning list of groups found from hashes. The maximum number of hashes that can be sent is 100. If more are sent, only the first 100 will be used.
        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          issues belong to.
        :pparam string project_id_or_slug: the id or slug of the project the issues
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

            serialized_groups = serialize(
                groups,
                request.user,
                serializer(),
            )
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

                serialized_groups = serialize(
                    [matching_group],
                    request.user,
                    serializer(),
                )
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
            cursor_result, query_kwargs = prep_search(self, request, project, {"count_hits": True})
        except ValidationError as exc:
            return Response({"detail": str(exc)}, status=400)

        results = list(cursor_result)

        context = serialize(results, request.user, serializer())

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
            analytics.record(
                "project_issue.searched",
                user_id=request.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                query=query,
            )

        return response

    @track_slo_response("workflow")
    def put(self, request: Request, project) -> Response:
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

        If any IDs are out of scope this operation will succeed without
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
        :pparam string project_id_or_slug: the id or slug of the project the issues
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
        :param string substatus: the new substatus for the issues. Valid values
                                 defined in GroupSubStatus.
        :auth: required
        """

        search_fn = functools.partial(prep_search, self, request, project)
        return update_groups_with_search_fn(
            request,
            request.GET.getlist("id"),
            [project],
            project.organization_id,
            search_fn,
        )

    @track_slo_response("workflow")
    def delete(self, request: Request, project) -> Response:
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
        :qparam querystring query: an optional Sentry structured search
                                   query. If not provided an implied
                                   ``"is:unresolved"`` is assumed.)
        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          issues belong to.
        :pparam string project_id_or_slug: the id or slug of the project the issues
                                     belong to.
        :auth: required
        """
        search_fn = functools.partial(prep_search, self, request, project)
        return delete_groups(request, [project], project.organization_id, search_fn)
