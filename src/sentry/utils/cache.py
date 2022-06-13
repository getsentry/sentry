from django.core.cache import cache

default_cache = cache


class memoize:
    """
    Memoize the result of a property call.

    >>> class A(object):
    >>>     @memoize
    >>>     def func(self):
    >>>         return 'foo'
    """

    def __init__(self, func):
        if isinstance(func, classmethod) or isinstance(func, staticmethod):
            func = func.__func__

        self.__name__ = func.__name__
        self.__module__ = func.__module__
        self.__doc__ = func.__doc__
        self.func = func

    def __get__(self, obj, type=None):
        if obj is None:
            return self
        d, n = vars(obj), self.__name__
        if n not in d:
            value = self.func(obj)
            d[n] = value
        value = d[n]
        return value


def cache_key_for_event(data) -> str:
    return "e:{1}:{0}".format(data["project"], data["event_id"])
