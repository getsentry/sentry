# Note: These functions are in their own module to avoid circular imports.


from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.core.cache import cache
from django.core.cache.backends.base import memcache_key_warnings

from sentry import options
from sentry.utils.hashlib import md5_text

if TYPE_CHECKING:
    from sentry.models.grouphash import GroupHash


def _clean_key_for_memcached(key: str) -> str:
    """
    See memcache_key_warnings in django. Certain keys will throw.
    This function finds those keys and consistently md5's them.
    This fixes SENTRY-5HXA.
    """
    if memcache_key_warnings(key):
        return md5_text(key).hexdigest()
    return key


def get_grouphash_existence_cache_key(hash_value: str, project_id: int) -> str:
    return f"secondary_grouphash_existence:{project_id}:{_clean_key_for_memcached(hash_value)}"


def get_grouphash_object_cache_key(hash_value: str, project_id: int) -> str:
    return f"grouphash_with_assigned_group:{project_id}:{_clean_key_for_memcached(hash_value)}"


def invalidate_grouphash_cache_on_save(instance: GroupHash, **kwargs: Any) -> None:
    # TODO: `GroupHash.project` is nullable for some reason, even though it's never ever null. If we
    # fix that, we can remove this check.
    if not instance.project:
        return

    if not options.get("grouping.use_ingest_grouphash_caching"):
        return

    # `create` call - grouphash hasn't had a chance to be cached yet, so nothing to invalidate
    if not instance.id:
        return

    cache_key = get_grouphash_object_cache_key(instance.hash, instance.project.id)
    cache.delete(cache_key)


def invalidate_grouphash_caches_on_delete(instance: GroupHash, **kwargs: Any) -> None:
    # TODO: `GroupHash.project` is nullable for some reason, even though it's never ever null. If we
    # fix that, we can remove this check.
    if not instance.project:
        return

    if not options.get("grouping.use_ingest_grouphash_caching"):
        return

    object_cache_key = get_grouphash_object_cache_key(instance.hash, instance.project.id)
    existence_cache_key = get_grouphash_existence_cache_key(instance.hash, instance.project.id)

    cache.delete_many([object_cache_key, existence_cache_key])
