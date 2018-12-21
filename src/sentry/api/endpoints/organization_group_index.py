from __future__ import absolute_import, division, print_function

import functools
import six

from django.conf import settings

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializerSnuba
from sentry.constants import DEFAULT_SORT_OPTION
from sentry.models import Environment, Group, GroupStatus, Project
from sentry.models.group import looks_like_short_id
from sentry.search.snuba.backend import SnubaSearchBackend
from sentry.search.utils import InvalidQuery, parse_query
from sentry.utils.cursors import Cursor


ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


search = SnubaSearchBackend(**settings.SENTRY_SEARCH_OPTIONS)


class ValidationError(Exception):
    pass


class OrganizationGroupIndexEndpoint(OrganizationEventsEndpointBase):

    def _build_query_params_from_request(self, request, organization):
        # TODO(jess): handle No projects
        projects = list(Project.objects.filter(id__in=self.get_project_ids(request, organization)))

        query_kwargs = {
            'projects': projects,
            'sort_by': request.GET.get('sort', DEFAULT_SORT_OPTION),
        }

        limit = request.GET.get('limit')
        if limit:
            try:
                query_kwargs['limit'] = int(limit)
            except ValueError:
                raise ValidationError('invalid limit')

        # TODO: proper pagination support
        cursor = request.GET.get('cursor')
        if cursor:
            query_kwargs['cursor'] = Cursor.from_string(cursor)

        query = request.GET.get('query', 'is:unresolved').strip()
        if query:
            try:
                query_kwargs.update(parse_query(projects, query, request.user))
            except InvalidQuery as e:
                raise ValidationError(
                    u'Your search query could not be parsed: {}'.format(
                        e.message)
                )

        return query_kwargs

    def _search(self, request, organization, environments, extra_query_kwargs=None):
        query_kwargs = self._build_query_params_from_request(request, organization)
        if extra_query_kwargs is not None:
            assert 'environment' not in extra_query_kwargs
            query_kwargs.update(extra_query_kwargs)

        query_kwargs['environments'] = environments if environments else None
        result = search.query(**query_kwargs)
        return result, query_kwargs

    def get(self, request, organization):
        """
        List an Organization's Issues
        `````````````````````````````

        Return a list of issues (groups) bound to an organization.  All parameters are
        supplied as query string parameters.

        A default query of ``is:unresolved`` is applied. To return results
        with other statuses send an new query value (i.e. ``?query=`` for all
        results).

        The ``statsPeriod`` parameter can be used to select the timeline
        stats which should be present. Possible values are: '' (disable),
        '24h', '14d'

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
        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :auth: required
        """
        stats_period = request.GET.get('statsPeriod')
        if stats_period not in (None, '', '24h', '14d'):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        elif stats_period is None:
            # default
            stats_period = '24h'
        elif stats_period == '':
            # disable stats
            stats_period = None

        environments = list(Environment.objects.filter(
            organization_id=organization.id,
            name__in=self.get_environments(request, organization),
        ))

        serializer = functools.partial(
            StreamGroupSerializerSnuba,
            environment_ids=[env.id for env in environments],
            stats_period=stats_period,
        )

        query = request.GET.get('query', '').strip()
        if query:
            matching_group = None
            # TODO(jess): How should we handle event id searches since we don't have project?
            # matching_event = None
            # if len(query) == 32:
            #     # check to see if we've got an event ID
            #     try:
            #         matching_group = Group.objects.from_event_id(project, query)
            #     except Group.DoesNotExist:
            #         pass
            #     else:
            #         try:
            #             matching_event = Event.objects.get(
            #                 event_id=query, project_id=project.id)
            #         except Event.DoesNotExist:
            #             pass
            #         else:
            #             Event.objects.bind_nodes([matching_event], 'data')

            # If the query looks like a short id, we want to provide some
            # information about where that is.  Note that this can return
            # results for another project.  The UI deals with this.
            if request.GET.get('shortIdLookup') == '1' and \
                    looks_like_short_id(query):
                try:
                    matching_group = Group.objects.by_qualified_short_id(
                        organization.id, query
                    )
                except Group.DoesNotExist:
                    matching_group = None

            if matching_group is not None:
                response = Response(
                    serialize(
                        [matching_group], request.user, serializer()
                    )
                )
                response['X-Sentry-Direct-Hit'] = '1'
                return response

        try:
            cursor_result, query_kwargs = self._search(
                request, organization, environments, {'count_hits': True})
        except ValidationError as exc:
            return Response({'detail': six.text_type(exc)}, status=400)

        results = list(cursor_result)

        context = serialize(results, request.user, serializer())

        # HACK: remove auto resolved entries
        if query_kwargs.get('status') == GroupStatus.UNRESOLVED:
            context = [r for r in context if r['status'] == 'unresolved']

        response = Response(context)

        self.add_cursor_headers(request, response, cursor_result)

        # TODO(jess): add metrics that are similar to project endpoint here

        return response
