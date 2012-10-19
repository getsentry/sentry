import logging
import time

from django.core.cache import get_cache, cache

from sentry.conf import settings

if settings.CACHE_BACKEND != 'default':
    cache = get_cache(settings.CACHE_BACKEND)  # NOQA

_cache = cache


logger = logging.getLogger(__name__)


class UnableToGetLock(Exception):
    pass


class Lock(object):
    """
    Uses the defined cache backend to create a lock.

    >>> with Lock('key name'):
    >>>     # do something
    """
    def __init__(self, lock_key, timeout=10, cache=None):
        if cache is None:
            self.cache = _cache
        else:
            self.cache = cache
        self.timeout = timeout
        self.lock_key = lock_key

    def __enter__(self):
        start = time.time()
        lock_key = self.lock_key
        cache = self.cache

        delay = 0.1
        attempt = 0
        max_attempts = self.timeout / delay
        got_lock = None
        self.was_locked = False
        while not got_lock and attempt < max_attempts:
            got_lock = cache.add(lock_key, '', self.timeout)
            if not got_lock:
                self.was_locked = True
                time.sleep(delay)
                attempt += 1

        if not got_lock:
            raise UnableToGetLock('Unable to fetch lock after %.2fs' % (time.time() - start,))

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            self.cache.delete(self.lock_key)
        except Exception, e:
            logger.exception(e)
