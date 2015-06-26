from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api import client
from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint


class GroupEventsLatestEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group):
        """
        Retrieve the latest sample for an aggregate

        Return details on the latest sample for this aggregate.

            {method} {path}

        """
        event = group.get_latest_event()
        if not event:
            return Response({'detail': 'No events found'}, status=404)

        return client.get('/events/{}/'.format(event.id), request.user, request.auth)
