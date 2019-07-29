from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone
from rest_framework.response import Response
from functools import partial


from sentry import features
from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.event_search import get_snuba_query_args
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.events import get_direct_hit_response
from sentry.api.serializers import EventSerializer, serialize, SimpleEventSerializer
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import get_date_range_from_params
from sentry.models import Group, SnubaEvent
from sentry.search.utils import (
    InvalidQuery,
    parse_query,
)
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.utils.snuba import raw_query


class NoResults(Exception):
    pass


class GroupEventsError(Exception):
    pass


@scenario('ListAvailableSamples')
def list_available_samples_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(method='GET', path='/issues/%s/events/' % group.id)


class GroupEventsEndpoint(GroupEndpoint, EnvironmentMixin):
    doc_section = DocSection.EVENTS

    @attach_scenarios([list_available_samples_scenario])
    def get(self, request, group):
        """
        List an Issue's Events
        ``````````````````````

        This endpoint lists an issue's events.

        :pparam string issue_id: the ID of the issue to retrieve.
        :auth: required
        """

        try:
            environments = get_environments(request, group.project.organization)
            query, tags = self._get_search_query_and_tags(
                request,
                group,
                environments,
            )
        except InvalidQuery as exc:
            return Response({'detail': six.text_type(exc)}, status=400)
        except (NoResults, ResourceDoesNotExist):
            return Response([])

        start, end = get_date_range_from_params(request.GET, optional=True)

        try:
            return self._get_events_snuba(request, group, environments, query, tags, start, end)
        except GroupEventsError as exc:
            return Response({'detail': six.text_type(exc)}, status=400)

    def _get_events_snuba(self, request, group, environments, query, tags, start, end):
        default_end = timezone.now()
        default_start = default_end - timedelta(days=90)
        params = {
            'issue.id': [group.id],
            'project_id': [group.project_id],
            'start': start if start else default_start,
            'end': end if end else default_end
        }
        direct_hit_resp = get_direct_hit_response(request, query, params, 'api.group-events')
        if direct_hit_resp:
            return direct_hit_resp

        if environments:
            params['environment'] = [env.name for env in environments]

        full = request.GET.get('full', False)
        snuba_args = get_snuba_query_args(request.GET.get('query', None), params)

        # TODO(lb): remove once boolean search is fully functional
        if snuba_args:
            has_boolean_op_flag = features.has(
                'organizations:boolean-search',
                group.project.organization,
                actor=request.user
            )
            if snuba_args.pop('has_boolean_terms', False) and not has_boolean_op_flag:
                raise GroupEventsError(
                    'Boolean search operator OR and AND not allowed in this search.')

        snuba_cols = SnubaEvent.minimal_columns if full else SnubaEvent.selected_columns

        data_fn = partial(
            # extract 'data' from raw_query result
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            selected_columns=snuba_cols,
            orderby='-timestamp',
            referrer='api.group-events',
            **snuba_args
        )

        serializer = EventSerializer() if full else SimpleEventSerializer()
        return self.paginate(
            request=request,
            on_results=lambda results: serialize(
                [SnubaEvent(row) for row in results], request.user, serializer),
            paginator=GenericOffsetPaginator(data_fn=data_fn)
        )

    def _get_search_query_and_tags(self, request, group, environments=None):
        raw_query = request.GET.get('query')

        if raw_query:
            query_kwargs = parse_query([group.project], raw_query, request.user, environments)
            query = query_kwargs.pop('query', None)
            tags = query_kwargs.pop('tags', {})
        else:
            query = None
            tags = {}

        if environments:
            env_names = set(env.name for env in environments)
            if 'environment' in tags:
                # If a single environment was passed as part of the query, then
                # we'll just search for that individual environment in this
                # query, even if more are selected.
                if tags['environment'] not in env_names:
                    # An event can only be associated with a single
                    # environment, so if the environments associated with
                    # the request don't contain the environment provided as a
                    # tag lookup, the query cannot contain any valid results.
                    raise NoResults
            else:
                # XXX: Handle legacy backends here. Just store environment as a
                # single tag if we only have one so that we don't break existing
                # usage.
                tags['environment'] = list(env_names) if len(env_names) > 1 else env_names.pop()

        return query, tags
