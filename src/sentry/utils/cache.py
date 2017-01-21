"""
sentry.utils.cache
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import functools

from django.core.cache import cache


default_cache = cache


class memoize(object):
    """
    Memoize the result of a property call.

    >>> class A(object):
    >>>     @memoize
    >>>     def func(self):
    >>>         return 'foo'
    """

    def __init__(self, func):
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


class cached_for_request(memoize):
    """
    Memoize the result of a for the duration of a request. If the system does
    not think it's in a request, the result is never saved.

    >>> class A(object):
    >>>     @memoize_for_request
    >>>     def func(self):
    >>>         return 'foo'
    """
    def _get_key(self, args, kwargs):
        return (self, tuple(args), tuple(kwargs.items()))

    def __call__(self, *args, **kwargs):
        from sentry.app import env

        request = env.request
        if not request:
            return self.func(*args, **kwargs)

        if not hasattr(request, '__func_cache'):
            data = request.__func_cache = {}
        else:
            data = request.__func_cache

        key = self._get_key(args, kwargs)

        if key not in data:
            value = self.func(*args, **kwargs)
            data[key] = value
        return data[key]

    def __get__(self, obj, type=None):
        return functools.partial(self.__call__, obj)
