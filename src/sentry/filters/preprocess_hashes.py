from __future__ import absolute_import

from django.core.cache import cache, get_cache, InvalidCacheBackendError


try:
    hash_cache = get_cache('preprocess_hash')
except InvalidCacheBackendError:
    hash_cache = cache


def get_raw_cache_key(project_id, event_id):
    return 'e:raw:{1}:{0}'.format(project_id, event_id)
