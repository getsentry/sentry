from __future__ import absolute_import, unicode_literals

import inspect
import sys
import time

from django.conf import settings
from django.core import cache
from django.core.cache import (
    cache as original_cache,
    get_cache as original_get_cache)
from django.core.cache.backends.base import BaseCache
from django.dispatch import Signal
from django.middleware import cache as middleware_cache
from django.utils.translation import ugettext_lazy as _, ungettext


from debug_toolbar import settings as dt_settings
from debug_toolbar.compat import (
    OrderedDict, CacheHandler, caches as original_caches)
from debug_toolbar.panels import Panel
from debug_toolbar.utils import (tidy_stacktrace, render_stacktrace,
                                 get_template_info, get_stack)


cache_called = Signal(providing_args=[
    "time_taken", "name", "return_value", "args", "kwargs", "trace"])


def send_signal(method):
    def wrapped(self, *args, **kwargs):
        t = time.time()
        value = method(self, *args, **kwargs)
        t = time.time() - t

        if dt_settings.CONFIG['ENABLE_STACKTRACES']:
            stacktrace = tidy_stacktrace(reversed(get_stack()))
        else:
            stacktrace = []

        template_info = get_template_info()
        cache_called.send(sender=self.__class__, time_taken=t,
                          name=method.__name__, return_value=value,
                          args=args, kwargs=kwargs, trace=stacktrace,
                          template_info=template_info, backend=self.cache)
        return value
    return wrapped


class CacheStatTracker(BaseCache):
    """A small class used to track cache calls."""
    def __init__(self, cache):
        self.cache = cache

    def __repr__(self):
        return str("<CacheStatTracker for %s>") % repr(self.cache)

    def _get_func_info(self):
        frame = sys._getframe(3)
        info = inspect.getframeinfo(frame)
        return (info[0], info[1], info[2], info[3])

    def __contains__(self, key):
        return self.cache.__contains__(key)

    def __getattr__(self, name):
        return getattr(self.cache, name)

    @send_signal
    def add(self, *args, **kwargs):
        return self.cache.add(*args, **kwargs)

    @send_signal
    def get(self, *args, **kwargs):
        return self.cache.get(*args, **kwargs)

    @send_signal
    def set(self, *args, **kwargs):
        return self.cache.set(*args, **kwargs)

    @send_signal
    def delete(self, *args, **kwargs):
        return self.cache.delete(*args, **kwargs)

    @send_signal
    def clear(self, *args, **kwargs):
        return self.cache.clear(*args, **kwargs)

    @send_signal
    def has_key(self, *args, **kwargs):
        # Ignore flake8 rules for has_key since we need to support caches
        # that may be using has_key.
        return self.cache.has_key(*args, **kwargs)  # noqa

    @send_signal
    def incr(self, *args, **kwargs):
        return self.cache.incr(*args, **kwargs)

    @send_signal
    def decr(self, *args, **kwargs):
        return self.cache.decr(*args, **kwargs)

    @send_signal
    def get_many(self, *args, **kwargs):
        return self.cache.get_many(*args, **kwargs)

    @send_signal
    def set_many(self, *args, **kwargs):
        self.cache.set_many(*args, **kwargs)

    @send_signal
    def delete_many(self, *args, **kwargs):
        self.cache.delete_many(*args, **kwargs)

    @send_signal
    def incr_version(self, *args, **kwargs):
        return self.cache.incr_version(*args, **kwargs)

    @send_signal
    def decr_version(self, *args, **kwargs):
        return self.cache.decr_version(*args, **kwargs)


def get_cache(*args, **kwargs):
    return CacheStatTracker(original_get_cache(*args, **kwargs))


if CacheHandler is not None:
    class CacheHandlerPatch(CacheHandler):
        def __getitem__(self, alias):
            actual_cache = super(CacheHandlerPatch, self).__getitem__(alias)
            return CacheStatTracker(actual_cache)


def get_cache_handler():
    if CacheHandler is None:
        return None
    return CacheHandlerPatch()


# Must monkey patch the middleware's cache module as well in order to
# cover per-view level caching. This needs to be monkey patched outside
# of the enable_instrumentation method since the django's
# decorator_from_middleware_with_args will store the cache from core.caches
# when it wraps the view.
middleware_cache.get_cache = get_cache
middleware_cache.caches = get_cache_handler()


class CachePanel(Panel):
    """
    Panel that displays the cache statistics.
    """
    template = 'debug_toolbar/panels/cache.html'

    def __init__(self, *args, **kwargs):
        super(CachePanel, self).__init__(*args, **kwargs)
        self.total_time = 0
        self.hits = 0
        self.misses = 0
        self.calls = []
        self.counts = OrderedDict((
            ('add', 0),
            ('get', 0),
            ('set', 0),
            ('delete', 0),
            ('clear', 0),
            ('get_many', 0),
            ('set_many', 0),
            ('delete_many', 0),
            ('has_key', 0),
            ('incr', 0),
            ('decr', 0),
            ('incr_version', 0),
            ('decr_version', 0),
        ))
        cache_called.connect(self._store_call_info)

    def _store_call_info(self, sender, name=None, time_taken=0,
                         return_value=None, args=None, kwargs=None,
                         trace=None, template_info=None, backend=None, **kw):
        if name == 'get':
            if return_value is None:
                self.misses += 1
            else:
                self.hits += 1
        elif name == 'get_many':
            for key, value in return_value.items():
                if value is None:
                    self.misses += 1
                else:
                    self.hits += 1
        time_taken *= 1000

        self.total_time += time_taken
        self.counts[name] += 1
        self.calls.append({
            'time': time_taken,
            'name': name,
            'args': args,
            'kwargs': kwargs,
            'trace': render_stacktrace(trace),
            'template_info': template_info,
            'backend': backend
        })

    # Implement the Panel API

    nav_title = _("Cache")

    @property
    def nav_subtitle(self):
        cache_calls = len(self.calls)
        return ungettext("%(cache_calls)d call in %(time).2fms",
                         "%(cache_calls)d calls in %(time).2fms",
                         cache_calls) % {'cache_calls': cache_calls,
                                         'time': self.total_time}

    @property
    def title(self):
        count = len(getattr(settings, 'CACHES', ['default']))
        return ungettext("Cache calls from %(count)d backend",
                         "Cache calls from %(count)d backends",
                         count) % dict(count=count)

    def enable_instrumentation(self):
        cache.get_cache = get_cache
        if CacheHandler is None:
            cache.cache = CacheStatTracker(original_cache)
        else:
            if isinstance(middleware_cache.caches, CacheHandlerPatch):
                cache.caches = middleware_cache.caches
            else:
                cache.caches = get_cache_handler()

    def disable_instrumentation(self):
        if CacheHandler is None:
            cache.cache = original_cache
        else:
            cache.caches = original_caches
            # While it can be restored to the original, any views that were
            # wrapped with the cache_page decorator will continue to use a
            # monkey patched cache.
            middleware_cache.caches = original_caches
        cache.get_cache = original_get_cache

    def process_response(self, request, response):
        self.record_stats({
            'total_calls': len(self.calls),
            'calls': self.calls,
            'total_time': self.total_time,
            'hits': self.hits,
            'misses': self.misses,
            'counts': self.counts,
        })
