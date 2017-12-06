from __future__ import absolute_import

from .base import DefaultEvent
from .security import CspEvent, ExpectCTEvent, ExpectStapleEvent
from .error import ErrorEvent
from .manager import EventTypeManager

# types are ordered by priority, default should always be last
default_manager = EventTypeManager()
default_manager.register(CspEvent)
default_manager.register(ExpectCTEvent)
default_manager.register(ExpectStapleEvent)
default_manager.register(ErrorEvent)
default_manager.register(DefaultEvent)

get = default_manager.get
register = default_manager.register
infer = default_manager.infer
