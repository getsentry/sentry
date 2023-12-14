import logging
import sys
from enum import Enum
from typing import Optional, Sequence, Tuple

from django.conf import settings

from sentry.utils.hashlib import md5_text
from sentry.utils.types import Any, type_from_value

# Prevent ourselves from clobbering the builtin
_type = type

logger = logging.getLogger("sentry")

NoneType = type(None)


class UpdateChannel(Enum):
    """
    There are multiple channels to update an option. This enum is used
    to identify the channel that is trying to update an option or that
    last updated the option.
    """

    # Legacy changes made by code that is not aware of this enum.
    # They should disappear over time.
    UNKNOWN = "unknown"
    # Any change made directly by the application through the `options`
    # module not included in the categories below.
    APPLICATION = "application"
    # Any change made by the sentry Admin UI.
    ADMIN = "admin"
    # Any change made by the Options Automator.
    AUTOMATOR = "automator"
    # Any change made through the sentry CLI with the exceptions of
    # killswitches.
    CLI = "cli"
    # Any change made through the killswitches CLI. This CLI is different
    # from the CLI above.
    KILLSWITCH = "killswitch"

    @classmethod
    def choices(cls) -> Sequence[Tuple[str, str]]:
        return [(i.name, i.value) for i in cls]


class NotWritableReason(Enum):
    """
    Represent the reason that prevents us from attempting an update
    of an option on a specific UpdateChannel.
    """

    # The option is registered with the FLAG_PRIORITIZE_DISK flag and it is
    # also stored on disk as part of sentry settings. Nobody can update this.
    OPTION_ON_DISK = "option_on_disk"
    # The option definition is read only. It cannot be updated by anybody.
    READONLY = "readonly"
    # The option cannot be updated by a specific channel because it is missing
    # the required flag.
    CHANNEL_NOT_ALLOWED = "channel_not_allowed"
    # The option could be updated but it drifted and the channel we are trying
    # to update with cannot overwrite.
    DRIFTED = "drifted"


# In case there is drift between the value on the external source the
# Options Automator maintains, the Automator is not allowed to overwrite
# the drift in several cases. This map contains the forbidden transitions
# of the last_updated_by column on the storage.
FORBIDDEN_TRANSITIONS = {
    UpdateChannel.UNKNOWN: {UpdateChannel.AUTOMATOR},
    UpdateChannel.APPLICATION: {UpdateChannel.AUTOMATOR},
    UpdateChannel.CLI: {UpdateChannel.AUTOMATOR},
    UpdateChannel.KILLSWITCH: {UpdateChannel.AUTOMATOR},
    UpdateChannel.ADMIN: {UpdateChannel.AUTOMATOR},
}


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
# This also make the value immutable to changes from web UI.
FLAG_PRIORITIZE_DISK = 1 << 5
# If the value is allowed to be empty to be considered valid
FLAG_ALLOW_EMPTY = 1 << 6
# Values that are credentials should not show up in web UI.
FLAG_CREDENTIAL = 1 << 7
# Values that are meant to be modified live, eg. for rollout etc.
FLAG_ADMIN_MODIFIABLE = 1 << 8
# Values that are rates, between [0,1]
FLAG_RATE = 1 << 9
# Values that are bools
FLAG_BOOL = 1 << 10
# Value can be dynamically updated by automator
FLAG_AUTOMATOR_MODIFIABLE = 1 << 11
# Values that are scalar numeric integer values
FLAG_SCALAR = 1 << 12

FLAG_MODIFIABLE_RATE = FLAG_ADMIN_MODIFIABLE | FLAG_RATE
FLAG_MODIFIABLE_BOOL = FLAG_ADMIN_MODIFIABLE | FLAG_BOOL
FLAG_MODIFIABLE_SCALAR = FLAG_ADMIN_MODIFIABLE | FLAG_SCALAR

