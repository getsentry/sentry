import logging
import random
from typing import Mapping, MutableMapping, Optional, Sequence

from django.conf import settings

from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)


class StringIndexerCache:
    def __init__(self, version: int):
        self.version = version

    @property
    def randomized_ttl(self) -> int:
        # introduce jitter in the cache_ttl so that when we have large
        # amount of new keys written into the cache, they don't expire all at once
        cache_ttl = settings.SENTRY_METRICS_INDEXER_CACHE_TTL
        jitter = random.uniform(0, 0.25) * cache_ttl
        return int(cache_ttl + jitter)

    def make_cache_key(self, key: str) -> str:
        hashed = md5_text(key).hexdigest()
        return f"indexer:org:str:{hashed}"

    def _format_results(
        self,
        keys: Sequence[str],
        results: Mapping[str, Optional[int]],
    ) -> MutableMapping[str, Optional[int]]:
        """
        Takes in keys formatted like "org_id:string", and results that have the
        internally used hashed key such as:
            {"indexer:org:str:b0a0e436f6fa42b9e33e73befbdbb9ba": 2}
        and returns results that replace the hashed internal key with the externally
        used key:
            {"1.2.0": 2}
        """
        formatted: MutableMapping[str, Optional[int]] = {}
        for key in keys:
            cache_key = self.make_cache_key(key)
            formatted[key] = results.get(cache_key)

        return formatted

    def get(self, key: str) -> int:
        result: int = cache.get(self.make_cache_key(key), version=self.version)
        return result

    def set(self, key: str, value: int) -> None:
        cache.set(
            key=self.make_cache_key(key),
            value=value,
            timeout=self.randomized_ttl,
            version=self.version,
        )

    def get_many(self, keys: Sequence[str]) -> MutableMapping[str, Optional[int]]:
        cache_keys = {self.make_cache_key(key): key for key in keys}
        results: Mapping[str, Optional[int]] = cache.get_many(
            cache_keys.keys(), version=self.version
        )
        return self._format_results(keys, results)

    def set_many(self, key_values: Mapping[str, int]) -> None:
        cache_key_values = {self.make_cache_key(k): v for k, v in key_values.items()}
        cache.set_many(cache_key_values, timeout=self.randomized_ttl, version=self.version)

    def delete(self, key: str) -> None:
        cache_key = self.make_cache_key(key)
        cache.delete(cache_key, version=self.version)

    def delete_many(self, keys: Sequence[str]) -> None:
        cache_keys = [self.make_cache_key(key) for key in keys]
        cache.delete_many(cache_keys, version=self.version)


# todo: dont hard code 1 as the version
indexer_cache = StringIndexerCache(version=1)
