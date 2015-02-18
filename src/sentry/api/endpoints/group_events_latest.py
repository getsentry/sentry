from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.api.bases.group import GroupEndpoint


class GroupEventsLatestEndpoint(GroupEndpoint):
    def get(self, request, group):
        event = group.get_latest_event()

        return HttpResponseRedirect(reverse('sentry-api-0-event-details', kwargs={
            'event_id': event.id,
        }))
