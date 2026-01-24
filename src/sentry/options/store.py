from __future__ import annotations

import dataclasses
import logging
from collections.abc import Sequence
from random import random
from time import time
from typing import Any

from django.conf import settings
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from sentry_sdk.integrations.logging import ignore_logger

from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.options.manager import UpdateChannel
from sentry.utils.types import Type

CACHE_FETCH_ERR = "Unable to fetch option cache for %s"
CACHE_UPDATE_ERR = "Unable to update option cache for %s"

OPTIONS_LOGGER_NAME = "sentry.options_store"

logger = logging.getLogger(OPTIONS_LOGGER_NAME)
# Our SDK logging integration will create a circular dependency due to its
# reliance on options, so we need to ignore it.
ignore_logger(OPTIONS_LOGGER_NAME)


@dataclasses.dataclass
class GroupingInfo:
    # Name of the group of options to include this option in
    name: str
    # Order of the option within the group
    order: int


@dataclasses.dataclass(frozen=True)
class Key:
    name: str
    default: Any
    type: Type[Any]
    flags: int
    ttl: int
    grace: int
    cache_key: str
    grouping_info: GroupingInfo | None

    def has_any_flag(self, flags: set[int]) -> bool:
        """
        Returns true if the option is registered with at least one
        of the flags passed as argument.
        """
        assert flags, "Flags must be provided to check the option."
        for f in flags:
            if self.flags & f:
                return True

        return False


def _make_cache_value(key, value):
    now = int(time())
    return (value, now + key.ttl, now + key.ttl + key.grace)


LOGGING_SAMPLE_RATE = 0.0001


