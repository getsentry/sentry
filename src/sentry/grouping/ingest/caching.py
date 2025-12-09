# Note: These functions are in their own module to avoid circular imports.


from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal

from django.core.cache import cache

from sentry import options

if TYPE_CHECKING:
    from sentry.models.grouphash import GroupHash


def get_grouphash_existence_cache_key(hash_value: str, project_id: int) -> str:
    return f"secondary_grouphash_existence:{project_id}:{hash_value}"


def get_grouphash_object_cache_key(hash_value: str, project_id: int) -> str:
    return f"grouphash_with_assigned_group:{project_id}:{hash_value}"


# TODO: Once we settle on a good expiry time for both caches, this can go
def get_grouphash_cache_version(cache_type: Literal["existence", "object"]) -> int:
    option_name = f"grouping.ingest_grouphash_{cache_type}_cache_expiry.trial_values"
    possible_cache_expiries = options.get(option_name)
    return abs(hash(tuple(possible_cache_expiries)))


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
