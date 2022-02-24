from __future__ import annotations

__all__ = ("Analytics",)

import abc
from typing import Any

from sentry.analytics.event import Event
from sentry.utils.services import Service

from .event_manager import default_manager


class Analytics(Service, abc.ABC):
    __all__ = ("record", "validate")

    event_manager = default_manager

    def record(
        self, event_or_event_type: str | Event | Any, instance: Any | None = None, **kwargs: Any
    ) -> None:
        if isinstance(event_or_event_type, str):
            event = self.event_manager.get(event_or_event_type).from_instance(instance, **kwargs)
        elif isinstance(event_or_event_type, Event):
            event = event_or_event_type.from_instance(instance, **kwargs)
        else:
            return
        self.record_event(event)

    def record_event(self, event: Event) -> None:
        pass

    def setup(self) -> None:
        # Load default event types
        import sentry.analytics.events  # NOQA

        pass
