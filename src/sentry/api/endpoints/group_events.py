from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.api.base import DocSection
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator
from sentry.models import Event, Group
from sentry.search.utils import parse_query
from sentry.utils.apidocs import scenario, attach_scenarios
from rest_framework.response import Response
from sentry.search.utils import InvalidQuery


@scenario('ListAvailableSamples')
def list_available_samples_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(method='GET', path='/issues/%s/events/' % group.id)


class GroupEventsEndpoint(GroupEndpoint):
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

        events = Event.objects.filter(
            group_id=group.id,
        )

        query = request.GET.get('query')
        if query:
            try:
                query_kwargs = parse_query(group.project, query, request.user)
            except InvalidQuery as exc:
                return Response({'detail': six.text_type(exc)}, status=400)

            if query_kwargs['query']:
                events = events.filter(
                    message__icontains=query_kwargs['query'],
                )

            if query_kwargs['tags']:
                event_ids = tagstore.get_group_event_ids(
                    group.project_id, group.id, query_kwargs['tags'])
                if event_ids:
                    events = events.filter(
                        id__in=event_ids,
                    )
                else:
                    events = events.none()

        return self.paginate(
            request=request,
            queryset=events,
            order_by='-datetime',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )
