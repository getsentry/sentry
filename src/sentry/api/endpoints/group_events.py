from __future__ import absolute_import

import six

from datetime import timedelta
from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response

from sentry import quotas, tagstore
from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator
from sentry.models import Environment, Event, Group
from sentry.search.utils import parse_query
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.search.utils import InvalidQuery


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

        def respond(queryset):
            return self.paginate(
                request=request,
                queryset=queryset,
                order_by='-datetime',
                on_results=lambda x: serialize(x, request.user),
                paginator_cls=DateTimePaginator,
            )

        events = Event.objects.filter(group_id=group.id)

        try:
            environment = self._get_environment_from_request(
                request,
                group.project.organization_id,
            )
        except Environment.DoesNotExist:
            return respond(events.none())

        raw_query = request.GET.get('query')

        if raw_query:
            try:
                query_kwargs = parse_query(group.project, raw_query, request.user)
            except InvalidQuery as exc:
                return Response({'detail': six.text_type(exc)}, status=400)
            else:
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
                return respond(events.none())
            else:
                tags['environment'] = environment.name

        if query:
            q = Q(message__icontains=query)

            if len(query) == 32:
                q |= Q(event_id__exact=query)

            events = events.filter(q)

        if tags:
            event_ids = tagstore.get_group_event_ids(
                group.project_id,
                group.id,
                environment.id if environment is not None else None,
                tags,
            )

            if not event_ids:
                return respond(events.none())

            events = events.filter(id__in=event_ids)

        # filter out events which are beyond the retention period
        retention = quotas.get_event_retention(organization=group.project.organization)
        if retention:
            events = events.filter(
                datetime__gte=timezone.now() - timedelta(days=retention)
            )

        return respond(events)
