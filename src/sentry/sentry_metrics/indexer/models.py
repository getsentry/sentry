import logging
import random
from typing import Any, Mapping, MutableMapping, Sequence, Union

from django.conf import settings
from django.db import connections, models, router
from django.utils import timezone

from sentry.db.models import Model
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.manager.base import BaseManager
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)


class MetricsKeyIndexer(Model):  # type: ignore
    __include_in_export__ = False

    string = models.CharField(max_length=200)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=("pk", "string"), cache_ttl=settings.SENTRY_METRICS_INDEXER_CACHE_TTL)  # type: ignore

    class Meta:
        db_table = "sentry_metricskeyindexer"
        app_label = "sentry"
        constraints = [
            models.UniqueConstraint(fields=["string"], name="unique_string"),
        ]

    @classmethod
    def get_next_values(cls, num: int) -> Any:
        using = router.db_for_write(cls)
        connection = connections[using].cursor()

        connection.execute(
            "SELECT nextval('sentry_metricskeyindexer_id_seq') from generate_series(1,%s)", [num]
        )
        return connection.fetchall()


class StringIndexer(Model):  # type: ignore
    __include_in_export__ = False

    string = models.CharField(max_length=200)
    organization_id = BoundedBigIntegerField()
    date_added = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    retention_days = models.IntegerField(default=90)

    class Meta:
        db_table = "sentry_stringindexer"
        app_label = "sentry"
        constraints = [
            models.UniqueConstraint(fields=["string", "organization_id"], name="unique_org_string"),
        ]


class StringIndexerCache:
    def __init__(self, model: Any, version: int):
        self.model = model
        self.version = version
        self.cache_ttl: int = settings.SENTRY_METRICS_INDEXER_CACHE_TTL

    @property
    def randomized_ttl(self) -> int:
        # introduce jitter in the cache_ttl so that when we have large
        # amount of new keys written into the cache, they don't expire all at once
        jitter = random.uniform(0, 0.25) * self.cache_ttl
        return int(self.cache_ttl + jitter)

    def make_cache_key(self, key: Union[str, int]) -> str:
        hashed = md5_text(key).hexdigest()
        # key is either the str => "org_id:string" or the id => 1
        if isinstance(key, int):
            cache_key = f"indexer:org:str:{hashed}"
        elif isinstance(key, str):
            cache_key = f"indexer:int:{hashed}"
        else:
            raise Exception("Invalid type: must be str or int")

        return cache_key

    def _format_results(
        self,
        keys: Sequence[Union[str, int]],
        results: Mapping[Union[str, int], Union[str, int, None]],
    ) -> MutableMapping[Union[str, int], Union[str, int, None]]:
        # make the results look like {"org_id:string": 3} or {id: "string"} instead of the
        # internally used hashed cache key e.g 'indexer:int:b0a0e436f6fa42b9e33e73befbdbb9ba'
        formatted: MutableMapping[Union[str, int], Union[str, int, None]] = {}
        for key in keys:
            cache_key = self.make_cache_key(key)
            formatted[key] = results.get(cache_key)

        return formatted

    def get(self, key: Union[str, int]) -> Union[str, int]:
        result: Union[str, int] = cache.get(self.make_cache_key(key), version=self.version)
        return result

    def set(self, key: Union[str, int], value: Union[str, int]) -> None:
        cache.set(
            key=self.make_cache_key(key),
            value=value,
            timeout=self.randomized_ttl,
            version=self.version,
        )

    def get_many(
        self, keys: Sequence[Union[str, int]]
    ) -> MutableMapping[Union[str, int], Union[str, int, None]]:
        cache_keys = {self.make_cache_key(key): key for key in keys}
        results: Mapping[Union[str, int], Union[str, int, None]] = cache.get_many(
            cache_keys.keys(), version=self.version
        )
        return self._format_results(keys, results)

    def set_many(self, key_values: Mapping[str, Union[str, int]]) -> None:
        cache_key_values = {self.make_cache_key(k): v for k, v in key_values.items()}
        cache.set_many(cache_key_values, timeout=self.randomized_ttl, version=self.version)

    def delete(self, key: Union[str, int]) -> None:
        cache_key = self.make_cache_key(key)
        cache.delete(cache_key)


# todo: dont hard code 1 as the version
indexer_cache = StringIndexerCache(StringIndexer, version=1)
