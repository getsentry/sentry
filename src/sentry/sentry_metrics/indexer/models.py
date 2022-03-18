import logging
from typing import Any, Mapping, Sequence, Union

from django.conf import settings
from django.db import connections, models, router
from django.utils import timezone

from sentry.db.models import Model
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.manager.base import BaseManager
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)

_INDEXER_CACHE_METRIC = "sentry_metrics.indexer.memcache"


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

    @classmethod
    def get_many_ids(cls, keys) -> Mapping[str, str]:
        # keys => "organization_id:string"
        final_results = {}
        cache_results = indexer_cache.get_many(keys, field_type=str)
        # {"key" => result}
        db_look_up_keys = set()
        for key in keys:
            cache_key = indexer_cache.make_cache_key(key, field_type=str)
            result = cache_results.get(cache_key)
            if not result:
                db_look_up_keys.add(key)

            final_results[key] = result

        cache_hits = len(final_results.keys())
        cache_misses = len(db_look_up_keys)
        # todo q: should this have an extra tag to know its from the write path?
        metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "true"}, amount=cache_hits)
        metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "false"}, amount=cache_misses)

        if not db_look_up_keys:
            return final_results

        db_results = cls.get_db_ids_and_set_cache(db_look_up_keys)
        final_results.update(db_results)

        return final_results

    @classmethod
    def record_many_strings(cls, keys):
        records = []
        for key in keys:
            organization_id, string = key.split(":")
            records.append(cls(organization_id=int(organization_id), string=string))

        with metrics.timer("sentry_metrics.indexer.pg_bulk_create"):
            cls.objects.bulk_create(records, ignore_conflicts=True)

        return cls.get_db_ids_and_set_cache(keys)

    @classmethod
    def get_db_ids_and_set_cache(cls, keys):
        org_ids = []
        strings = []
        for key in keys:
            organization_id, string = key.split(":")
            org_ids.append(int(organization_id))
            strings.append(string)

        db_objects = cls.objects.filter(
            organization_id__in=org_ids,
            string__in=strings,
        )
        db_results = {}
        reverse_db_results = {}
        for db_result in db_objects:
            key = f"{db_result.organization_id}:{db_result.string}"
            if key in keys:
                db_results[key] = db_result.id
                reverse_key = f"{db_result.organization_id}:{db_result.id}"
                reverse_db_results[reverse_key] = db_result.string

        indexer_cache.set_many(db_results, field_type=str)
        indexer_cache.set_many(reverse_db_results, field_type=int)
        return db_results

    @classmethod
    def get_id(cls, org_id, string) -> int:
        key = f"{org_id}:{string}"
        result = indexer_cache.get(key, field_type=str)
        if result:
            metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "true"})
            return result

        metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "false"})
        db_result = cls.objects.get(organization_id=org_id, string=string).id
        indexer_cache.set(key, db_result, field_type=str)

        return db_result

    @classmethod
    def get_string(cls, org_id, id) -> str:
        key = f"{org_id}:{id}"
        result = indexer_cache.get(key, field_type=str)
        if result:
            metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "true"})
            return result

        metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "false"})
        db_result = cls.objects.get(organization_id=org_id, id=id).string
        indexer_cache.set(key, db_result, field_type=int)

        return db_result

    def delete(self, **kwargs):
        # TODO(meredith): remove from cache on delete.
        # maybe should be done with post_delete signal instead
        return super().delete(**kwargs)


class StringIndexerCache:
    def __init__(self, model, version):
        self.model = model
        self.version = version
        self.cache_ttl = settings.SENTRY_METRICS_INDEXER_CACHE_TTL

    def make_cache_key(self, key: str, field_type: type) -> str:
        hashed = md5_text(key).hexdigest()
        if field_type == int:
            cache_key = f"indexer:org:int:{hashed}"
        elif field_type == str:
            cache_key = f"indexer:org:str:{hashed}"
        else:
            raise Exception("Invalid type: must be str or int")

        return cache_key

    def get(self, key: str, field_type: type):
        return cache.get(self.make_cache_key(key, field_type), version=self.version)

    def set(self, key: str, value: Union[str, int], field_type: type):
        return cache.set(
            key=self.make_cache_key(key, field_type),
            value=value,
            timeout=self.cache_ttl,
            version=self.version,
        )

    def get_many(self, keys: Sequence[str], field_type: type):
        cache_keys = [self.make_cache_key(key, field_type) for key in keys]
        return cache.get_many(cache_keys, version=self.version)

    def set_many(self, key_values: Mapping[str, Union[str, int]], field_type: type):
        cache_key_values = {self.make_cache_key(k, field_type): v for k, v in key_values.items()}
        # TODO(meredith): introduce jitter in the cache_ttl so that when we have large
        # amount of new keys written into the cache, they don't expire all at once
        return cache.set_many(cache_key_values, timeout=self.cache_ttl, version=self.version)


# todo: dont hard code 1 as the version
indexer_cache = StringIndexerCache(StringIndexer, version=1)
