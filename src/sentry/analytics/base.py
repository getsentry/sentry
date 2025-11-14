from __future__ import annotations
from typing import int

import abc

from sentry.analytics.event import Event, EventEnvelope
from sentry.utils.services import Service

from .event_manager import default_manager

__all__ = ("Analytics",)


class Analytics(Service, abc.ABC):
    __all__ = ("record", "validate")

    event_manager = default_manager

    def record(self, event: Event) -> None:
        """
        Record an event. Must be an instance of a subclass of `Event`.

        >>> analytics.record(
        ...     MyEvent(
        ...         some_id=123,
        ...         some_prop="abc"
        ...     )
        ... )
        """
        self.record_event_envelope(EventEnvelope(event=event))

    def record_event_envelope(self, envelope: EventEnvelope) -> None:
        pass

    def setup(self) -> None:
        # Load default event types
        import sentry.analytics.events  # NOQA
