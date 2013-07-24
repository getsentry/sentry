"""
sentry.utils.cache
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import functools
import logging
import random
import time

from django.core.cache import cache

default_cache = cache

logger = logging.getLogger(__name__)


class UnableToGetLock(Exception):
    pass


class Lock(object):
    """
    Uses the defined cache backend to create a lock.

    >>> with Lock('key name'):
    >>>     # do something
    """
    def __init__(self, lock_key, timeout=3, cache=None, nowait=False):
        if cache is None:
            self.cache = default_cache
        else:
            self.cache = cache
        self.timeout = timeout
        self.lock_key = lock_key
        self.nowait = nowait

    def __enter__(self):
        lock_key = self.lock_key
        cache = self.cache

        delay = 0.01 + random.random() / 10
        attempt = 0
        max_attempts = self.timeout / delay
        got_lock = None
        self.was_locked = False
        while not got_lock and attempt < max_attempts:
            got_lock = cache.add(lock_key, '', self.timeout)
            if not got_lock:
                if self.nowait:
                    break
                self.was_locked = True
                time.sleep(delay)
                attempt += 1

        if not got_lock:
            raise UnableToGetLock('Unable to fetch lock after on %s' % (lock_key,))

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            self.cache.delete(self.lock_key)
        except Exception, e:
            logger.exception(e)


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
