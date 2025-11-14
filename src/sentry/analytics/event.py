from __future__ import annotations

import logging
from base64 import b64encode
from collections.abc import Callable
from dataclasses import asdict, dataclass, field, fields
from datetime import datetime as dt
from typing import Any, ClassVar, Self, cast, dataclass_transform, overload, int
from uuid import UUID, uuid1

from django.utils import timezone

logger = logging.getLogger(__name__)


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

        cls._eventclass_initialized = True
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
    _eventclass_initialized: ClassVar[bool] = False

    def __new__(cls, *args: Any, **kwargs: Any) -> Self:
        # Check if this class was decorated with @eventclass
        if "_eventclass_initialized" not in cls.__dict__:
            # If not decorated, check if it adds new dataclass fields compared to parent
            if getattr(cls, "__annotations__", None):
                logger.warning(
                    "Event class with new fields must use @eventclass decorator",
                    extra={"cls": cls},
                )

        return super().__new__(cls)

    def serialize(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if k != "type"}

    @classmethod
    # @deprecated("This constructor function is discouraged, as it is not type-safe.")
    def from_instance(cls, instance: Any, **kwargs: Any) -> Self:
        attrs: dict[str, Any] = {
            f.name: kwargs.get(f.name, getattr(instance, f.name, None))
            for f in fields(cls)
            if f.name != "type"
        }
        return cls(**attrs)


@dataclass()
class EventEnvelope:
    """
    An event envelope, adding an identifier and a timestamp for a recorded event
    """

    event: Event
    uuid: UUID = field(default_factory=lambda: uuid1())
    datetime: dt = field(default_factory=timezone.now)

    def serialize(self) -> dict[str, Any]:
        return serialize_event_envelope(self)


def serialize_event_envelope(envelope: EventEnvelope) -> dict[str, Any]:
    # TODO: this is the "old-style" attributes based serializer. Once all events are migrated to the new style,
    # we can remove this.
    return {
        "type": envelope.event.type,
        "uuid": b64encode(envelope.uuid.bytes),
        "timestamp": envelope.datetime.timestamp(),
        "data": envelope.event.serialize(),
    }
