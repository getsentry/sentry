from __future__ import absolute_import

from sentry.api.base import DocSection, Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Event, Group


class GroupEventsEndpoint(Endpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group_id):
        """
        List an aggregate's available samples

        Return a list of sampled events bound to an aggregate.

            {method} {path}

        """
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

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
