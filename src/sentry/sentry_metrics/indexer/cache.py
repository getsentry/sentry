import logging
import random
from typing import Mapping, MutableMapping, Optional, Sequence, Set

from django.conf import settings
from django.core.cache import caches

from sentry.sentry_metrics.indexer.base import (
    FetchType,
    OrgId,
    StringIndexer,
    UseCaseKeyCollection,
    UseCaseKeyResult,
    UseCaseKeyResults,
    metric_path_key_compatible_resolve,
    metric_path_key_compatible_rev_resolve,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)

_INDEXER_CACHE_METRIC = "sentry_metrics.indexer.memcache"
# only used to compare to the older version of the PGIndexer
_INDEXER_CACHE_FETCH_METRIC = "sentry_metrics.indexer.memcache.fetch"


class StringIndexerCache:
    def __init__(self, cache_name: str, partition_key: str):
        self.version = 1
        self.cache = caches[cache_name]
        self.partition_key = partition_key

    @property
    def randomized_ttl(self) -> int:
        # introduce jitter in the cache_ttl so that when we have large
        # amount of new keys written into the cache, they don't expire all at once
        cache_ttl = settings.SENTRY_METRICS_INDEXER_CACHE_TTL
        jitter = random.uniform(0, 0.25) * cache_ttl
        return int(cache_ttl + jitter)

    def make_cache_key(self, key: str) -> str:
        use_case_id, org_id, string = key.split(":", 2)
        org_string = org_id + ":" + string
        hashed = md5_text(org_string).hexdigest()

        return f"indexer:{self.partition_key}:org:str:{use_case_id}:{hashed}"

    def _format_results(
        self, keys: Sequence[str], results: Mapping[str, Optional[int]]
    ) -> MutableMapping[str, Optional[int]]:
        """
        Takes in keys formatted like "use_case_id:org_id:string", and results that have the
        internally used hashed key such as:
            {"indexer:org:str:transactions:b0a0e436f6fa42b9e33e73befbdbb9ba": 2}
        and returns results that replace the hashed internal key with the externally
        used key:
            {"transactions:3:a": 2}
        """
        formatted: MutableMapping[str, Optional[int]] = {}
        for key in keys:
            cache_key = self.make_cache_key(key)
            formatted[key] = results.get(cache_key)

        return formatted

    def get(self, key: str) -> int:
        result: int = self.cache.get(self.make_cache_key(key), version=self.version)
        return result

    def set(self, key: str, value: int) -> None:
        self.cache.set(
            key=self.make_cache_key(key),
            value=value,
            timeout=self.randomized_ttl,
            version=self.version,
        )

    def get_many(self, keys: Sequence[str]) -> MutableMapping[str, Optional[int]]:
        cache_keys = {self.make_cache_key(key): key for key in keys}
        results: Mapping[str, Optional[int]] = self.cache.get_many(
            cache_keys.keys(), version=self.version
        )
        return self._format_results(keys, results)

    def set_many(self, key_values: Mapping[str, int]) -> None:
        cache_key_values = {self.make_cache_key(k): v for k, v in key_values.items()}
        self.cache.set_many(cache_key_values, timeout=self.randomized_ttl, version=self.version)

    def delete(self, key: str) -> None:
        cache_key = self.make_cache_key(key)
        self.cache.delete(cache_key, version=self.version)

    def delete_many(self, keys: Sequence[str]) -> None:
        cache_keys = [self.make_cache_key(key) for key in keys]
        self.cache.delete_many(cache_keys, version=self.version)


class CachingIndexer(StringIndexer):
    def __init__(self, cache: StringIndexerCache, indexer: StringIndexer) -> None:
        self.cache = cache
        self.indexer = indexer

    def bulk_record(
        self, strings: Mapping[UseCaseID, Mapping[OrgId, Set[str]]]
    ) -> UseCaseKeyResults:
        cache_keys = UseCaseKeyCollection(strings)
        metrics.gauge("sentry_metrics.indexer.lookups_per_batch", value=cache_keys.size)
        cache_key_strs = cache_keys.as_strings()
        cache_results = self.cache.get_many(cache_key_strs)

        hits = [k for k, v in cache_results.items() if v is not None]

        # record all the cache hits we had
        metrics.incr(
            _INDEXER_CACHE_METRIC,
            tags={"cache_hit": "true", "caller": "get_many_ids"},
            amount=len(hits),
        )
        metrics.incr(
            _INDEXER_CACHE_METRIC,
            tags={"cache_hit": "false", "caller": "get_many_ids"},
            amount=len(cache_results) - len(hits),
        )

        # used to compare to pre org_id indexer cache fetch metric
        metrics.incr(
            _INDEXER_CACHE_FETCH_METRIC,
            amount=cache_keys.size,
        )

        cache_key_results = UseCaseKeyResults()
        cache_key_results.add_use_case_key_results(
            [UseCaseKeyResult.from_string(k, v) for k, v in cache_results.items() if v is not None],
            FetchType.CACHE_HIT,
        )

        db_record_keys = cache_key_results.get_unmapped_use_case_keys(cache_keys)

        if db_record_keys.size == 0:
            return cache_key_results

        db_record_key_results = self.indexer.bulk_record(
            {
                use_case_id: key_collection.mapping
                for use_case_id, key_collection in db_record_keys.mapping.items()
            }
        )

        self.cache.set_many(db_record_key_results.get_mapped_strings_to_ints())

        return cache_key_results.merge(db_record_key_results)

    def record(self, use_case_id: UseCaseID, org_id: int, string: str) -> Optional[int]:
        result = self.bulk_record(strings={use_case_id: {org_id: {string}}})
        return result[use_case_id][org_id][string]

    @metric_path_key_compatible_resolve
    def resolve(self, use_case_id: UseCaseID, org_id: int, string: str) -> Optional[int]:
        key = f"{use_case_id.value}:{org_id}:{string}"
        result = self.cache.get(key)

        if result and isinstance(result, int):
            metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "true", "caller": "resolve"})
            return result

        metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "false", "caller": "resolve"})
        id = self.indexer.resolve(use_case_id, org_id, string)

        if id is not None:
            self.cache.set(key, id)

        return id

    @metric_path_key_compatible_rev_resolve
    def reverse_resolve(self, use_case_id: UseCaseID, org_id: int, id: int) -> Optional[str]:
        return self.indexer.reverse_resolve(use_case_id, org_id, id)

    def resolve_shared_org(self, string: str) -> Optional[int]:
        raise NotImplementedError(
            "This class should not be used directly, use a wrapping class that derives from StaticStringIndexer"
        )

    def reverse_shared_org_resolve(self, id: int) -> Optional[str]:
        raise NotImplementedError(
            "This class should not be used directly, use a wrapping class that derives from StaticStringIndexer"
        )