# These flags combinations prevent the `register` method from succeeding.
INVALID_COMBINATIONS = {
    FLAG_ADMIN_MODIFIABLE | FLAG_NOSTORE,
    FLAG_ADMIN_MODIFIABLE | FLAG_IMMUTABLE,
    FLAG_ADMIN_MODIFIABLE | FLAG_CREDENTIAL,
    FLAG_AUTOMATOR_MODIFIABLE | FLAG_NOSTORE,
    FLAG_AUTOMATOR_MODIFIABLE | FLAG_IMMUTABLE,
    FLAG_AUTOMATOR_MODIFIABLE | FLAG_CREDENTIAL,
    # A flag may only be one of a bool, rate, or scalar.
    FLAG_RATE | FLAG_BOOL,
    FLAG_BOOL | FLAG_SCALAR,
    FLAG_SCALAR | FLAG_RATE,
    # An option being required does not strictly mean that it cannot be updated by
    # the Automator. The issue is on why they exist. Most of them are set by the
    # application itself during the first initialization.
    # That flow cannot, like anything else in the application, cannot update the
    # configMap
    FLAG_AUTOMATOR_MODIFIABLE | FLAG_REQUIRED,
}

# How long will a cache key exist in local memory before being evicted
DEFAULT_KEY_TTL = 10
# How long will a cache key exist in local memory *after ttl* while the backing store is erroring
DEFAULT_KEY_GRACE = 60

# Some update channel can only update options that have a specific flag.
# This dictionary contains the mapping between update channels and required
# flag.
# If a channel is not in the dictionary it does not have restrictions.
WRITE_REQUIRED_FLAGS = {
    UpdateChannel.ADMIN: FLAG_ADMIN_MODIFIABLE,
    UpdateChannel.AUTOMATOR: FLAG_AUTOMATOR_MODIFIABLE,
}


def _make_cache_key(key):
    return "o:%s" % md5_text(key).hexdigest()


