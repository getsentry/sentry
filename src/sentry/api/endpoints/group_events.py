from __future__ import absolute_import

import six

from datetime import timedelta
from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response
from functools32 import partial


from sentry import options, quotas, tagstore
from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers.models.event import SnubaEvent
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator, GenericOffsetPaginator
from sentry.models import Environment, Event, Group
from sentry.search.utils import parse_query
from sentry.search.utils import InvalidQuery
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.utils.validators import is_event_id
from sentry.utils.snuba import raw_query


class NoResults(Exception):
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
            environment = self._get_environment(request, group)
            query, tags = self._get_search_query_and_tags(request, group, environment)
        except InvalidQuery as exc:
            return Response({'detail': six.text_type(exc)}, status=400)
        except NoResults:
            return Response([])

        use_snuba = options.get('snuba.events-queries.enabled')
        backend = self._get_events_snuba if use_snuba else self._get_events_legacy
        return backend(request, group, environment, query, tags)

    def _get_events_snuba(self, request, group, environment, query, tags):
        conditions = []
        if query:
            msg_substr = ['positionCaseInsensitive', ['message', "'%s'" % (query,)]]
            message_condition = [msg_substr, '!=', 0]
            if is_event_id(query):
                or_condition = [message_condition, ['event_id', '=', query]]
                conditions.append(or_condition)
            else:
                conditions.append(message_condition)

        if tags:
            conditions.extend([[u'tags[{}]'.format(k), '=', v] for (k, v) in tags.items()])

        now = timezone.now()
        data_fn = partial(
            # extract 'data' from raw_query result
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            start=now - timedelta(days=90),
            end=now,
            conditions=conditions,
            filter_keys={
                'project_id': [group.project_id],
                'issue': [group.id]
            },
            selected_columns=SnubaEvent.selected_columns,
            orderby='-timestamp',
            referrer='api.group-events',
        )

        return self.paginate(
            request=request,
            on_results=lambda results: serialize(
                [SnubaEvent(row) for row in results], request.user),
            paginator=GenericOffsetPaginator(data_fn=data_fn)
        )

    def _get_events_legacy(self, request, group, environment, query, tags):
        events = Event.objects.filter(group_id=group.id)

        if query:
            q = Q(message__icontains=query)

            if is_event_id(query):
                q |= Q(event_id__exact=query)

            events = events.filter(q)

        if tags:
            event_filter = tagstore.get_group_event_filter(
                group.project_id,
                group.id,
                environment.id if environment is not None else None,
                tags,
            )

            if not event_filter:
                return Response([])

            events = events.filter(**event_filter)

        # filter out events which are beyond the retention period
        retention = quotas.get_event_retention(organization=group.project.organization)
        if retention:
            events = events.filter(
                datetime__gte=timezone.now() - timedelta(days=retention)
            )

        return self.paginate(
            request=request,
            queryset=events,
            order_by='-datetime',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )

    def _get_environment(self, request, group):
        try:
            return self._get_environment_from_request(
                request,
                group.project.organization_id,
            )
        except Environment.DoesNotExist:
            raise NoResults

    def _get_search_query_and_tags(self, request, group, environment=None):
        raw_query = request.GET.get('query')

        if raw_query:
            query_kwargs = parse_query([group.project], raw_query, request.user)
            query = query_kwargs.pop('query', None)
            tags = query_kwargs.pop('tags', {})
        else:
            query = None
            tags = {}

        if environment is not None:
            if 'environment' in tags and tags['environment'] != environment.name:
                # An event can only be associated with a single
                # environment, so if the environment associated with
                # the request is different than the environment
                # provided as a tag lookup, the query cannot contain
                # any valid results.
                raise NoResults
            else:
                tags['environment'] = environment.name

        return query, tags
