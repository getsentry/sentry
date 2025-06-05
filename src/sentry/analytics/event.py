from __future__ import annotations

import typing
from base64 import b64encode
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import datetime as dt
from typing import Any, ClassVar, overload
from uuid import UUID, uuid1

from django.utils import timezone


# for using it with parenthesis, first parameter is optional
@overload
def eventclass(event_name_or_class: str | None = None) -> Callable[[type[Event]], type[Event]]: ...


# for using it without parenthesis
@overload
def eventclass(event_name_or_class: type[Event]) -> type[Event]: ...


@typing.dataclass_transform()
def eventclass(
    event_name_or_class: str | type[Event] | None = None,
) -> Callable[[type[Event]], type[Event]] | type[Event]:
    """
    Decorator for marking an Event as a dataclass. Sets default arguments for the dataclass underneath and sets
    the classes `type` property if specified.

    Use it either without paranthesis:

    >>> @eventclass
    ... class MyEvent(Event):
    ...     ...

    With parenthesis (but no type name):

    >>> @eventclass()
    ... class MyEvent(Event):
    ...     ...

    Or with an event type name:

    >>> @eventclass("my-event")
    ... class MyEvent(Event):
    ...     ...
    """

    def wrapper(cls: type[Event]) -> type[Event]:
        # set the Event subclass `type` attribute, if it is set to anything
        if isinstance(event_name_or_class, str):
            cls.type = event_name_or_class
        return dataclass(slots=True, kw_only=True)

    # for using without parenthesis, wrap the passed class
    if isinstance(event_name_or_class, type) and issubclass(event_name_or_class, Event):
        return wrapper(event_name_or_class)

    # for usage with parenthesis return the wrapper itself
    return wrapper


@eventclass
class Event:
    """
    Base class for custom analytics Events. Subclasses *must* use the `eventclass` decorator.
    """

    type: ClassVar[str]

    uuid: UUID = field(default_factory=uuid1)
    datetime: dt = field(default_factory=timezone.now)

    def serialize(self) -> dict[str, Any]:
        return serialize_event(self)


def serialize_event(event: Event) -> dict[str, Any]:
    return {
        "type": event.type,
        "uuid": b64encode(event.uuid.bytes),
        "timestamp": event.datetime.timestamp(),
        "data": {k: v for k, v in asdict(event).items() if k not in ("type", "uuid", "datetime")},
    }
