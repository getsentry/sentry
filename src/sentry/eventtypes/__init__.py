from __future__ import absolute_import

from .base import DefaultEvent
from .security import CspEvent, HpkpEvent, ExpectCTEvent, ExpectStapleEvent
from .error import ErrorEvent
from .manager import EventTypeManager
from .transaction import TransactionEvent

default_manager = EventTypeManager()
default_manager.register(DefaultEvent)
default_manager.register(ErrorEvent)
default_manager.register(CspEvent)
default_manager.register(HpkpEvent)
default_manager.register(ExpectCTEvent)
default_manager.register(ExpectStapleEvent)
default_manager.register(TransactionEvent)

get = default_manager.get
register = default_manager.register
