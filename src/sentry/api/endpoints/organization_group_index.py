from __future__ import absolute_import, division, print_function

import functools
import six

from django.conf import settings

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.helpers.group_search import build_query_params_from_request, get_by_short_id, ValidationError
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializerSnuba
from sentry.models import Environment, Group, GroupStatus, Project
from sentry.search.snuba.backend import SnubaSearchBackend


ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


search = SnubaSearchBackend(**settings.SENTRY_SEARCH_OPTIONS)


class OrganizationGroupIndexEndpoint(OrganizationEventsEndpointBase):

    def _build_query_params_from_request(self, request, organization, project_ids):
        projects = list(
            Project.objects.filter(
                id__in=project_ids,
                organization=organization,
            )
        )
        return build_query_params_from_request(request, projects)

    def _search(self, request, organization, project_ids, environments, extra_query_kwargs=None):
        query_kwargs = self._build_query_params_from_request(request, organization, project_ids)
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

        project_ids = self.get_project_ids(request, organization)

        if not project_ids:
            return Response([])

        query = request.GET.get('query', '').strip()
        if query:
            # check to see if we've got an event ID
            if len(query) == 32:
                groups = list(
                    Group.objects.filter_by_event_id(
                        project_ids,
                        query,
                    )
                )

                if groups:
                    return Response(serialize(groups, request.user, serializer()))

            group = get_by_short_id(organization.id, request.GET.get('shortIdLookup'), query)
            if group is not None:
                # check to make sure user has access to project
                if group.project_id in project_ids:
                    response = Response(
                        serialize(
                            [group], request.user, serializer()
                        )
                    )
                    response['X-Sentry-Direct-Hit'] = '1'
                    return response

        try:
            cursor_result, query_kwargs = self._search(
                request, organization, project_ids, environments, {'count_hits': True})
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
