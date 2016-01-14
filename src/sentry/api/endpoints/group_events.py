from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator
from sentry.models import Event, Group
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListAvailableSamples')
def list_available_samples_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/issues/%s/events/' % group.id
    )


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
            events = events.filter(
                message__icontains=query,
            )

        return self.paginate(
            request=request,
            queryset=events,
            order_by='-datetime',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )
