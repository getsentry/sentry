"""
sentry.options.manager
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
from collections import namedtuple
from types import NoneType

from django.conf import settings
from django.utils import timezone

from sentry.cache import default_cache
from sentry.db.models.query import create_or_update
from sentry.models import Option
from sentry.utils.hashlib import md5


CACHE_FETCH_ERR = 'Unable to fetch option cache for %s'
CACHE_UPDATE_ERR = 'Unable to update option cache for %s'

Key = namedtuple('Key', ('name', 'default', 'type', 'flags', 'cache_key'))
# Prevent outselves from clobbering the builtin
_type = type


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
    registry = None

    # we generally want to always persist
    ttl = None

    FLAG_DEFAULT = 0b000
    # Value can't be changed at runtime
    FLAG_IMMUTABLE = 0b001
    # Don't check/set in the datastore. Option only exists from file.
    FLAG_NOSTORE = 0b010
    # Values that should only exist in datastore, and shouldn't exist in
    # config files.
    FLAG_STOREONLY = 0b100

    def __init__(self, cache=None, ttl=None, logger=None):
        if cache is not None:
            self.cache = default_cache

        if ttl is not None:
            self.ttl = ttl

        if logger is not None:
            self.logger = logger

        self.registry = {}

    def _make_cache_key(self, key):
        return 'o:{0}'.format(md5(key).hexdigest())

    def set(self, key, value):
        """
        Set the value for an option. If the cache is unavailable the action will
        still suceeed.

        >>> from sentry import options
        >>> options.set('option', 'value')
        """
        opt = self.lookup_key(key)

        # If an option isn't able to exist in the store, we can't set it at runtime
        assert not (opt.flags & self.FLAG_NOSTORE), '%r cannot be changed at runtime' % key
        # Enforce immutability on key
        assert not (opt.flags & self.FLAG_IMMUTABLE), '%r cannot be changed at runtime' % key

        if not isinstance(value, opt.type):
            raise TypeError('got %r, expected %r' % (_type(value), opt.type))

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

    def lookup_key(self, key):
        try:
            return self.registry[key]
        except KeyError:
            # HACK: Historically, Options were used for random adhoc things.
            # Fortunately, they all share the same prefix, 'sentry:', so
            # we special case them here and construct a faux key until we migrate.
            if key[:7] == 'sentry:':
                self.logger.info('Using legacy key: %s', key, exc_info=True)
                # History shows, there was an expectation of no types, and empty string
                # as the default response value
                return Key(key, '', object, self.FLAG_DEFAULT, self._make_cache_key(key))
            raise UnknownOption(key)

    def get(self, key):
        """
        Get the value of an option prioritizing the cache, then the database,
        and finally the local configuration.

        If no value is present for the key, the default Option value is returned.

        >>> from sentry import options
        >>> options.get('option')
        """
        opt = self.lookup_key(key)

        if not (opt.flags & self.FLAG_NOSTORE):
            result = self.fetch_from_store(opt)
            if result is not None:
                return result

        # Some values we don't want to allow them to be configured through
        # config files and should only exist in the datastore
        if opt.flags & self.FLAG_STOREONLY:
            return opt.default

        try:
            # default to the hardcoded local configuration for this key
            return settings.SENTRY_OPTIONS[key]
        except KeyError:
            return opt.default

    def fetch_from_store(self, opt):
        try:
            result = self.cache.get(opt.cache_key)
        except Exception:
            self.logger.warn(CACHE_FETCH_ERR, opt.name, exc_info=True)
            result = None

        if result is None:
            try:
                result = Option.objects.get(key=opt.name).value
            except Option.DoesNotExist:
                result = None
            except Exception as e:
                self.logger.exception(unicode(e))
                result = None
            else:
                # we only attempt to populate the cache if we were previously
                # able to successfully talk to the backend
                try:
                    self.update_cached_value(opt.cache_key, result)
                except Exception:
                    self.logger.warn(CACHE_UPDATE_ERR, opt.name, exc_info=True)

        return result

    def delete(self, key):
        """
        Permanently remove the value of an option.

        This will also clear the value within the cache, which means a following
        get() will result in a miss.

        >>> from sentry import options
        >>> options.delete('option')
        """
        opt = self.lookup_key(key)

        # If an option isn't able to exist in the store, we can't set it at runtime
        assert not (opt.flags & self.FLAG_NOSTORE), '%r cannot be changed at runtime' % key
        # Enforce immutability on key
        assert not (opt.flags & self.FLAG_IMMUTABLE), '%r cannot be changed at runtime' % key

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
        # We disallow None as a value for options since this is ambiguous and doesn't
        # really make sense as config options. There should be a sensible default
        # value instead that matches the type expected, rather than relying on None.
        if type is NoneType:
            raise TypeError('Options must not be NoneType')
        if not isinstance(default, type):
            raise TypeError('got %r, expected %r' % (_type(default), type))
        self.registry[key] = Key(key, default, type, flags, self._make_cache_key(key))

    def unregister(self, key):
        try:
            del self.registry[key]
        except KeyError:
            # Raise here or nah?
            raise UnknownOption(key)
