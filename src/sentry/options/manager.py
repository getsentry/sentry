"""
sentry.options.manager
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
from itertools import ifilter
from types import NoneType
from django.conf import settings

# Prevent outselves from clobbering the builtin
_type = type
logger = logging.getLogger('sentry')


class UnknownOption(KeyError):
    pass


DEFAULT_FLAGS = 1 << 0
# Value can't be changed at runtime
FLAG_IMMUTABLE = 1 << 1
# Don't check/set in the datastore. Option only exists from file.
FLAG_NOSTORE = 1 << 2
# Values that should only exist in datastore, and shouldn't exist in
# config files.
FLAG_STOREONLY = 1 << 3
# Values that must be defined for setup to be considered complete
FLAG_REQUIRED = 1 << 4

# How long will a cache key exist in local memory before being evicted
DEFAULT_KEY_TTL = 10
# How long will a cache key exist in local memory *after ttl* while the backing store is erroring
DEFAULT_KEY_GRACE = 60


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

    def __init__(self, store):
        self.store = store
        self.registry = {}

    def set(self, key, value):
        """
        Set the value for an option. If the cache is unavailable the action will
        still suceeed.

        >>> from sentry import options
        >>> options.set('option', 'value')
        """
        opt = self.lookup_key(key)

        # If an option isn't able to exist in the store, we can't set it at runtime
        assert not (opt.flags & FLAG_NOSTORE), '%r cannot be changed at runtime' % key
        # Enforce immutability on key
        assert not (opt.flags & FLAG_IMMUTABLE), '%r cannot be changed at runtime' % key

        if not isinstance(value, opt.type):
            raise TypeError('got %r, expected %r' % (_type(value), opt.type))

        return self.store.set(opt, value)

    def lookup_key(self, key):
        try:
            return self.registry[key]
        except KeyError:
            # HACK: Historically, Options were used for random adhoc things.
            # Fortunately, they all share the same prefix, 'sentry:', so
            # we special case them here and construct a faux key until we migrate.
            if key.startswith(('sentry:', 'getsentry:')):
                logger.debug('Using legacy key: %s', key, exc_info=True)
                # History shows, there was an expectation of no types, and empty string
                # as the default response value
                return self.store.make_key(key, '', object, DEFAULT_FLAGS, 0, 0)
            raise UnknownOption(key)

    def get(self, key, silent=False):
        """
        Get the value of an option, falling back to the local configuration.

        If no value is present for the key, the default Option value is returned.

        >>> from sentry import options
        >>> options.get('option')
        """
        # TODO(mattrobenolt): Perform validation on key returned for type Justin Case
        # values change. This case is unlikely, but good to cover our bases.
        opt = self.lookup_key(key)

        if not (opt.flags & FLAG_NOSTORE):
            result = self.store.get(opt, silent=silent)
            if result is not None:
                # HACK(mattrobenolt): SENTRY_URL_PREFIX must be kept in sync
                # when reading values from the database. This should
                # be replaced by a signal.
                if key == 'system.url-prefix':
                    settings.SENTRY_URL_PREFIX = result
                return result

        # Some values we don't want to allow them to be configured through
        # config files and should only exist in the datastore
        if opt.flags & FLAG_STOREONLY:
            return opt.default

        try:
            # default to the hardcoded local configuration for this key
            return settings.SENTRY_OPTIONS[key]
        except KeyError:
            return opt.default

    def delete(self, key):
        """
        Permanently remove the value of an option.

        This will also clear the value within the store, which means a following
        get() will result in a miss.

        >>> from sentry import options
        >>> options.delete('option')
        """
        opt = self.lookup_key(key)

        # If an option isn't able to exist in the store, we can't set it at runtime
        assert not (opt.flags & FLAG_NOSTORE), '%r cannot be changed at runtime' % key
        # Enforce immutability on key
        assert not (opt.flags & FLAG_IMMUTABLE), '%r cannot be changed at runtime' % key

        return self.store.delete(opt)

    def register(self, key, default='', type=None, flags=DEFAULT_FLAGS,
                 ttl=DEFAULT_KEY_TTL, grace=DEFAULT_KEY_GRACE):
        assert key not in self.registry, 'Option already registered: %r' % key
        # Guess type based on the default value
        if type is None:
            if isinstance(default, basestring):
                type = basestring
            else:
                type = _type(default)
        # We disallow None as a value for options since this is ambiguous and doesn't
        # really make sense as config options. There should be a sensible default
        # value instead that matches the type expected, rather than relying on None.
        if type is NoneType:
            raise TypeError('Options must not be NoneType')
        if not isinstance(default, type):
            raise TypeError('got %r, expected %r' % (_type(default), type))
        self.registry[key] = self.store.make_key(key, default, type, flags, ttl, grace)

    def unregister(self, key):
        try:
            del self.registry[key]
        except KeyError:
            # Raise here or nah?
            raise UnknownOption(key)

    def validate(self, options):
        for k, v in options.iteritems():
            self.validate_option(k, v)

    def validate_option(self, key, value):
        opt = self.lookup_key(key)
        assert not (opt.flags & FLAG_STOREONLY), '%r is not allowed to be loaded from config' % key
        if not isinstance(value, opt.type):
            raise TypeError('%r: got %r, expected %r' % (key, _type(value), opt.type))

    def all(self):
        """
        Return an interator for all keys in the registry.
        """
        return self.registry.itervalues()

    def filter(self, flag=None):
        """
        Return an iterator that's filtered by which flags are set on a key.
        """
        if flag is None:
            return self.all()
        if flag is DEFAULT_FLAGS:
            return ifilter(lambda k: k.flags is DEFAULT_FLAGS, self.all())
        return ifilter(lambda k: k.flags & flag, self.all())