class OptionsManager:
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

    def set(self, key: str, value, coerce=True, channel: UpdateChannel = UpdateChannel.UNKNOWN):
        """
        Set the value for an option. If the cache is unavailable the action will
        still succeed.

        It also checks for drift and fails if the option value has drifted and the
        `channel` is not authorized to overwrite.

        >>> from sentry import options
        >>> options.set('option', 'value')
        """
        not_writable_reason = self.can_update(key, value, channel)

        # If an option isn't able to exist in the store or is immutable, we can't set it at runtime
        assert not_writable_reason not in [
            NotWritableReason.READONLY,
            NotWritableReason.CHANNEL_NOT_ALLOWED,
        ], (
            "%r cannot be changed at runtime" % key
        )
        # Enforce immutability if value is already set on disk
        assert not_writable_reason != NotWritableReason.OPTION_ON_DISK, (
            "%r cannot be changed at runtime because it is configured on disk" % key
        )
        # Enforce that the option has not been changed by a different UpdateChannel
        # that we cannot overwrite.
        assert (
            not_writable_reason != NotWritableReason.DRIFTED
        ), f"Option {key} has drifted. Cannot overwrite"

        opt = self.lookup_key(key)
        if coerce:
            value = opt.type(value)
        elif not opt.type.test(value):
            raise TypeError(f"got {_type(value)!r}, expected {opt.type!r}")

        return self.store.set(opt, value, channel=channel)

    def lookup_key(self, key: str):
        try:
            return self.registry[key]
        except KeyError:
            # HACK: Historically, Options were used for random ad hoc things.
            # Fortunately, they all share the same prefix, 'sentry:', so
            # we special case them here and construct a faux key until we migrate.
            if key.startswith(("sentry:", "getsentry:")):
                logger.debug("Using legacy key: %s", key, exc_info=True)
                # History shows, there was an expectation of no types, and empty string
                # as the default response value
                return self.make_key(key, lambda: "", Any, DEFAULT_FLAGS, 0, 0, None)
            raise UnknownOption(key)

    def make_key(
        self,
        name: str,
        default,
        type,
        flags: int,
        ttl: int,
        grace: int,
        grouping_info,
    ):
        from sentry.options.store import Key

        return Key(
            name,
            default,
            type,
            flags,
            int(ttl),
            int(grace),
            _make_cache_key(name),
            grouping_info,
        )

    def isset(self, key: str) -> bool:
        """
        Check if a key has been set to a value and not inheriting from its default.
        """
        opt = self.lookup_key(key)

        if not opt.has_any_flag({FLAG_NOSTORE}):
            result = self.store.get(opt, silent=True)
            if result is not None:
                return True

        return key in settings.SENTRY_OPTIONS

    def get(self, key: str, silent=False):
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
        if opt.has_any_flag({FLAG_PRIORITIZE_DISK}):
            try:
                result = settings.SENTRY_OPTIONS[key]
            except KeyError:
                pass
            else:
                if result is not None:
                    return result

        if not (opt.flags & FLAG_NOSTORE):
            result = self.store.get(opt, silent=silent)
            if result is not None:
                # HACK(mattrobenolt): SENTRY_URL_PREFIX must be kept in sync
                # when reading values from the database. This should
                # be replaced by a signal.
                if key == "system.url-prefix":
                    settings.SENTRY_URL_PREFIX = result
                return result

        # Some values we don't want to allow them to be configured through
        # config files and should only exist in the datastore
        if opt.has_any_flag({FLAG_STOREONLY}):
            optval = opt.default()
        else:
            try:
                # default to the hardcoded local configuration for this key
                optval = settings.SENTRY_OPTIONS[key]
            except KeyError:
                try:
                    optval = settings.SENTRY_DEFAULT_OPTIONS[key]
                except KeyError:
                    optval = opt.default()
        # options already present in store are cached by store
        # caching here to avoid database queries
        self.store.set_cache(opt, optval)
        return optval

    def delete(self, key: str):
        """
        Permanently remove the value of an option.

        This will also clear the value within the store, which means a following
        get() will result in a miss.

        >>> from sentry import options
        >>> options.delete('option')
        """
        opt = self.lookup_key(key)

        # If an option isn't able to exist in the store, we can't set it at runtime
        assert not (opt.flags & FLAG_NOSTORE), "%r cannot be changed at runtime" % key
        # Enforce immutability on key
        assert not (opt.flags & FLAG_IMMUTABLE), "%r cannot be changed at runtime" % key

        return self.store.delete(opt)

    def register(
        self,
        key: str,
        default=None,
        type=None,
        flags: int = DEFAULT_FLAGS,
        ttl: int = DEFAULT_KEY_TTL,
        grace: int = DEFAULT_KEY_GRACE,
        # Optional info about how to group options together in the _admin ui. Only applies to
        # options marked `FLAG_ADMIN_MODIFIABLE`
        grouping_info=None,
    ) -> None:
        assert key not in self.registry, "Option already registered: %r" % key

        if len(key) > 128:
            raise ValueError("Option key has max length of 128 characters")

        # Validate flags combination
        for invalid in INVALID_COMBINATIONS:
            # the flags field has all the flags of the invalid combination
            # activated.
            # Cannot simply check whether flags & invalid > 0 as all the flags
            # of the invalid combination must be active for this to not be
            # valid.
            if flags & invalid == invalid:
                raise ValueError(f"Invalid option flags combination: {invalid}")

        # If our default is a callable, execute it to
        # see what value is returns, so we can use that to derive the type
        if not callable(default):
            default_value = default

            def default():
                return default_value

        else:
            default_value = default()

        # Guess type based on the default value
        if type is None:
            # the default value would be equivalent to '' if no type / default
            # is specified and we assume str for safety
            if default_value is None:
                default_value = ""

                def default():
                    return default_value

            type = type_from_value(default_value)

        # We disallow None as a value for options since this is ambiguous and doesn't
        # really make sense as config options. There should be a sensible default
        # value instead that matches the type expected, rather than relying on None.
        if type is NoneType:
            raise TypeError("Options must not be None")

        # Make sure the type is correct at registration time
        if default_value is not None and not type.test(default_value):
            raise TypeError(f"got {_type(default)!r}, expected {type!r}")

        # If we don't have a default, but we have a type, pull the default
        # value from the type
        if default_value is None:
            default = type
            default_value = default()

        # Boolean values need to be set to ALLOW_EMPTY because otherwise, "False"
        # would be treated as a not valid value
        if default_value is True or default_value is False:
            flags |= FLAG_ALLOW_EMPTY

        settings.SENTRY_DEFAULT_OPTIONS[key] = default_value

        self.registry[key] = self.make_key(key, default, type, flags, ttl, grace, grouping_info)

    def unregister(self, key: str) -> None:
        try:
            del self.registry[key]
        except KeyError:
            # Raise here or nah?
            raise UnknownOption(key)

    def validate(self, options, warn=False):
        for k, v in options.items():
            try:
                self.validate_option(k, v)
            except UnknownOption as e:
                if not warn:
                    raise
                sys.stderr.write("* Unknown config option found: %s\n" % e)

    def validate_option(self, key: str, value):
        opt = self.lookup_key(key)
        assert not (opt.flags & FLAG_STOREONLY), "%r is not allowed to be loaded from config" % key
        if not opt.type.test(value):
            raise TypeError(f"{key!r}: got {_type(value)!r}, expected {opt.type!r}")

    def all(self):
        """
        Return an iterator for all keys in the registry.
        """
        return self.registry.values()

    def filter(self, flag: Optional[int] = None):
        """
        Return an iterator that's filtered by which flags are set on a key.
        """
        if flag is None:
            return self.all()
        if flag is DEFAULT_FLAGS:
            return (k for k in self.all() if k.flags is DEFAULT_FLAGS)
        return (k for k in self.all() if k.flags & flag)

    def get_last_update_channel(self, key: str) -> Optional[UpdateChannel]:
        """
        Checks how the given key was last changed
        (by automator, legacy, or CLI)
        """
        # TODO: Replace with a method that checks whether an update can
        # be applied evaluating all the possible drift cases.
        opt = self.lookup_key(key)
        return self.store.get_last_update_channel(opt)

    def can_update(self, key: str, value, channel: UpdateChannel) -> Optional[NotWritableReason]:
        """
        Return the reason the provided channel cannot update the option
        to the provided value or None if there is no reason and the update
        is allowed.
        """

        required_flag = WRITE_REQUIRED_FLAGS.get(channel)
        opt = self.lookup_key(key)
        if opt.has_any_flag({FLAG_NOSTORE, FLAG_IMMUTABLE}):
            return NotWritableReason.READONLY
        if opt.has_any_flag({FLAG_PRIORITIZE_DISK}) and settings.SENTRY_OPTIONS.get(key):
            # FLAG_PRIORITIZE_DISK does not prevent the option to be updated
            # in any circumstance. If the option is not on disk (which
            # means not in settings.SENTRY_OPTION), it can be updated.
            return NotWritableReason.OPTION_ON_DISK

        if required_flag and not opt.has_any_flag({required_flag}):
            return NotWritableReason.CHANNEL_NOT_ALLOWED

        if not self.isset(key):
            # If the option is not readonly and it is not stored in the
            # option store it means we are relying on default. So we can
            # update.
            return None

        stored_value = self.get(key)
        if stored_value == value:
            # In theory options could have any type so this equality may
            # not be correct.
            # In practice, this code is added to support the move towards
            # configMap backed options, which will be restricted to types
            # that allow for this equality: basic types, sets, list, maps.
            # So even if this equality fails, in the worst case scenario
            # we would not allow the update if there is a mismatch between
            # the channels.
            return None

        last_updater = self.get_last_update_channel(key)
        if last_updater is None:
            return None
        forbidden_states = FORBIDDEN_TRANSITIONS.get(last_updater)
        if forbidden_states and channel in forbidden_states:
            return NotWritableReason.DRIFTED

        return None
