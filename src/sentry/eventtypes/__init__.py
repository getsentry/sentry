from .base import DefaultEvent
from .error import ErrorEvent
from .manager import EventTypeManager
from .security import CspEvent, ExpectCTEvent, ExpectStapleEvent, HpkpEvent
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
