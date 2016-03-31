"""
sentry.options.store
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
from collections import namedtuple
from time import time
from random import random

from django.utils import timezone
from django.utils.functional import cached_property
from sentry.db.models.query import create_or_update
from sentry.utils.hashlib import md5


Key = namedtuple('Key', ('name', 'default', 'type', 'flags', 'ttl', 'grace', 'cache_key'))

CACHE_FETCH_ERR = 'Unable to fetch option cache for %s'
CACHE_UPDATE_ERR = 'Unable to update option cache for %s'

logger = logging.getLogger('sentry')


def _make_cache_key(key):
    return 'o:%s' % md5(key).hexdigest()


def _make_cache_value(key, value):
    now = int(time())
    return (
        value,
        now + key.ttl,
        now + key.ttl + key.grace,
    )


class OptionsStore(object):
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

    @cached_property
    def model(self):
        from sentry.models.option import Option
        return Option

    def make_key(self, name, default, type, flags, ttl, grace):
        return Key(name, default, type, flags, int(ttl), int(grace), _make_cache_key(name))

    def get(self, key, silent=False):
        """
        Fetches a value from the options store.
        """
        result = self.get_cache(key, silent=silent)
        if result is not None:
            return result

        result = self.get_store(key, silent=silent)
        if result is not None:
            return result

        # As a last ditch effort, let's hope we have a key
        # in local cache that's possibly stale
        return self.get_local_cache(key, force_grace=True)

    def get_cache(self, key, silent=False):
        """
        First check agaist our local in-process cache, falling
        back to the network cache.
        """
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
                logger.warn(CACHE_FETCH_ERR, key.name, exc_info=True)
            value = None
        else:
            if key.ttl > 0:
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
            value = self.model.objects.get(key=key.name).value
        except self.model.DoesNotExist:
            value = None
        except Exception as e:
            if not silent:
                logger.exception(unicode(e))
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
                    logger.warn(CACHE_UPDATE_ERR, key.name, exc_info=True)
        return value

    def set(self, key, value):
        """
        Store a value in the option store. Value must get persisted to database first,
        then attempt caches. If it fails database, the entire operation blows up.
        If cache fails, we ignore silently since it'll get repaired later by sync_options.
        A boolean is returned to indicate if the network cache was set successfully.
        """
        assert self.cache is not None, 'cache must be configured before mutating options'

        self.set_store(key, value)
        return self.set_cache(key, value)

    def set_store(self, key, value):
        create_or_update(
            model=self.model,
            key=key.name,
            values={
                'value': value,
                'last_updated': timezone.now(),
            }
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
            logger.warn(CACHE_UPDATE_ERR, key.name, exc_info=True)
            return False

    def delete(self, key):
        """
        Remove key out of option stores. This operation must succeed on the
        database first. If database fails, an exception is raised.
        If database succeeds, caches are then allowed to fail silently.
        A boolean is returned to indicate if the network deletion succeeds.
        """
        assert self.cache is not None, 'cache must be configured before mutating options'

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
            logger.warn(CACHE_UPDATE_ERR, key.name, exc_info=True)
            return False

    def clean_local_cache(self):
        """
        Iterate over our local cache items, and
        remove the keys that are beyond their grace time.
        """
        to_expire = []
        now = int(time())

        try:
            for k, (_, _, grace) in self._local_cache.iteritems():
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

    def connect_signals(self):
        from celery.signals import task_postrun
        from django.core.signals import request_finished
        task_postrun.connect(self.maybe_clean_local_cache)
        request_finished.connect(self.maybe_clean_local_cache)
