import logging

from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerOperatorCacheResult
from sentry.utils import metrics
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

AUTOFIX_CACHE_TIMEOUT_SECONDS = 60 * 60 * 12  # 12 hours


class SeerOperatorAutofixCache[CachePayloadT]:

    @classmethod
    def _get_pre_autofix_cache_key(cls, *, entrypoint_key: str, group_id: int) -> str:
        """
        The group cache key is used to store entrypoint-specific cache payloads BEFORE an autofix
        run has been started, thus requires a group_id. When an autofix run does start, Seer emits a
        webhook with the run_id and group_id, so we can relocate the cache to the post-autofix key.
        """
        return f"seer:pre_autofix:{entrypoint_key}:{group_id}"

    @classmethod
    def _get_post_autofix_cache_key(cls, *, entrypoint_key: str, run_id: int) -> str:
        """
        The autofix cache key is used to store entrypoint-specific cache payloads AFTER an autofix
        run has been started, thus requires a run_id.
        """
        return f"seer:post_autofix:{entrypoint_key}:{run_id}"

    @classmethod
    def _get_pre_autofix_cache(
        cls, *, entrypoint_key: str, group_id: int
    ) -> SeerOperatorCacheResult | None:
        cache_key = cls._get_pre_autofix_cache_key(entrypoint_key=entrypoint_key, group_id=group_id)
        cache_payload = cache.get(cache_key)
        if not cache_payload:
            return None
        return SeerOperatorCacheResult[CachePayloadT](
            payload=cache_payload,
            source="group_id",
            key=cache_key,
        )

    @classmethod
    def _get_post_autofix_cache(
        cls, *, entrypoint_key: str, run_id: int
    ) -> SeerOperatorCacheResult | None:
        cache_key = cls._get_post_autofix_cache_key(entrypoint_key=entrypoint_key, run_id=run_id)
        cache_payload = cache.get(cache_key)
        if not cache_payload:
            return None
        return SeerOperatorCacheResult[CachePayloadT](
            payload=cache_payload,
            source="run_id",
            key=cache_key,
        )

    @classmethod
    def populate_pre_autofix_cache(
        cls, *, entrypoint_key: str, group_id: int, cache_payload: CachePayloadT
    ) -> SeerOperatorCacheResult:
        cache_key = cls._get_pre_autofix_cache_key(entrypoint_key=entrypoint_key, group_id=group_id)
        cache.set(cache_key, cache_payload, timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS)
        logger.info(
            "seer.operator.cache.pre_autofix_populated",
            extra={
                "entrypoint_key": entrypoint_key,
                "group_id": group_id,
                "cache_key": cache_key,
            },
        )
        return SeerOperatorCacheResult[CachePayloadT](
            payload=cache_payload,
            source="group_id",
            key=cache_key,
        )

    @classmethod
    def populate_post_autofix_cache(
        cls, *, entrypoint_key: str, run_id: int, cache_payload: CachePayloadT
    ) -> SeerOperatorCacheResult:
        cache_key = cls._get_post_autofix_cache_key(entrypoint_key=entrypoint_key, run_id=run_id)
        cache.set(cache_key, cache_payload, timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS)
        logger.info(
            "seer.operator.cache.post_autofix_populated",
            extra={
                "entrypoint_key": entrypoint_key,
                "run_id": run_id,
                "cache_key": cache_key,
            },
        )
        return SeerOperatorCacheResult[CachePayloadT](
            payload=cache_payload,
            source="run_id",
            key=cache_key,
        )

    @classmethod
    def get(
        cls, *, entrypoint_key: str, group_id: int | None = None, run_id: int | None = None
    ) -> SeerOperatorCacheResult | None:
        """
        Gets the most specific cache payload for a given entrypoint, group_id and/or run_id.
        If run_id cache hits, it's returned, and the group_id cache is deleted (if a group_id was provided).
        If run_id cache misses, the group_id cache result is returned, hit or miss.
        """
        if not group_id and not run_id:
            raise ValueError("At least one of group_id or run_id must be provided.")

        cache_result = None
        if run_id:
            cache_result = cls._get_post_autofix_cache(entrypoint_key=entrypoint_key, run_id=run_id)

        # We prefer the run cache payload since it's more narrow
        # A group can have multiple runs, and that means many threads to post updates to.
        # A run has a single group, and (usually) a single thread to post updates to.
        if group_id and not cache_result:
            cache_result = cls._get_pre_autofix_cache(
                entrypoint_key=entrypoint_key, group_id=group_id
            )

        if not cache_result:
            return None

        # If we do have a run_id cache, we can delete the pre-autofix cache to prevent autofix
        # updates targeting all matching groups from being sent, limiting updates to just this run.
        if group_id and cache_result["source"] == "run_id":
            cache.delete(
                cls._get_pre_autofix_cache_key(entrypoint_key=entrypoint_key, group_id=group_id)
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
            logging_ctx = {
                "entrypoint_key": str(entrypoint_key),
                "group_id": from_group_id,
                "run_id": to_run_id,
            }
            pre_cache_result = cls._get_pre_autofix_cache(
                entrypoint_key=entrypoint_key, group_id=from_group_id
            )
            post_cache_result = cls._get_post_autofix_cache(
                entrypoint_key=entrypoint_key, run_id=to_run_id
            )
            # If we already have a post-autofix cache, and we're not overwriting, skip.
            if not overwrite and post_cache_result:
                logging_ctx["reason"] = "post_cache_exists"
                logger.info("seer.operator.cache.migrate_skipped", extra=logging_ctx)
                continue
            # If we don't have a pre-autofix cache, nothing to migrate, skip.
            if not pre_cache_result:
                logging_ctx["reason"] = "no_pre_cache"
                logger.info("seer.operator.cache.migrate_skipped", extra=logging_ctx)
                continue
            post_cache_key = cls._get_post_autofix_cache_key(
                entrypoint_key=entrypoint_key, run_id=to_run_id
            )
            cache.set(
                post_cache_key,
                pre_cache_result["payload"],
                timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
            )
            cache.delete(pre_cache_result["key"])
            logging_ctx["from_key"] = pre_cache_result["key"]
            logging_ctx["to_key"] = post_cache_key
            logger.info("seer.operator.cache.migrated", extra=logging_ctx)
            metrics.incr(
                "seer.operator.cache.migrated",
                tags={"entrypoint_key": str(entrypoint_key)},
            )
