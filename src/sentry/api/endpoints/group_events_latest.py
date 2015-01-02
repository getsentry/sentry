from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Group


class GroupEventsLatestEndpoint(Endpoint):
    def get(self, request, group_id):
        group = Group.objects.get(id=group_id)

        assert_perm(group, request.user, request.auth)

        event = group.get_latest_event()

        return HttpResponseRedirect(reverse('sentry-api-0-event-details', kwargs={
            'event_id': event.id,
        }))
