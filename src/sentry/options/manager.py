"""
sentry.options.manager
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
from collections import namedtuple

from django.conf import settings
from django.utils import timezone

from sentry.cache import default_cache
from sentry.db.models.query import create_or_update
from sentry.models import Option
from sentry.utils.hashlib import md5


CACHE_FETCH_ERR = 'Unable to fetch option cache for %s'
CACHE_UPDATE_ERR = 'Unable to update option cache for %s'

Key = namedtuple('Key', ('default', 'type', 'flags', 'cache_key'))


class UnknownOption(KeyError):
    pass


class OptionsManager(object):
    """
    A backend for storing generic configuration within Sentry.

    Legacy Django configuration should be deprioritized in favor of more dynamic
    configuration through the options backend, which is backed by a cache and a
    database.

    You **always** will receive a response to ``get()``. The response is eventually
    consistent with the accuracy window depending on the queue workload and you
    should treat all values as temporary as given a dual connection failure on both
    the cache and the database the system will fall back to hardcoded defaults.

    Overall this is a very loose consistency model which is designed to give simple
    dynamic configuration with maximum uptime, where defaults are always taken from
    constants in the global configuration.
    """
    cache = default_cache
    logger = logging.getLogger('sentry')
    registry = {}

    # we generally want to always persist
    ttl = None

    FLAG_DEFAULT = 0b000
    FLAG_IMMUTABLE = 0b001

    def __init__(self, cache=None, ttl=None, logger=None):
        if cache is not None:
            self.cache = default_cache

        if ttl is not None:
            self.ttl = ttl

        if logger is not None:
            self.logger = logger

    def _make_cache_key(self, key):
        return 'o:{0}'.format(md5(key).hexdigest())

    def set(self, key, value):
        """
        Set the value for an option. If the cache is unavailable the action will
        still suceeed.

        >>> from sentry import options
        >>> options.set('option', 'value')
        """
        try:
            opt = self.registry[key]
        except KeyError:
            raise UnknownOption(key)

        if not isinstance(value, opt.type):
            raise TypeError('got %r, expected %r' % (type(value), opt.type))

        # Enforce immutability on key
        assert not (opt.flags & self.FLAG_IMMUTABLE), '%r cannot be changed' % key

        create_or_update(
            model=Option,
            key=key,
            values={
                'value': value,
                'last_updated': timezone.now(),
            }
        )

        try:
            self.update_cached_value(opt.cache_key, value)
            return True
        except Exception:
            self.logger.warn(CACHE_UPDATE_ERR, key, exc_info=True)
            return False

    def get(self, key):
        """
        Get the value of an option prioritizing the cache, then the database,
        and finally the local configuration.

        If no value is present for the key, the default Option value is returned.

        >>> from sentry import options
        >>> options.get('option')
        """
        try:
            opt = self.registry[key]
        except KeyError:
            raise UnknownOption(key)

        try:
            result = self.cache.get(opt.cache_key)
        except Exception:
            self.logger.warn(CACHE_FETCH_ERR, key, exc_info=True)
            result = None
            cache_success = False
        else:
            cache_success = True

        if result is None:
            try:
                result = Option.objects.get(key=key).value
            except Option.DoesNotExist:
                result = opt.default
            except Exception as e:
                self.logger.exception(unicode(e))
                result = None

            # we only attempt to populate the cache if we were previously
            # able to successfully talk to the backend
            if result is not None and cache_success:
                try:
                    self.update_cached_value(opt.cache_key, result)
                except Exception:
                    self.logger.warn(CACHE_UPDATE_ERR, key, exc_info=True)

        if result is not None:
            return result

        try:
            # default to the hardcoded local configuration for this key
            return settings.SENTRY_OPTIONS[key]
        except KeyError:
            return opt.default

    def delete(self, key):
        """
        Permanently remove the value of an option.

        This will also clear the value within the cache, which means a following
        get() will result in a miss.

        >>> from sentry import options
        >>> options.delete('option')
        """
        try:
            opt = self.registry[key]
        except KeyError:
            raise UnknownOption(key)

        Option.objects.filter(key=key).delete()

        try:
            self.cache.delete(opt.cache_key)
            return True
        except Exception:
            self.logger.warn(CACHE_UPDATE_ERR, key, exc_info=True)
            return False

    def update_cached_value(self, cache_key, value):
        self.cache.set(cache_key, value, self.ttl)

    def register(self, key, default='', type=basestring, flags=FLAG_DEFAULT):
        assert key not in self.registry, 'Option already registered: %r' % key
        self.registry[key] = Key(default, type, flags, self._make_cache_key(key))

    def unregister(self, key):
        try:
            del self.registry[key]
        except KeyError:
            # Raise here or nah?
            raise UnknownOption(key)
