"""
sentry.options.manager
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.utils import timezone
from hashlib import md5

from sentry.app import cache
from sentry.db.models.query import create_or_update
from sentry.models import Option


CACHE_FETCH_ERR = 'Unable to fetch option cache for %s'

CACHE_UPDATE_ERR = 'Unable to update option cache for %s'


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

    - Values must be strings.
    - Empty values are identical to null values which are represented by ''.
    """
    cache = cache

    logger = logging.getLogger('sentry.errors')

    # we generally want to always persist
    ttl = None

    def __init__(self, cache=None, ttl=None, logger=None):
        if cache is not None:
            self.cache = cache

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
        create_or_update(
            model=Option,
            key=key,
            defaults={
                'value': value,
                'last_updated': timezone.now(),
            }
        )

        try:
            self.update_cached_value(key, value)
        except Exception as e:
            self.logger.warn(CACHE_UPDATE_ERR, key, exc_info=True)

    def get(self, key):
        """
        Get the value of an option prioritizing the cache, then the database,
        and finally the local configuration.

        If no value is present for the key, an empty value ('') is returned.

        >>> from sentry import options
        >>> options.get('option')
        """
        cache_key = self._make_cache_key(key)

        try:
            result = self.cache.get(cache_key)
        except Exception as e:
            self.logger.warn(CACHE_FETCH_ERR, key, exc_info=True)
            result = None
            cache_success = False
        else:
            cache_success = True

        if result is None:
            try:
                result = Option.objects.get(key=key).value
            except Option.DoesNotExist:
                result = ''
            except Exception as e:
                self.logger.exception(unicode(e))
                result = None

            # we only attempt to populate the cache if we were previously
            # able to successfully talk to the backend
            if result is not None and cache_success:
                try:
                    self.update_cached_value(key, result)
                except Exception as e:
                    self.logger.warn(CACHE_UPDATE_ERR, key, exc_info=True)

        if not result:
            # default to the hardcoded local configuration for this key
            result = settings.SENTRY_OPTIONS.get(key)

        return result or ''

    def delete(self, key):
        """
        Permanently remove the value of an option.

        This will also clear the value within the cache, which means a following
        get() will result in a miss.

        >>> from sentry import options
        >>> options.delete('option')
        """
        cache_key = self._make_cache_key(key)

        Option.objects.filter(key=key).delete()

        try:
            self.cache.delete(cache_key)
        except Exception as e:
            self.logger.warn(CACHE_UPDATE_ERR, key, exc_info=True)

    def update_cached_value(self, key, value):
        cache_key = self._make_cache_key(key)

        self.cache.set(cache_key, value, self.ttl)
