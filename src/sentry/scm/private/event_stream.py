import inspect
from collections import defaultdict
from collections.abc import Callable
from types import UnionType
from typing import DefaultDict, Union, get_args, get_origin, get_type_hints

from sentry.scm.types import PullRequest

EventType = PullRequest


def union_members(tp: type) -> set[type]:
    origin = get_origin(tp)
    return set(get_args(tp)) if origin is Union or origin is UnionType else {tp}


def is_event_type(tp: type):
    return union_members(tp) <= union_members(EventType)


class SourceCodeManagerEventStream:

    def __init__(self):
        self.__listeners: DefaultDict[EventType, list[Callable[[object], None]]] = defaultdict(list)

    def listen(self, fn: Callable[[EventType], None]) -> Callable[[EventType], None]:
        """
        Event type.
        """
        type_hints = get_type_hints(fn)
        params = list(inspect.signature(fn).parameters.keys())

        if not params or len(params) > 1:
            raise TypeError(f"{fn.__name__} must have one parameter")
        if params[0] not in type_hints:
            raise TypeError(f"{fn.__name__} must have a type hint on its first parameter")
        if not is_event_type(type_hints[params[0]]):
            raise TypeError(f"{fn.__name__} must accept one of these types {str(EventType)}")

        event_types = union_members(type_hints[params[0]])
        for event_type in event_types:
            self.__listeners[event_type].append(fn)

        return fn


scm_event_stream = SourceCodeManagerEventStream()
"""SCM Event stream singleton."""
