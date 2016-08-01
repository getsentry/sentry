"""
sentry.options.manager
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import six
import sys
import logging

from django.conf import settings

from sentry.utils.types import type_from_value, Any

# Prevent outselves from clobbering the builtin
_type = type

logger = logging.getLogger('sentry')

NoneType = type(None)


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
# If the value is defined on disk, use that and don't attempt to fetch from db.
# This also make the value immutible to changes from web UI.
FLAG_PRIORITIZE_DISK = 1 << 5
# If the value is allowed to be empty to be considered valid
FLAG_ALLOW_EMPTY = 1 << 6

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

    def set(self, key, value, coerce=True):
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
        # Enforce immutability if value is already set on disk
        assert not (opt.flags & FLAG_PRIORITIZE_DISK and settings.SENTRY_OPTIONS.get(key)), '%r cannot be changed at runtime because it is configured on disk' % key

        if coerce:
            value = opt.type(value)
        elif not opt.type.test(value):
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
                return self.store.make_key(key, lambda: '', Any, DEFAULT_FLAGS, 0, 0)
            raise UnknownOption(key)

    def isset(self, key):
        """
        Check if a key has been set to a value and not inheriting from its default.
        """
        opt = self.lookup_key(key)

        if not (opt.flags & FLAG_NOSTORE):
            result = self.store.get(opt, silent=True)
            if result is not None:
                return True

        return key in settings.SENTRY_OPTIONS

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

        # First check if the option should exist on disk, and if it actually
        # has a value set, let's use that one instead without even attempting
        # to fetch from network storage.
        if opt.flags & FLAG_PRIORITIZE_DISK:
            try:
                result = settings.SENTRY_OPTIONS[key]
            except KeyError:
                pass
            else:
                if result:
                    return result

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
            return opt.default()

        try:
            # default to the hardcoded local configuration for this key
            return settings.SENTRY_OPTIONS[key]
        except KeyError:
            try:
                return settings.SENTRY_DEFAULT_OPTIONS[key]
            except KeyError:
                return opt.default()

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

    def register(self, key, default=None, type=None, flags=DEFAULT_FLAGS,
                 ttl=DEFAULT_KEY_TTL, grace=DEFAULT_KEY_GRACE):
        assert key not in self.registry, 'Option already registered: %r' % key

        # If our default is a callable, execute it to
        # see what value is returns, so we can use that to derive the type
        if not callable(default):
            default_value = default
            default = lambda: default_value
        else:
            default_value = default()

        # Guess type based on the default value
        if type is None:
            # the default value would be equivilent to '' if no type / default
            # is specified and we assume six.text_type for safety
            if default_value is None:
                default_value = u''
                default = lambda: default_value
            type = type_from_value(default_value)

        # We disallow None as a value for options since this is ambiguous and doesn't
        # really make sense as config options. There should be a sensible default
        # value instead that matches the type expected, rather than relying on None.
        if type is NoneType:
            raise TypeError('Options must not be None')

        # Make sure the type is correct at registration time
        if default_value is not None and not type.test(default_value):
            raise TypeError('got %r, expected %r' % (_type(default), type))

        # If we don't have a default, but we have a type, pull the default
        # value from the type
        if default_value is None:
            default = type
            default_value = default()

        # Boolean values need to be set to ALLOW_EMPTY becaues otherwise, "False"
        # would be treated as a not valid value
        if default_value is True or default_value is False:
            flags |= FLAG_ALLOW_EMPTY

        settings.SENTRY_DEFAULT_OPTIONS[key] = default_value

        self.registry[key] = self.store.make_key(key, default, type, flags, ttl, grace)

    def unregister(self, key):
        try:
            del self.registry[key]
        except KeyError:
            # Raise here or nah?
            raise UnknownOption(key)

    def validate(self, options, warn=False):
        for k, v in six.iteritems(options):
            try:
                self.validate_option(k, v)
            except UnknownOption as e:
                if not warn:
                    raise
                sys.stderr.write('* Unknown config option found: %s\n' % e)

    def validate_option(self, key, value):
        opt = self.lookup_key(key)
        assert not (opt.flags & FLAG_STOREONLY), '%r is not allowed to be loaded from config' % key
        if not opt.type.test(value):
            raise TypeError('%r: got %r, expected %r' % (key, _type(value), opt.type))

    def all(self):
        """
        Return an interator for all keys in the registry.
        """
        return six.itervalues(self.registry)

    def filter(self, flag=None):
        """
        Return an iterator that's filtered by which flags are set on a key.
        """
        if flag is None:
            return self.all()
        if flag is DEFAULT_FLAGS:
            return (k for k in self.all() if k.flags is DEFAULT_FLAGS)
        return (k for k in self.all() if k.flags & flag)
