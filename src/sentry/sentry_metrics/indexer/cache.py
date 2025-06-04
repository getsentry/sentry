from __future__ import annotations

import logging
import random
from collections.abc import Collection, Iterable, Mapping, MutableMapping, Sequence
from datetime import datetime, timedelta

from django.conf import settings
from django.core.cache import caches

from sentry import options
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

_INDEXER_CACHE_BULK_RECORD_METRIC = "sentry_metrics.indexer.memcache"
_INDEXER_CACHE_RESOLVE_METRIC = "sentry_metrics.indexer.memcache.resolve"
_INDEXER_CACHE_RESOLVE_CACHE_REPLENISHMENT_METRIC = (
    "sentry_metrics.indexer.memcache.resolve.replenish"
)
_INDEXER_CACHE_DOUBLE_WRITE_METRIC = "sentry_metrics.indexer.memcache.double-write"
_INDEXER_CACHE_DOUBLE_READ_METRIC = "sentry_metrics.indexer.memcache.new-schema-read"
_INDEXER_CACHE_STALE_KEYS_METRIC = "sentry_metrics.indexer.memcache.stale-keys"

# only used to compare to the older version of the PGIndexer
_INDEXER_CACHE_FETCH_METRIC = "sentry_metrics.indexer.memcache.fetch"


NAMESPACED_WRITE_FEAT_FLAG = "sentry-metrics.indexer.write-new-cache-namespace"
NAMESPACED_READ_FEAT_FLAG = "sentry-metrics.indexer.read-new-cache-namespace"

BULK_RECORD_CACHE_NAMESPACE = "br"
RESOLVE_CACHE_NAMESPACE = "res"


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

    def _make_cache_key(self, key: str) -> str:
        use_case_id, org_id, string = key.split(":", 2)
        org_string = org_id + ":" + string
        hashed = md5_text(org_string).hexdigest()

        return f"indexer:{self.partition_key}:org:str:{use_case_id}:{hashed}"

    # The new namespaced version of the above function, eventually this will replace
    # _make_cache_key
    def _make_namespaced_cache_key(self, namespace: str, key: str) -> str:
        use_case_id, org_id, string = key.split(":", 2)
        org_string = f"{org_id}:{string}"
        hashed = md5_text(org_string).hexdigest()

        return f"indexer:{self.partition_key}:{namespace}:org:str:{use_case_id}:{hashed}"

    def _make_cache_val(self, val: int, timestamp: int):
        return f"{val}:{timestamp}"

    def _format_results(
        self, keys: Iterable[str], results: Mapping[str, int | None]
    ) -> MutableMapping[str, int | None]:
        """
        Takes in keys formatted like "use_case_id:org_id:string", and results that have the
        internally used hashed key such as:
            {"indexer:org:str:transactions:b0a0e436f6fa42b9e33e73befbdbb9ba": 2}
        and returns results that replace the hashed internal key with the externally
        used key:
            {"transactions:3:a": 2}
        """
        formatted: MutableMapping[str, int | None] = {}
        for key in keys:
            cache_key = self._make_cache_key(key)
            formatted[key] = results.get(cache_key)

        return formatted

    # The new namespaced version of the above function, eventually this will replace
    # _format_results
    def _format_namespaced_results(
        self, namespace: str, keys: Iterable[str], results: Mapping[str, int | None]
    ) -> MutableMapping[str, int | None]:
        """
        Takes in keys formatted like "use_case_id:org_id:string", and results that have the
        internally used hashed key such as:
            {"indexer:org:str:transactions:b0a0e436f6fa42b9e33e73befbdbb9ba": 2}
        and returns results that replace the hashed internal key with the externally
        used key:
            {"transactions:3:a": 2}
        """
        formatted: MutableMapping[str, int | None] = {}
        for key in keys:
            cache_key = self._make_namespaced_cache_key(namespace, key)
            formatted[key] = results.get(cache_key)

        return formatted

    def _is_valid_timestamp(self, timestamp: str) -> bool:
        return int(timestamp) >= int((datetime.utcnow() - timedelta(hours=3)).timestamp())

    def _validate_result(self, result: str | None) -> int | None:
        if result is None:
            return None
        result, timestamp = result.split(":")

        if not self._is_valid_timestamp(timestamp):
            metrics.incr(_INDEXER_CACHE_STALE_KEYS_METRIC)
            return None

        return int(result)

    def get(self, namespace: str, key: str) -> int | None:
        if options.get(NAMESPACED_READ_FEAT_FLAG):
            metrics.incr(_INDEXER_CACHE_DOUBLE_READ_METRIC)
            result = self.cache.get(
                self._make_namespaced_cache_key(namespace, key), version=self.version
            )
            return self._validate_result(result)
        return self.cache.get(self._make_cache_key(key), version=self.version)

    def set(self, namespace: str, key: str, value: int) -> None:
        self.cache.set(
            key=self._make_cache_key(key),
            value=value,
            timeout=self.randomized_ttl,
            version=self.version,
        )
        if options.get(NAMESPACED_WRITE_FEAT_FLAG):
            metrics.incr(_INDEXER_CACHE_DOUBLE_WRITE_METRIC)
            self.cache.set(
                key=self._make_namespaced_cache_key(namespace, key),
                value=self._make_cache_val(value, int(datetime.utcnow().timestamp())),
                timeout=self.randomized_ttl,
                version=self.version,
            )

    def get_many(self, namespace: str, keys: Iterable[str]) -> MutableMapping[str, int | None]:
        if options.get(NAMESPACED_READ_FEAT_FLAG):
            metrics.incr(_INDEXER_CACHE_DOUBLE_READ_METRIC)
            cache_keys = {self._make_namespaced_cache_key(namespace, key): key for key in keys}
            namespaced_results: MutableMapping[str, int | None] = {
                k: self._validate_result(v)
                for k, v in self.cache.get_many(cache_keys.keys(), version=self.version).items()
            }
            return self._format_namespaced_results(
                namespace,
                keys,
                namespaced_results,
            )
        else:
            cache_keys = {self._make_cache_key(key): key for key in keys}
            results: Mapping[str, int | None] = self.cache.get_many(
                cache_keys.keys(), version=self.version
            )
            return self._format_results(keys, results)

    def set_many(self, namespace: str, key_values: Mapping[str, int]) -> None:
        cache_key_values = {self._make_cache_key(k): v for k, v in key_values.items()}
        self.cache.set_many(cache_key_values, timeout=self.randomized_ttl, version=self.version)
        if options.get(NAMESPACED_WRITE_FEAT_FLAG):
            metrics.incr(_INDEXER_CACHE_DOUBLE_WRITE_METRIC)
            timestamp = int(datetime.utcnow().timestamp())
            namespaced_cache_key_values = {
                self._make_namespaced_cache_key(namespace, k): self._make_cache_val(v, timestamp)
                for k, v in key_values.items()
            }
            self.cache.set_many(
                namespaced_cache_key_values, timeout=self.randomized_ttl, version=self.version
            )

    def delete(self, namespace: str, key: str) -> None:
        self.cache.delete(self._make_cache_key(key), version=self.version)
        if options.get(NAMESPACED_WRITE_FEAT_FLAG):
            metrics.incr(_INDEXER_CACHE_DOUBLE_WRITE_METRIC)
            self.cache.delete(self._make_namespaced_cache_key(namespace, key), version=self.version)

    def delete_many(self, namespace: str, keys: Sequence[str]) -> None:
        self.cache.delete_many([self._make_cache_key(key) for key in keys], version=self.version)
        if options.get(NAMESPACED_WRITE_FEAT_FLAG):
            metrics.incr(_INDEXER_CACHE_DOUBLE_WRITE_METRIC)
            self.cache.delete_many(
                [self._make_namespaced_cache_key(namespace, key) for key in keys],
                version=self.version,
            )


