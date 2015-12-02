"""
sentry.options.store
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
from collections import namedtuple

from django.utils import timezone
from sentry.db.models.query import create_or_update
from sentry.models import Option
from sentry.utils.hashlib import md5


Key = namedtuple('Key', ('name', 'default', 'type', 'flags', 'cache_key'))

CACHE_FETCH_ERR = 'Unable to fetch option cache for %s'
CACHE_UPDATE_ERR = 'Unable to update option cache for %s'

logger = logging.getLogger('sentry')


class OptionsStore(object):
    def __init__(self, cache=None, ttl=None):
        if cache is None:
            from sentry.cache import default_cache
            cache = default_cache
        self.cache = cache
        self.ttl = ttl

    def _make_cache_key(self, key):
        return 'o:%s' % md5(key).hexdigest()

    def make_key(self, name, default, type, flags):
        return Key(name, default, type, flags, self._make_cache_key(name))

    def get(self, key):
        try:
            result = self.get_cache(key)
        except Exception:
            logger.warn(CACHE_FETCH_ERR, key.name, exc_info=True)
            result = None

        if result is None:
            try:
                result = self.get_store(key)
            except Option.DoesNotExist:
                result = None
            except Exception as e:
                logger.exception(unicode(e))
                result = None
            else:
                # we only attempt to populate the cache if we were previously
                # able to successfully talk to the backend
                # NOTE: There is definitely a race condition here between updating
                # the store and the cache
                try:
                    self.set_cache(key, result)
                except Exception:
                    logger.warn(CACHE_UPDATE_ERR, key.name, exc_info=True)
        return result

    def get_cache(self, key):
        return self.cache.get(key.cache_key)

    def get_store(self, key):
        return Option.objects.get(key=key.name).value

    def set(self, key, value):
        self.set_store(key, value)
        try:
            self.set_cache(key, value)
            return True
        except Exception:
            logger.warn(CACHE_UPDATE_ERR, key, exc_info=True)
            return False

    def set_store(self, key, value):
        create_or_update(
            model=Option,
            key=key.name,
            values={
                'value': value,
                'last_updated': timezone.now(),
            }
        )

    def set_cache(self, key, value):
        self.cache.set(key.cache_key, value, self.ttl)

    def delete(self, key):
        self.delete_store(key)
        try:
            self.delete_cache(key)
            return True
        except Exception:
            logger.warn(CACHE_UPDATE_ERR, key, exc_info=True)
            return False

    def delete_store(self, key):
        Option.objects.filter(key=key.name).delete()

    def delete_cache(self, key):
        self.cache.delete(key.cache_key)
