from collections.abc import Callable, Mapping
from typing import Any, Generic, TypeVar

from django.core.cache import cache

__all__ = ["cache", "memoize", "default_cache", "cache_key_for_event"]

default_cache = cache

T = TypeVar("T")


class memoize(Generic[T]):
    """
    Memoize the result of a property call.

    >>> class A(object):
    >>>     @memoize
    >>>     def func(self):
    >>>         return 'foo'
    """

    def __init__(self, func: Callable[[Any], T]) -> None:
        if isinstance(func, classmethod) or isinstance(func, staticmethod):
            func = func.__func__  # type: ignore

        self.__name__ = func.__name__
        self.__module__ = func.__module__
        self.__doc__ = func.__doc__
        self.func = func

    def __get__(self, obj: Any, type: Any = None) -> T:
        if obj is None:
            return self  # type: ignore
        d, n = vars(obj), self.__name__
        if n not in d:
            value = self.func(obj)
            d[n] = value
        value = d[n]
        return value


        def cache_key_for_event(data: Mapping[str, Any]) -> str:
            event_id = data.get('event_id', 'unknown_event_id')
            project = data.get('project', 'unknown_project')
            if event_id == 'unknown_event_id' or project == 'unknown_project':
                logger.error(f\"cache_key_for_event called with missing data. event_id: {event_id}, project: {project}\")
            return \"e:{}:{}'.format(event_id, project)
