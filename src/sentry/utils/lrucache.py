"""
sentry.utils.lru_cache
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from collections import namedtuple
from functools import wraps
from threading import Lock

_CacheInfo = namedtuple("CacheInfo", ["hits", "misses", "maxsize", "currsize"])

HITS = 0
MISSES = 1

PREV = 0
NEXT = 1
KEY = 2
RESULT = 3


class LRUCache(object):
    """
    Least-recently-used cache decorator.

    (Based on functools.lru_cache in Python 3.3)

    If *maxsize* is set to None, the LRU features are disabled and the cache
    can grow without bound.

    If *typed* is True, arguments of different types will be cached separately.
    For example, f(3.0) and f(3) will be treated as distinct calls with
    distinct results.

    Arguments to the cached function must be hashable.

    View the cache statistics named tuple (hits, misses, maxsize, currsize) with
    f.cache_info().  Clear the cache and statistics with f.cache_clear().
    Access the underlying function with f.__wrapped__.

    See:  http://en.wikipedia.org/wiki/Cache_algorithms#Least_Recently_Used
    """
    # Users should only access the lru_cache through its public API:
    #       cache_info, cache_clear, and f.__wrapped__
    # The internals of the lru_cache are encapsulated for thread safety and
    # to allow the implementation to change (including a possible C version).
    def __init__(self, maxsize=100, typed=False):
        assert maxsize > 0

        self.maxsize = maxsize
        self.typed = typed

        self.cache = dict()
        self.stats = [0, 0]  # make statistics updateable non-locally
        self.kwd_mark = (object(),)  # separate positional and keyword args
        self.lock = Lock()  # because linkedlist updates aren't threadsafe
        self.root = []  # root of the circular doubly linked list
        self.nonlocal_root = [self.root]  # make updateable non-locally
        self.root[:] = [self.root, self.root, None, None]  # initialize by pointing to self

    def make_key(self, func, args, kwds, tuple=tuple, sorted=sorted, type=type):
        # helper function to build a cache key from positional and keyword args
        key = (func,) + args
        if kwds:
            sorted_items = tuple(sorted(kwds.items()))
            key += self.kwd_mark + sorted_items
        if self.typed:
            key += tuple(type(v) for v in args)
            if kwds:
                key += tuple(type(v) for k, v in sorted_items)
        return key

    def memoize(self, func):
        @wraps(func)
        def wrapper(*args, **kwargs):  # NOQA
            # size limited caching that tracks accesses by recency
            key = self.make_key(func, args, kwargs)
            with self.lock:
                link = self.cache.get(key)
                if link is not None:
                    # record recent use of the key by moving it to the front of the list
                    self.root, = self.nonlocal_root
                    link_prev, link_next, key, result = link
                    link_prev[NEXT] = link_next
                    link_next[PREV] = link_prev
                    last = self.root[PREV]
                    last[NEXT] = self.root[PREV] = link
                    link[PREV] = last
                    link[NEXT] = self.root
                    self.stats[HITS] += 1
                    return result

            result = func(*args, **kwargs)
            with self.lock:
                self.root = self.nonlocal_root[0]
                if len(self.cache) < self.maxsize:
                    # put result in a new link at the front of the list
                    last = self.root[PREV]
                    link = [last, self.root, key, result]
                    self.cache[key] = last[NEXT] = self.root[PREV] = link
                else:
                    # use root to store the new key and result
                    self.root[KEY] = key
                    self.root[RESULT] = result
                    self.cache[key] = self.root
                    # empty the oldest link and make it the new root
                    self.root = self.nonlocal_root[0] = self.root[NEXT]
                    del self.cache[self.root[KEY]]
                    self.root[KEY] = None
                    self.root[RESULT] = None
                self.stats[MISSES] += 1
            return result

        def clear_cache(self, *args, **kwargs):
            """
            Clear the cache for a specific function signature
            """
            key = self.make_key(func, args, kwargs)
            self.cache.pop(key, None)

        wrapper.clear_cache = clear_cache
        return wrapper

    def stats(self):
        """Report cache statistics"""
        with self.lock:
            return _CacheInfo(self.stats[HITS], self.stats[MISSES], self.maxsize, len(self.cache))

    def clear(self):
        """Clear the cache and cache statistics"""
        with self.lock:
            self.cache.clear()
            self.root = self.nonlocal_root[0]
            self.root[:] = [self.root, self.root, None, None]
            self.stats[:] = [0, 0]

lrucache = LRUCache()
