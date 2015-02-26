from __future__ import absolute_import

from sentry.api import client
from sentry.api.bases.group import GroupEndpoint


class GroupEventsLatestEndpoint(GroupEndpoint):
    def get(self, request, group):
        event = group.get_latest_event()

        return client.get('/events/{}/'.format(event.id), request.user, request.auth)
