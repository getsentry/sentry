from typing import Union

from sentry.eventtypes.base import DefaultEvent
from sentry.eventtypes.error import ErrorEvent
from sentry.eventtypes.feedback import FeedbackEvent
from sentry.eventtypes.generic import GenericEvent
from sentry.eventtypes.manager import EventTypeManager
from sentry.eventtypes.nel import NelEvent
from sentry.eventtypes.security import CspEvent, ExpectCTEvent, ExpectStapleEvent, HpkpEvent
from sentry.eventtypes.transaction import TransactionEvent

default_manager = EventTypeManager()
default_manager.register(DefaultEvent)
default_manager.register(ErrorEvent)
default_manager.register(CspEvent)
default_manager.register(NelEvent)
default_manager.register(HpkpEvent)
default_manager.register(ExpectCTEvent)
default_manager.register(ExpectStapleEvent)
default_manager.register(TransactionEvent)
default_manager.register(GenericEvent)
default_manager.register(FeedbackEvent)


get = default_manager.get
register = default_manager.register

EventType = Union[
    DefaultEvent,
    ErrorEvent,
    CspEvent,
    NelEvent,
    HpkpEvent,
    ExpectCTEvent,
    ExpectStapleEvent,
    TransactionEvent,
    GenericEvent,
    FeedbackEvent,
]
