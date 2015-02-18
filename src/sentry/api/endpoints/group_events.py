from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import Event


class GroupEventsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group):
        """
        List an aggregate's available samples

        Return a list of sampled events bound to an aggregate.

            {method} {path}

        """

        events = Event.objects.filter(
            group=group
        )

        return self.paginate(
            request=request,
            queryset=events,
            # TODO(dcramer): we want to sort by datetime
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )
