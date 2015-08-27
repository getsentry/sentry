from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator
from sentry.models import Event, Group
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListAvailableSamples')
def list_available_samples_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/groups/%s/events/' % group.id
    )


class GroupEventsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    @attach_scenarios([list_available_samples_scenario])
    def get(self, request, group):
        """
        List Available Samples
        ``````````````````````

        This endpoint lists an aggregate's available samples.

        :pparam string group_id: the ID of the group to retrieve.
        :auth: required
        """

        events = Event.objects.filter(
            group=group
        )

        return self.paginate(
            request=request,
            queryset=events,
            order_by='-datetime',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )
