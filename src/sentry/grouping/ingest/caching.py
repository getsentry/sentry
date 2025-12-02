# Note: These functions are in their own module to avoid circular imports.


from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.core.cache import cache

from sentry import options

if TYPE_CHECKING:
    from sentry.models.grouphash import GroupHash


def get_grouphash_existence_cache_key(hash_value: str, project_id: int) -> str:
    return f"secondary_grouphash_existence:{project_id}:{hash_value}"


def get_grouphash_object_cache_key(hash_value: str, project_id: int) -> str:
    return f"grouphash_with_assigned_group:{project_id}:{hash_value}"


def remove_grouphash_from_object_cache(instance: GroupHash, **kwargs: Any) -> None:
    if options.get("grouping.use_ingest_grouphash_caching") and instance.project:
        cache_key = get_grouphash_object_cache_key(instance.hash, instance.project.id)
        cache.delete(cache_key)


def remove_grouphash_from_existence_cache(instance: GroupHash, **kwargs: Any) -> None:
    if options.get("grouping.use_ingest_grouphash_caching") and instance.project:
        cache_key = get_grouphash_existence_cache_key(instance.hash, instance.project.id)
        cache.delete(cache_key)