class OptionsStore:
    """
    Abstraction for the Option storage logic that should be driven
    by the OptionsManager.

    OptionsStore is gooey and raw. It provides no protection over
    what goes into the store. It only knows that it's reading/writing
    to the right place. If using the OptionsStore directly, it's your
    job to do validation of the data. You should probably go through
    OptionsManager instead, unless you need raw access to something.
    """

    def __init__(self, cache=None, ttl=None):
        self.cache = cache
        self.ttl = ttl
        self.flush_local_cache()

    @property
    def model(self):
        return self.model_cls()

    @classmethod
    def model_cls(cls):
        from sentry.models.options import ControlOption, Option
        from sentry.silo.base import SiloMode

        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            return ControlOption
        return Option

    def get(self, key, silent=False):
        """
        Fetches a value from the options store.
        """
        result = self.get_cache(key, silent=silent)
        if result is not None:
            return result

        should_log = random() < LOGGING_SAMPLE_RATE
        if should_log:
            # Log some percentage of our cache misses for option retrieval to
            # help triage excessive queries against the store.
            logger.info(
                "sentry_options_store.cache_miss",
                extra={"key": key.name, "cache_configured": self.cache is not None},
            )

        result = self.get_store(key, silent=silent)
        if result is not None:
            return result

        # As a last ditch effort, let's hope we have a key
        # in local cache that's possibly stale
        return self.get_local_cache(key, force_grace=True)

    def get_cache(self, key, silent=False):
        """
        First check against our local in-process cache, falling
        back to the network cache.
        """
        assert (
            self.cache is not None
        ), f"Option '{key.name}' requested before cache initialization, which could result in excessive store queries"

        value = self.get_local_cache(key)
        if value is not None:
            return value

        if self.cache is None:
            return None

        cache_key = key.cache_key
        try:
            value = self.cache.get(cache_key)
        except Exception:
            if not silent:
                logger.warning(CACHE_FETCH_ERR, key.name, extra={"key": key.name}, exc_info=True)
            value = None

        if value is not None and key.ttl > 0:
            self._local_cache[cache_key] = _make_cache_value(key, value)

        return value

    def get_local_cache(self, key, force_grace=False):
        """
        Attempt to fetch a key out of the local cache.

        If the key exists, but is beyond expiration, we only
        return it if grace=True. This forces the key to be returned
        in a disaster scenario as long as we're still holding onto it.
        This allows the OptionStore to pave over potential network hiccups
        by returning a stale value.
        """
        try:
            value, expires, grace = self._local_cache[key.cache_key]
        except KeyError:
            return None

        now = int(time())

        # Key is within normal expiry window, so just return it
        if now < expires:
            return value

        # If we're able to accept within grace window, return it
        if force_grace and now < grace:
            return value

        # Let's clean up values if we're beyond grace.
        if now > grace:
            try:
                del self._local_cache[key.cache_key]
            except KeyError:
                # This could only exist in a race condition
                # where another thread has already deleted this key,
                # but we'll guard ourselves against it Justin Case.
                # In this case, it's also possible that another thread
                # has updated the value at this key, causing us to evict
                # it prematurely. This isn't ideal, but not terrible
                # since I don't want to introduce locking to prevent this.
                # Even if it did happen, the consequence is just another
                # network hop.
                pass

        # If we're outside the grace window, even if we ask for it
        # in grace, too bad. The value is considered bad.
        return None

    def get_store(self, key, silent=False):
        """
        Attempt to fetch value from the database. If successful,
        also set it back in the cache.

        Returns None in both cases, if the key doesn't actually exist,
        or if we errored fetching it.

        NOTE: This behavior should probably be improved to differentiate
        between a miss vs error, but not worth it now since the value
        is limited at the moment.
        """
        try:
            # NOTE: To greatly reduce test bugs due to cache leakage, we don't enforce cross db constraints
            # because in practice the option query is consistent with the process level silo mode.
            # If you do change the way the option class model is picked, keep in mind it may not be deeply
            # tested due to the core assumption it should be stable per process in practice.
            with in_test_hide_transaction_boundary():
                value = self.model.objects.get(key=key.name).value
        except (self.model.DoesNotExist, ProgrammingError, OperationalError):
            value = None
        except Exception:
            if settings.SENTRY_OPTIONS_COMPLAIN_ON_ERRORS:
                raise
            elif not silent:
                logger.exception("option.failed-lookup", extra={"key": key.name})
            value = None
        else:
            # we only attempt to populate the cache if we were previously
            # able to successfully talk to the backend
            # NOTE: There is definitely a race condition here between updating
            # the store and the cache
            try:
                self.set_cache(key, value)
            except Exception:
                if not silent:
                    logger.warning(
                        CACHE_UPDATE_ERR, key.name, extra={"key": key.name}, exc_info=True
                    )
        return value

    def get_many_local_cache(
        self, keys: Sequence[Key], force_grace: bool = False
    ) -> dict[Key, Any]:
        """
        Attempt to fetch multiple keys from the local in-process cache.

        Similar to get_local_cache but operates on multiple keys at once.
        Only returns keys that are found and not expired.
        """
        results = {}
        now = int(time())

        for key in keys:
            try:
                value, expires, grace = self._local_cache[key.cache_key]
            except KeyError:
                continue

            # Key is within normal expiry window
            if now < expires:
                results[key] = value
                continue

            # If we're able to accept within grace window, return it
            if force_grace and now < grace:
                results[key] = value
                continue

            # If we're outside the grace window, don't return the value
            # Clean up expired values
            if now > grace:
                try:
                    del self._local_cache[key.cache_key]
                except KeyError:
                    # Race condition - another thread deleted it
                    pass

        return results

    def get_many_cache(self, keys: Sequence[Key], silent: bool = False) -> dict[Key, Any]:
        """
        Fetch multiple keys from cache (local → Redis).
        Returns dict of {Key: value} for found keys only.

        This is the batch equivalent of get_cache().
        """
        # First check local cache for all keys
        results = self.get_many_local_cache(keys)
        found_keys = set(results.keys())

        # Find keys not in local cache
        remaining_keys = [k for k in keys if k not in found_keys]

        if not remaining_keys or self.cache is None:
            return results

        # Batch fetch from Redis using Django cache's get_many
        cache_keys_to_key = {k.cache_key: k for k in remaining_keys}

        try:
            cache_results = self.cache.get_many(cache_keys_to_key.keys())

            for cache_key, value in cache_results.items():
                if value is not None:
                    key = cache_keys_to_key[cache_key]
                    results[key] = value

                    # Populate local cache for future requests
                    if key.ttl > 0:
                        self._local_cache[cache_key] = _make_cache_value(key, value)

        except Exception:
            if not silent:
                key_names = ", ".join(k.name for k in remaining_keys)
                logger.warning(
                    CACHE_FETCH_ERR,
                    key_names,
                    extra={"keys": [k.name for k in remaining_keys]},
                    exc_info=True,
                )

        return results

    def get_many(self, keys: Sequence[Key], silent: bool = False) -> dict[Key, Any]:
        """
        Fetch multiple option values with cache → database fallthrough.

        This is the batch equivalent of get(). It follows the same fallthrough pattern:
        1. Check local cache
        2. Check Redis cache
        3. Check database
        4. Return stale local cache as last resort

        Returns dict of {Key: value} for all keys that were found in any tier.
        Keys not found anywhere will not be in the returned dict.
        """
        # Try cache first (local + Redis)
        results = self.get_many_cache(keys, silent=silent)
        found_keys = set(results.keys())

        # Find keys not in cache
        remaining_keys = [k for k in keys if k not in found_keys]

        if not remaining_keys:
            return results

        should_log = random() < LOGGING_SAMPLE_RATE
        if should_log:
            logger.info(
                "sentry_options_store.cache_miss_batch",
                extra={
                    "keys": [k.name for k in remaining_keys],
                    "count": len(remaining_keys),
                    "cache_configured": self.cache is not None,
                },
            )

        # Batch database lookup for remaining keys
        try:
            db_key_names = {k.name: k for k in remaining_keys}

            # Use filter with IN query to fetch multiple keys at once
            with in_test_hide_transaction_boundary():
                db_results = self.model.objects.filter(key__in=db_key_names.keys()).values_list(
                    "key", "value"
                )

            for key_name, value in db_results:
                key = db_key_names[key_name]
                results[key] = value

                # Populate cache for future requests
                try:
                    self.set_cache(key, value)
                except Exception:
                    if not silent:
                        logger.warning(
                            CACHE_UPDATE_ERR,
                            key.name,
                            extra={"key": key.name},
                            exc_info=True,
                        )

        except (ProgrammingError, OperationalError):
            # Database errors - skip database results
            pass
        except Exception:
            if settings.SENTRY_OPTIONS_COMPLAIN_ON_ERRORS:
                raise
            elif not silent:
                logger.exception(
                    "option.failed-lookup-batch",
                    extra={"keys": [k.name for k in remaining_keys]},
                )

        # As a last ditch effort for any remaining keys, check stale local cache
        still_missing = [k for k in remaining_keys if k not in results]
        if still_missing:
            grace_results = self.get_many_local_cache(still_missing, force_grace=True)
            results.update(grace_results)

        return results

    def get_last_update_channel(self, key) -> UpdateChannel | None:
        """
        Gets how the option was last updated to check for drift.
        """
        try:
            option = self.model.objects.get(key=key.name)
        except self.model.DoesNotExist:
            return None

        return UpdateChannel(option.last_updated_by)

    def set(self, key, value, channel: UpdateChannel):
        """
        Store a value in the option store. Value must get persisted to database first,
        then attempt caches. If it fails database, the entire operation blows up.
        If cache fails, we ignore silently since it'll get repaired later by sync_options.
        A boolean is returned to indicate if the network cache was set successfully.
        """
        assert self.cache is not None, "cache must be configured before mutating options"

        self.set_store(key, value, channel)
        return self.set_cache(key, value)

    def set_store(self, key, value, channel: UpdateChannel):
        self.model.objects.update_or_create(
            key=key.name,
            defaults={
                "value": value,
                "last_updated": timezone.now(),
                "last_updated_by": channel.value,
            },
        )

    def set_cache(self, key, value):
        if self.cache is None:
            return None

        cache_key = key.cache_key

        if key.ttl > 0:
            self._local_cache[cache_key] = _make_cache_value(key, value)

        try:
            self.cache.set(cache_key, value, self.ttl)
            return True
        except Exception:
            logger.warning(CACHE_UPDATE_ERR, key.name, extra={"key": key.name}, exc_info=True)
            return False

    def delete(self, key):
        """
        Remove key out of option stores. This operation must succeed on the
        database first. If database fails, an exception is raised.
        If database succeeds, caches are then allowed to fail silently.
        A boolean is returned to indicate if the network deletion succeeds.
        """
        assert self.cache is not None, "cache must be configured before mutating options"

        self.delete_store(key)
        return self.delete_cache(key)

    def delete_store(self, key):
        self.model.objects.filter(key=key.name).delete()

    def delete_cache(self, key):
        cache_key = key.cache_key
        try:
            del self._local_cache[cache_key]
        except KeyError:
            pass

        try:
            self.cache.delete(cache_key)
            return True
        except Exception:
            logger.warning(CACHE_UPDATE_ERR, key.name, extra={"key": key.name}, exc_info=True)
            return False

    def clean_local_cache(self):
        """
        Iterate over our local cache items, and
        remove the keys that are beyond their grace time.
        """
        to_expire = []
        now = int(time())

        try:
            for k, (_, _, grace) in self._local_cache.items():
                if now > grace:
                    to_expire.append(k)
        except RuntimeError:
            # It's possible for the dictionary to be mutated in another thread
            # while iterating, but this case is rare, so instead of making a
            # copy and iterating that, it's more efficient to just let it fail
            # gracefully. It'll just get re-run later.
            return

        for k in to_expire:
            try:
                del self._local_cache[k]
            except KeyError:
                # This could only exist in a race condition
                # where another thread has already deleted this key,
                # but we'll guard ourselves against it Justin Case.
                pass

    def flush_local_cache(self):
        """
        Empty store's local in-process cache.
        """
        self._local_cache = {}

    def maybe_clean_local_cache(self, **kwargs):
        # Periodically force an expire on the local cache.
        # This cleanup is purely to keep memory low and garbage collect
        # old values. It's not required to run to keep things consistent.
        # Internally, if an option is fetched and it's expired, it gets
        # evicted immediately. This is purely for options that haven't
        # been fetched since they've expired.
        if not self._local_cache:
            return
        if random() < 0.25:
            self.clean_local_cache()

    def close(self) -> None:
        self.clean_local_cache()

    def set_cache_impl(self, cache) -> None:
        self.cache = cache