class CachingIndexer(StringIndexer):
    def __init__(self, cache: StringIndexerCache, indexer: StringIndexer) -> None:
        self.cache = cache
        self.indexer = indexer

    def bulk_record(
        self, strings: Mapping[UseCaseID, Mapping[OrgId, set[str]]]
    ) -> UseCaseKeyResults:
        cache_keys = UseCaseKeyCollection(strings)
        metrics.gauge("sentry_metrics.indexer.lookups_per_batch", value=cache_keys.size)
        cache_key_strs = cache_keys.as_strings()
        cache_results = self.cache.get_many(BULK_RECORD_CACHE_NAMESPACE, cache_key_strs)

        hits = [k for k, v in cache_results.items() if v is not None]

        # record all the cache hits we had
        metrics.incr(
            _INDEXER_CACHE_BULK_RECORD_METRIC,
            tags={"cache_hit": "true", "caller": "get_many_ids"},
            amount=len(hits),
        )
        metrics.incr(
            _INDEXER_CACHE_BULK_RECORD_METRIC,
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

        self.cache.set_many(
            BULK_RECORD_CACHE_NAMESPACE, db_record_key_results.get_mapped_strings_to_ints()
        )

        return cache_key_results.merge(db_record_key_results)

    def record(self, use_case_id: UseCaseID, org_id: int, string: str) -> int | None:
        result = self.bulk_record(strings={use_case_id: {org_id: {string}}})
        return result[use_case_id][org_id][string]

    @metric_path_key_compatible_resolve
    def resolve(self, use_case_id: UseCaseID, org_id: int, string: str) -> int | None:
        key = f"{use_case_id.value}:{org_id}:{string}"
        result = self.cache.get(RESOLVE_CACHE_NAMESPACE, key)

        if result and isinstance(result, int):
            metrics.incr(
                _INDEXER_CACHE_RESOLVE_METRIC,
                tags={"cache_hit": "true", "use_case": use_case_id.value},
            )
            return result

        id = self.indexer.resolve(use_case_id, org_id, string)
        if id is not None:
            metrics.incr(
                _INDEXER_CACHE_RESOLVE_METRIC,
                tags={"cache_hit": "false", "use_case": use_case_id.value},
            )
            # TODO: this random rollout is backwards
            if random.random() >= options.get(
                "sentry-metrics.indexer.disable-memcache-replenish-rollout"
            ):
                metrics.incr(
                    _INDEXER_CACHE_RESOLVE_CACHE_REPLENISHMENT_METRIC,
                    tags={"use_case": use_case_id.value},
                )
                self.cache.set(RESOLVE_CACHE_NAMESPACE, key, id)

        return id

    @metric_path_key_compatible_rev_resolve
    def reverse_resolve(self, use_case_id: UseCaseID, org_id: int, id: int) -> str | None:
        return self.indexer.reverse_resolve(use_case_id, org_id, id)

    def bulk_reverse_resolve(
        self, use_case_id: UseCaseID, org_id: int, ids: Collection[int]
    ) -> Mapping[int, str]:
        return self.indexer.bulk_reverse_resolve(use_case_id, org_id, ids)

    def resolve_shared_org(self, string: str) -> int | None:
        raise NotImplementedError(
            "This class should not be used directly, use a wrapping class that derives from StaticStringIndexer"
        )

    def reverse_shared_org_resolve(self, id: int) -> str | None:
        raise NotImplementedError(
            "This class should not be used directly, use a wrapping class that derives from StaticStringIndexer"
        )
