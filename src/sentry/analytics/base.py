from __future__ import annotations

import abc
from typing import Any, overload
from warnings import deprecated

from sentry.analytics.event import Event
from sentry.utils.services import Service

from .event_manager import default_manager

__all__ = ("Analytics",)


class Analytics(Service, abc.ABC):
    __all__ = ("record", "validate")

    event_manager = default_manager

    @overload
    def record(self, event_or_type: Event) -> None:
        """
        Record an event. Must be an instance of a subclass of `Event`.

        >>> analytics.record(
        ...     MyEvent(
        ...         some_id=123,
        ...         some_prop="abc"
        ...     )
        ... )
        """
        ...

    @overload
    @deprecated("Use the `record` method with an event class instead.")
    def record(self, event_or_type: str, instance: Any | None = None, **kwargs: Any) -> None:
        """
        Record an event, using its `type` name and kwargs. Deprecated, the version of this function
        where an event is directly passed is preferred, as it is more type-safe.

        >>> analytics.record(
        ...     "my-event",
        ...     some_id=123,
        ...     some_prop="abc"
        ... )
        """
        ...

    def record(self, event_or_type: Event | str, instance: Any = None, **kwargs: Any) -> None:
        if isinstance(event_or_type, str):
            event_cls = self.event_manager.get(event_or_type)
            event = event_cls.from_instance(instance, **kwargs)
        else:
            event = event_or_type

        self.record_event(event)

    def record_event(self, event: Event) -> None:
        pass

    def setup(self) -> None:
        # Load default event types
        import sentry.analytics.events  # NOQA
