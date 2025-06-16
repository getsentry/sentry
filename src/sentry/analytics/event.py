from __future__ import annotations

from base64 import b64encode
from collections.abc import Callable
from dataclasses import asdict, fields
from datetime import datetime as dt
from typing import Any, ClassVar, Self, cast, dataclass_transform, overload
from uuid import UUID, uuid1

from django.utils import timezone
from pydantic import Field
from pydantic.dataclasses import dataclass


# for using it with parenthesis, first parameter is optional
@overload
def eventclass(event_name_or_class: str | None = None) -> Callable[[type[Event]], type[Event]]: ...


# for using it without parenthesis
@overload
def eventclass(event_name_or_class: type[Event]) -> type[Event]: ...


@dataclass_transform()
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
        return cast(type[Event], dataclass(kw_only=True)(cls))

    # for using without parenthesis, wrap the passed class
    if isinstance(event_name_or_class, type) and issubclass(event_name_or_class, Event):
        return wrapper(event_name_or_class)

    # for usage with parenthesis return the wrapper itself
    return wrapper


# unfortunately we cannot directly use `eventclass` here, as it is making a typecheck to Event
@dataclass(kw_only=True)
class Event:
    """
    Base class for custom analytics Events. Subclasses *must* use the `eventclass` decorator.
    """

    type: ClassVar[str]

    uuid: UUID = Field(default_factory=lambda: uuid1())
    datetime: dt = Field(default_factory=timezone.now)

    def serialize(self) -> dict[str, Any]:
        return serialize_event(self)

    @classmethod
    # @deprecated("This constructor function is discuraged, as it is not type-safe.")
    def from_instance(cls, instance: Any, **kwargs: Any) -> Self:
        return cls(
            **{
                f.name: kwargs.get(f.name, getattr(instance, f.name, None))
                for f in fields(cls)
                if f.name not in ("type", "uuid", "datetime")
            }
        )


def serialize_event(event: Event) -> dict[str, Any]:
    return {
        "type": event.type,
        "uuid": b64encode(event.uuid.bytes),
        "timestamp": event.datetime.timestamp(),
        "data": {k: v for k, v in asdict(event).items() if k not in ("type", "uuid", "datetime")},
    }
