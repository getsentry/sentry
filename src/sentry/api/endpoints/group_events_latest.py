from __future__ import absolute_import

from sentry.api import client
from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint


class GroupEventsLatestEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group):
        """
        Retrieve the latest event

        Return details on the latest event for this group.

            {method} {path}

        """
        event = group.get_latest_event()

        return client.get('/events/{}/'.format(event.id), request.user, request.auth)
