"""
sentry.utils.cache
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import functools
import logging
import random

from django.core.cache import cache
from time import sleep, time

default_cache = cache

logger = logging.getLogger(__name__)


class UnableToGetLock(Exception):
    pass


class LockAlreadyHeld(UnableToGetLock):
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

        self.__acquired_at = None

    def __repr__(self):
        return '<Lock: %r>' % (self.lock_key,)

    def acquire(self):
        """
        Attempt to acquire the lock, returning a boolean that represents if the
        lock is held.
        """
        # NOTE: This isn't API compatible with the standard Python
        # ``Lock.acquire`` method signature. It may make sense to make these
        # compatible in the future, but that would also require changes to the
        # the constructor: https://docs.python.org/2/library/threading.html#lock-objects

        time_remaining = self.seconds_remaining
        if time_remaining:
            raise LockAlreadyHeld('Tried to acquire lock that is already held, %.3fs remaining: %r' % (time_remaining, self))

        self.__acquired_at = None

        delay = 0.01 + random.random() / 10
        for i in xrange(int(self.timeout // delay)):
            if i != 0:
                sleep(delay)

            attempt_started_at = time()
            if self.cache.add(self.lock_key, '', self.timeout):
                self.__acquired_at = attempt_started_at
                break

            if self.nowait:
                break

        return self.__acquired_at is not None

    def release(self):
        """
        Release the lock.
        """
        # If we went over the lock duration (timeout), we need to exit to avoid
        # accidentally releasing a lock that was acquired by another process.
        if not self.held:
            logger.warning('Tried to release unheld lock: %r', self)
            return False

        try:
            # XXX: There is a possible race condition here -- this could be
            # actually past the timeout due to clock skew or the delete
            # operation could reach the server after the timeout for a variety
            # of reasons. The only real fix for this would be to use a check
            # and delete operation, but that is backend dependent and not
            # supported by the cache API.
            self.cache.delete(self.lock_key)
        except Exception as e:
            logger.exception(e)
        finally:
            self.__acquired_at = None

        return True

    @property
    def seconds_remaining(self):
        if self.__acquired_at is None:
            return 0

        lifespan = time() - self.__acquired_at
        return max(self.timeout - lifespan, 0)

    @property
    def held(self):
        return bool(self.seconds_remaining)

    def __enter__(self):
        start = time()

        if not self.acquire():
            raise UnableToGetLock('Unable to fetch lock after %.3fs: %r' % (time() - start, self,))

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.release()


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
