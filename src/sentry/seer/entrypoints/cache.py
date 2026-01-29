from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerOperatorCacheResult
from sentry.utils.cache import cache

AUTOFIX_CACHE_TIMEOUT_SECONDS = 60 * 60 * 12  # 12 hours


class SeerOperatorAutofixCache[CachePayloadT]:

    @classmethod
    def get_pre_autofix_cache_key(cls, *, entrypoint_key: str, group_id: int) -> str:
        """
        The group cache key is used to store entrypoint-specific cache payloads BEFORE an autofix
        run has been started, thus requires a group_id. When an autofix run does start, Seer emits a
        webhook with the run_id and group_id, so we can relocate the cache to the post-autofix key.
        """
        return f"seer:pre_autofix:{entrypoint_key}:{group_id}"

    @classmethod
    def get_pre_autofix_cache(
        cls, *, entrypoint_key: str, group_id: int
    ) -> SeerOperatorCacheResult | None:
        cache_key = cls.get_pre_autofix_cache_key(entrypoint_key=entrypoint_key, group_id=group_id)
        cache_payload = cache.get(cache_key)
        if not cache_payload:
            return None
        return SeerOperatorCacheResult[CachePayloadT](
            payload=cache_payload,
            source="group_id",
            key=cache_key,
        )

    @classmethod
    def populate_pre_autofix_cache(
        cls, *, entrypoint_key: str, group_id: int, cache_payload: CachePayloadT
    ) -> SeerOperatorCacheResult:
        cache_key = cls.get_pre_autofix_cache_key(entrypoint_key=entrypoint_key, group_id=group_id)
        cache.set(cache_key, cache_payload, timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS)
        return SeerOperatorCacheResult[CachePayloadT](
            payload=cache_payload,
            source="group_id",
            key=cache_key,
        )

    @classmethod
    def get_post_autofix_cache_key(cls, *, entrypoint_key: str, run_id: int) -> str:
        """
        The autofix cache key is used to store entrypoint-specific cache payloads AFTER an autofix
        run has been started, thus requires a run_id.
        """
        return f"seer:post_autofix:{entrypoint_key}:{run_id}"

    @classmethod
    def get_post_autofix_cache(
        cls, *, entrypoint_key: str, run_id: int
    ) -> SeerOperatorCacheResult | None:
        cache_key = cls.get_post_autofix_cache_key(entrypoint_key=entrypoint_key, run_id=run_id)
        cache_payload = cache.get(cache_key)
        if not cache_payload:
            return None
        return SeerOperatorCacheResult[CachePayloadT](
            payload=cache_payload,
            source="run_id",
            key=cache_key,
        )

    @classmethod
    def populate_post_autofix_cache(
        cls, *, entrypoint_key: str, run_id: int, cache_payload: CachePayloadT
    ) -> SeerOperatorCacheResult:
        cache_key = cls.get_post_autofix_cache_key(entrypoint_key=entrypoint_key, run_id=run_id)
        cache.set(cache_key, cache_payload, timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS)
        return SeerOperatorCacheResult[CachePayloadT](
            payload=cache_payload,
            source="run_id",
            key=cache_key,
        )

    @classmethod
    def get(
        cls, *, entrypoint_key: str, group_id: int | None = None, run_id: int | None = None
    ) -> SeerOperatorCacheResult | None:
        if not group_id and not run_id:
            raise ValueError("At least one of group_id or run_id must be provided.")

        cache_result = None
        if run_id:
            cache_result = cls.get_post_autofix_cache(entrypoint_key=entrypoint_key, run_id=run_id)

        # We prefer the run cache payload since it's more narrow
        # A group can have multiple runs, and that means many threads to post updates to.
        # A run has a single group, and (usually) a single thread to post updates to.
        if group_id and not cache_result:
            cache_result = cls.get_pre_autofix_cache(
                entrypoint_key=entrypoint_key, group_id=group_id
            )

        if not cache_result:
            return None

        # If we do have a run_id cache, we can delete the pre-autofix cache to prevent autofix
        # updates targeting all matching groups from being sent, limiting updates to just this run.
        if group_id and cache_result["source"] == "run_id":
            cache.delete(
                cls.get_pre_autofix_cache_key(entrypoint_key=entrypoint_key, group_id=group_id)
            )

        return cache_result

    @classmethod
    def migrate(
        cls,
        *,
        from_group_id: int,
        to_run_id: int,
        overwrite: bool = False,
    ) -> None:
        """
        Migrate from a pre-autofix cache (keyed on group_id) to a post-autofix cache (keyed on run_id),
        if one exists. If overwrite is True, any existing post-autofix cache will be overwritten.
        """
        for entrypoint_key in entrypoint_registry.registrations.keys():
            pre_cache_result = cls.get_pre_autofix_cache(
                entrypoint_key=entrypoint_key, group_id=from_group_id
            )
            post_cache_result = cls.get_post_autofix_cache(
                entrypoint_key=entrypoint_key, run_id=to_run_id
            )
            # If we already have a post-autofix cache, and we're not overwriting, skip.
            if not overwrite and post_cache_result:
                continue
            # If we don't have a pre-autofix cache, nothing to migrate, skip.
            if not pre_cache_result:
                continue
            post_cache_key = cls.get_post_autofix_cache_key(
                entrypoint_key=entrypoint_key, run_id=to_run_id
            )
            cache.set(
                post_cache_key,
                pre_cache_result["payload"],
                timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
            )
            cache.delete(pre_cache_result["key"])
