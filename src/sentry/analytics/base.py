from __future__ import absolute_import

__all__ = ("Analytics",)

import six

from sentry.analytics.event import Event
from sentry.utils.services import Service

from .event_manager import default_manager


class Analytics(Service):
    __all__ = ("record", "validate")

    event_manager = default_manager

    def record(self, event_or_event_type, instance=None, **kwargs):
        """
        >>> record(Event())
        >>> record('organization.created', organization)
        """
        if isinstance(event_or_event_type, six.string_types):
            event = self.event_manager.get(event_or_event_type).from_instance(instance, **kwargs)
        elif isinstance(event_or_event_type, Event):
            event = event_or_event_type.from_instance(instance, **kwargs)
        else:
            return
        self.record_event(event)

    def record_event(self, event):
        """
        >>> record_event(Event())
        """

    def setup(self):
        # Load default event types
        import sentry.analytics.events  # NOQA
