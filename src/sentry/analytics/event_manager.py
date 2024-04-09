__all__ = ("default_manager", "EventManager")

from collections.abc import MutableMapping
from typing import Any

from sentry.analytics.event import Event


class EventManager:
    def __init__(self) -> None:
        self._event_types: MutableMapping[Any, type[Event]] = {}

    def register(self, event_cls: type[Event]) -> None:
        event_type = event_cls.type
        if event_type in self._event_types:
            assert self._event_types[event_type] == event_cls
        else:
            self._event_types[event_type] = event_cls

    def get(self, type: str) -> type[Event]:
        return self._event_types[type]


default_manager = EventManager()
