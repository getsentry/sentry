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


# this overload of the decorator is for using it with parenthesis, first parameter is optional
# e.g: `@eventclass()` or `@eventclass("my-event")`
@overload
def eventclass(event_name_or_class: str | None = None) -> Callable[[type[Event]], type[Event]]: ...


# this overload of the decorator is for using it without parenthesis
# e.g: `@eventclass`
@overload
def eventclass(event_name_or_class: type[Event]) -> type[Event]: ...


@dataclass_transform(kw_only_default=True)
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
    >>> MyEvent.type
    None

    With parenthesis (but no type name):

    >>> @eventclass()
    ... class MyEvent(Event):
    ...     ...
    >>> MyEvent.type
    None

    Or with an event type name:

    >>> @eventclass("my-event")
    ... class MyEvent(Event):
    ...     ...
    >>> MyEvent.type
    "my-event"
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
    Base class for custom analytics Events.
    """

    # the type of the event, used for serialization and matching. Can be None for abstract base event classes
    type: ClassVar[str | None]

    # we use the _ postfix to avoid name conflicts inheritors fields
    uuid_: UUID = Field(default_factory=lambda: uuid1())
    datetime_: dt = Field(default_factory=timezone.now)

    def serialize(self) -> dict[str, Any]:
        return serialize_event(self)

    @classmethod
    # @deprecated("This constructor function is discouraged, as it is not type-safe.")
    def from_instance(cls, instance: Any, **kwargs: Any) -> Self:
        attrs: dict[str, Any] = {
            f.name: kwargs.get(f.name, getattr(instance, f.name, None))
            for f in fields(cls)
            if f.name
            not in (
                "type",
                "uuid_",
                "datetime_",
            )
        }
        return cls(**attrs)


def serialize_event(event: Event) -> dict[str, Any]:
    data = {
        k: v for k, v in asdict(event).items() if k not in ("type", "uuid_", "datetime_", "data")
    }
    return {
        "type": event.type,
        "uuid": b64encode(event.uuid_.bytes),
        "timestamp": event.datetime_.timestamp(),
        "data": data,
    }
