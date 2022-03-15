import logging
from typing import Any

from django.conf import settings
from django.db import connections, models, router
from django.utils import timezone

from sentry.db.models import Model
from sentry.db.models.manager import make_key
from sentry.db.models.manager.base import BaseManager
from sentry.utils.cache import cache

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


class StringIndexerManager(BaseManager):
    def __get_lookup_cache_key(self, **kwargs: Any) -> str:
        return make_key(self.model, "modelcache", kwargs)

    def get_items_from_cache(self, values, composite_key: str):
        # composite_key => project_id:string, project_id:id, etc
        # values => ["1:hello", "2:goodbye", "4:3"]
        fields = composite_key.split(":")
        fields_set = {*fields}

        if not fields_set.issubset({*self.cache_fields}):
            raise Exception("incorrect field names")

        final_results = []
        cache_lookup_cache_keys = []
        cache_lookup_values = []
        local_cache = self._get_local_cache()

        # Step 1. Check the local cache
        for value in values:
            cache_key = self.__get_lookup_cache_key(**{composite_key: value})

            result = local_cache and local_cache.get(cache_key)
            if result is not None:
                final_results.append(result)
            else:
                cache_lookup_cache_keys.append(cache_key)
                cache_lookup_values.append(value)

        if not cache_lookup_cache_keys:
            return final_results

        # Step 2. Check model cache (if we still need results)
        cache_results = cache.get_many(cache_lookup_cache_keys, version=self.cache_version)

        db_lookup_cache_keys_values = {}
        for field in fields:
            db_lookup_cache_keys_values[field] = []

        db_lookup_cache_keys = []
        db_lookup_cache_values = []

        for cache_key, value in zip(cache_lookup_cache_keys, cache_lookup_values):
            cache_result = cache_results.get(cache_key)
            if cache_result is None:
                db_lookup_cache_keys.append(cache_key)
                db_lookup_cache_values.append(value)
                values = value.split(":")
                for i, v in enumerate(values):
                    field = fields[i]
                    # todo check the field type instead
                    if field == ["project_id", "id"]:
                        v = int(v)
                    db_lookup_cache_keys_values[field].append(v)
                continue

            if not isinstance(cache_result, self.model):
                if settings.DEBUG:
                    raise ValueError("Unexpected value type returned from cache")
                logger.error("Cache response returned invalid value %r", cache_result)

                db_lookup_cache_keys.append(cache_key)
                values = value.split(":")
                for i, v in enumerate(values):
                    field = fields[i]
                    db_lookup_cache_keys_values[field].append(v)
                continue

            final_results.append(cache_result)

        if not db_lookup_cache_keys:
            return final_results

        # Step 3. Check the database (if we STILL need results)
        cache_writes = []
        db_filter_kwargs = {}
        for key_field, value_options in db_lookup_cache_keys_values.items():
            db_filter_kwargs[key_field + "__in"] = value_options

        # our results might contain more results than we actually want
        # so make sure we reconstruct the value pair
        db_results_dict = {}
        values_set = set(db_lookup_cache_values)
        for result in self.filter(**db_filter_kwargs):
            # if the composite key was "project_id:string"
            # this gets those fields from the instance and
            # turns it into composite_key form => "1:release"
            composite_key_value = ":".join([str(getattr(result, field)) for field in fields])
            # only add results if the instance can reconstruct
            # the value pair we passed in to begin with
            if composite_key_value in values_set:
                db_results_dict[composite_key_value] = result

        # Step 4. Write db look up into local cache and compile final_results
        for cache_key, value in zip(db_lookup_cache_keys, db_lookup_cache_values):
            db_result = db_results_dict.get(value)
            if db_result is None:
                continue

            cache_writes.append((value, db_result))
            if local_cache is not None:
                local_cache[cache_key] = db_result

            final_results.append(db_result)

        # Step 4. Write db look up into model cache
        for cw in cache_writes:
            value, instance = cw
            try:
                # todo use set many
                cache.set(
                    key=self.__get_lookup_cache_key(**{composite_key: value}),
                    value=instance,
                    timeout=self.cache_ttl,
                    version=self.cache_version,
                )
            except Exception as e:
                logger.error(e, exc_info=True)

        return final_results
