from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator
from sentry.models import Event


class GroupEventsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group):
        """
        List Available Samples
        ``````````````````````

        This endpoint lists an aggregate's available samples.
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
