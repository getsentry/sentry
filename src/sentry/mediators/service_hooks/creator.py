from __future__ import absolute_import

import six

from collections import Iterable
from itertools import chain

from sentry.mediators import Mediator, Param
from sentry.models import ServiceHook

# Subscribing to these events via the UI is done in a resource-centric way.
# This means you subscribe to "Issue" events. There are many types of Issue
# events - this maps those resource-centric values to the actual events
# emitted.
EVENT_EXPANSION = {
    'issue': ['issue.created'],
}


def expand_events(rolled_up_events):
    """
    Convert a list of rolled up events ('issue', etc) into a list of raw event
    types ('issue.created', etc.)
    """
    return set(chain.from_iterable(
        [EVENT_EXPANSION.get(event, [event]) for event in rolled_up_events]
    ))


def consolidate_events(raw_events):
    """
    Consolidate a list of raw event types ('issue.created', etc) into a list of
    rolled up events ('issue', etc).
    """
    return set(
        name for (name, rolled_up_events) in six.iteritems(EVENT_EXPANSION)
        if any(set(raw_events) & set(rolled_up_events))
    )


class Creator(Mediator):
    application = Param('sentry.models.ApiApplication', required=False)
    actor = Param('sentry.db.models.BaseModel')
    project = Param('sentry.models.Project')
    events = Param(Iterable)
    url = Param(six.string_types)

    def call(self):
        self.hook = self._create_service_hook()
        return self.hook

    def _create_service_hook(self):
        return ServiceHook.objects.create(
            application_id=self.application.id,
            actor_id=self.actor.id,
            project_id=self.project.id,
            events=expand_events(self.events),
            url=self.url,
        )
