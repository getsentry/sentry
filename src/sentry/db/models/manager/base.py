import logging
import threading
import weakref
from contextlib import contextmanager
from typing import Any, Generator, Generic, Mapping, MutableMapping, Optional, Sequence, Tuple

from django.conf import settings
from django.db import router
from django.db.models import Model
from django.db.models.manager import BaseManager as DjangoBaseManager
from django.db.models.signals import class_prepared, post_delete, post_init, post_save

from sentry.db.models.manager import M, make_key
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.db.models.query import create_or_update
from sentry.utils.cache import cache
from sentry.utils.compat import zip
from sentry.utils.hashlib import md5_text

logger = logging.getLogger("sentry")

_local_cache = threading.local()
_local_cache_generation = 0
_local_cache_enabled = False


class BaseManager(DjangoBaseManager.from_queryset(BaseQuerySet), Generic[M]):  # type: ignore
    lookup_handlers = {"iexact": lambda x: x.upper()}
    use_for_related_fields = True

    _queryset_class = BaseQuerySet

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        #: Model fields for which we should build up a cache to be used with
        #: Model.objects.get_from_cache(fieldname=value)`.
        #:
        #: Note that each field by its own needs to be a potential primary key
        #: (uniquely identify a row), so for example organization slug is ok,
        #: project slug is not.
        self.cache_fields = kwargs.pop("cache_fields", [])
        self.cache_ttl = kwargs.pop("cache_ttl", 60 * 5)
        self._cache_version: Optional[str] = kwargs.pop("cache_version", None)
        self.__local_cache = threading.local()
        super().__init__(*args, **kwargs)

    @staticmethod
    @contextmanager
    def local_cache() -> Generator[None, None, None]:
        """Enables local caching for the entire process."""
        global _local_cache_enabled, _local_cache_generation
        if _local_cache_enabled:
            raise RuntimeError("nested use of process global local cache")
        _local_cache_enabled = True
        try:
            yield
        finally:
            _local_cache_enabled = False
            _local_cache_generation += 1

    def _get_local_cache(self) -> Optional[MutableMapping[str, M]]:
        if not _local_cache_enabled:
            return None

        gen = _local_cache_generation
        cache_gen = getattr(_local_cache, "generation", None)

        if cache_gen != gen or not hasattr(_local_cache, "cache"):
            _local_cache.cache = {}
            _local_cache.generation = gen

        # Explicitly typing to satisfy mypy.
        cache_: MutableMapping[str, Any] = _local_cache.cache
        return cache_

    def _get_cache(self) -> MutableMapping[str, Any]:
        if not hasattr(self.__local_cache, "value"):
            self.__local_cache.value = weakref.WeakKeyDictionary()

        # Explicitly typing to satisfy mypy.
        cache_: MutableMapping[str, Any] = self.__local_cache.value
        return cache_

    def _set_cache(self, value: Any) -> None:
        self.__local_cache.value = value

    @property
    def cache_version(self) -> str:
        if self._cache_version is None:
            self._cache_version = md5_text(
                "&".join(sorted(f.attname for f in self.model._meta.fields))
            ).hexdigest()[:3]
        return self._cache_version

    __cache = property(_get_cache, _set_cache)

    def __getstate__(self) -> Mapping[str, Any]:
        d = self.__dict__.copy()
        # we can't serialize weakrefs
        d.pop("_BaseManager__cache", None)
        d.pop("_BaseManager__local_cache", None)
        return d

    def __setstate__(self, state: Mapping[str, Any]) -> None:
        self.__dict__.update(state)
        # TODO(typing): Basically everywhere else we set this to `threading.local()`.
        self.__local_cache = weakref.WeakKeyDictionary()  # type: ignore

    def __class_prepared(self, sender: Any, **kwargs: Any) -> None:
        """
        Given the cache is configured, connects the required signals for invalidation.
        """
        post_save.connect(self.post_save, sender=sender, weak=False)
        post_delete.connect(self.post_delete, sender=sender, weak=False)

        if not self.cache_fields:
            return

        post_init.connect(self.__post_init, sender=sender, weak=False)
        post_save.connect(self.__post_save, sender=sender, weak=False)
        post_delete.connect(self.__post_delete, sender=sender, weak=False)

    def __cache_state(self, instance: M) -> None:
        """
        Updates the tracked state of an instance.
        """
        if instance.pk:
            self.__cache[instance] = {
                f: self.__value_for_field(instance, f) for f in self.cache_fields
            }

    def __post_init(self, instance: M, **kwargs: Any) -> None:
        """
        Stores the initial state of an instance.
        """
        self.__cache_state(instance)

    def __post_save(self, instance: M, **kwargs: Any) -> None:
        """
        Pushes changes to an instance into the cache, and removes invalid (changed)
        lookup values.
        """
        pk_name = instance._meta.pk.name
        pk_names = ("pk", pk_name)
        pk_val = instance.pk
        for key in self.cache_fields:
            if key in pk_names:
                continue
            # store pointers
            value = self.__value_for_field(instance, key)
            cache.set(
                key=self.__get_lookup_cache_key(**{key: value}),
                value=pk_val,
                timeout=self.cache_ttl,
                version=self.cache_version,
            )

        # Ensure we don't serialize the database into the cache
        db = instance._state.db
        instance._state.db = None
        # store actual object
        try:
            cache.set(
                key=self.__get_lookup_cache_key(**{pk_name: pk_val}),
                value=instance,
                timeout=self.cache_ttl,
                version=self.cache_version,
            )
        except Exception as e:
            logger.error(e, exc_info=True)
        instance._state.db = db

        # Kill off any keys which are no longer valid
        if instance in self.__cache:
            for key in self.cache_fields:
                if key not in self.__cache[instance]:
                    continue
                value = self.__cache[instance][key]
                current_value = self.__value_for_field(instance, key)
                if value != current_value:
                    cache.delete(
                        key=self.__get_lookup_cache_key(**{key: value}), version=self.cache_version
                    )

        self.__cache_state(instance)

    def __post_delete(self, instance: M, **kwargs: Any) -> None:
        """
        Drops instance from all cache storages.
        """
        pk_name = instance._meta.pk.name
        for key in self.cache_fields:
            if key in ("pk", pk_name):
                continue
            # remove pointers
            value = self.__value_for_field(instance, key)
            cache.delete(
                key=self.__get_lookup_cache_key(**{key: value}), version=self.cache_version
            )
        # remove actual object
        cache.delete(
            key=self.__get_lookup_cache_key(**{pk_name: instance.pk}), version=self.cache_version
        )

    def __get_lookup_cache_key(self, **kwargs: Any) -> str:
        return make_key(self.model, "modelcache", kwargs)

    def __value_for_field(self, instance: M, key: str) -> Any:
        """
        Return the cacheable value for a field.

        ForeignKey's will cache via the primary key rather than using an
        instance ref. This is needed due to the way lifecycle of models works
        as otherwise we end up doing wasteful queries.
        """
        if key == "pk":
            return instance.pk
        field = instance._meta.get_field(key)
        return getattr(instance, field.attname)

    def contribute_to_class(self, model: M, name: str) -> None:
        super().contribute_to_class(model, name)
        class_prepared.connect(self.__class_prepared, sender=model)

    def get(self, *args: Any, **kwargs: Any) -> M:
        # Explicitly typing to satisfy mypy.
        model: M = super().get(*args, **kwargs)
        return model

    def get_from_cache(self, use_replica: bool = False, **kwargs: Any) -> M:
        """
        Wrapper around QuerySet.get which supports caching of the
        intermediate value.  Callee is responsible for making sure
        the cache key is cleared on save.
        """
        if not self.cache_fields or len(kwargs) > 1:
            raise ValueError("We cannot cache this query. Just hit the database.")

        key, value = next(iter(kwargs.items()))
        pk_name = self.model._meta.pk.name
        if key == "pk":
            key = pk_name

        # We store everything by key references (vs instances)
        if isinstance(value, Model):
            value = value.pk

        # Kill __exact since it's the default behavior
        if key.endswith("__exact"):
            key = key.split("__exact", 1)[0]

        if key in self.cache_fields or key == pk_name:
            cache_key = self.__get_lookup_cache_key(**{key: value})
            local_cache = self._get_local_cache()
            if local_cache is not None:
                result = local_cache.get(cache_key)
                if result is not None:
                    return result

            retval = cache.get(cache_key, version=self.cache_version)
            if retval is None:
                result = self.using_replica().get(**kwargs) if use_replica else self.get(**kwargs)
                # Ensure we're pushing it into the cache
                self.__post_save(instance=result)
                if local_cache is not None:
                    local_cache[cache_key] = result
                return result

            # If we didn't look up by pk we need to hit the reffed
            # key
            if key != pk_name:
                result = self.get_from_cache(**{pk_name: retval})
                if local_cache is not None:
                    local_cache[cache_key] = result
                return result

            if not isinstance(retval, self.model):
                if settings.DEBUG:
                    raise ValueError("Unexpected value type returned from cache")
                logger.error("Cache response returned invalid value %r", retval)
                result = self.using_replica().get(**kwargs) if use_replica else self.get(**kwargs)

            if key == pk_name and int(value) != retval.pk:
                if settings.DEBUG:
                    raise ValueError("Unexpected value returned from cache")
                logger.error("Cache response returned invalid value %r", retval)
                result = self.using_replica().get(**kwargs) if use_replica else self.get(**kwargs)

            kwargs = {**kwargs, "replica": True} if use_replica else {**kwargs}
            retval._state.db = router.db_for_read(self.model, **kwargs)

            # Explicitly typing to satisfy mypy.
            r: M = retval
            return r
        else:
            raise ValueError("We cannot cache this query. Just hit the database.")

    def get_many_from_cache(self, values: Sequence[str], key: str = "pk") -> Sequence[Any]:
        """
        Wrapper around `QuerySet.filter(pk__in=values)` which supports caching of
        the intermediate value.  Callee is responsible for making sure the
        cache key is cleared on save.

        NOTE: We can only query by primary key or some other unique identifier.
        It is not possible to e.g. run `Project.objects.get_many_from_cache([1,
        2, 3], key="organization_id")` and get back all projects belonging to
        those orgs. The length of the return value is bounded by the length of
        `values`.

        For most models, if one attempts to use a non-PK value this will just
        degrade to a DB query, like with `get_from_cache`.
        """

        pk_name = self.model._meta.pk.name

        if key == "pk":
            key = pk_name

        # Kill __exact since it's the default behavior
        if key.endswith("__exact"):
            key = key.split("__exact", 1)[0]

        if key not in self.cache_fields and key != pk_name:
            raise ValueError("We cannot cache this query. Just hit the database.")

        final_results = []
        cache_lookup_cache_keys = []
        cache_lookup_values = []

        local_cache = self._get_local_cache()
        for value in values:
            cache_key = self.__get_lookup_cache_key(**{key: value})
            result = local_cache and local_cache.get(cache_key)
            if result is not None:
                final_results.append(result)
            else:
                cache_lookup_cache_keys.append(cache_key)
                cache_lookup_values.append(value)

        if not cache_lookup_cache_keys:
            return final_results

        cache_results = cache.get_many(cache_lookup_cache_keys, version=self.cache_version)

        db_lookup_cache_keys = []
        db_lookup_values = []

        nested_lookup_cache_keys = []
        nested_lookup_values = []

        for cache_key, value in zip(cache_lookup_cache_keys, cache_lookup_values):
            cache_result = cache_results.get(cache_key)
            if cache_result is None:
                db_lookup_cache_keys.append(cache_key)
                db_lookup_values.append(value)
                continue

            # If we didn't look up by pk we need to hit the reffed key
            if key != pk_name:
                nested_lookup_cache_keys.append(cache_key)
                nested_lookup_values.append(cache_result)
                continue

            if not isinstance(cache_result, self.model):
                if settings.DEBUG:
                    raise ValueError("Unexpected value type returned from cache")
                logger.error("Cache response returned invalid value %r", cache_result)
                db_lookup_cache_keys.append(cache_key)
                db_lookup_values.append(value)
                continue

            if key == pk_name and int(value) != cache_result.pk:
                if settings.DEBUG:
                    raise ValueError("Unexpected value returned from cache")
                logger.error("Cache response returned invalid value %r", cache_result)
                db_lookup_cache_keys.append(cache_key)
                db_lookup_values.append(value)
                continue

            final_results.append(cache_result)

        if nested_lookup_values:
            nested_results = self.get_many_from_cache(nested_lookup_values, key=pk_name)
            final_results.extend(nested_results)
            if local_cache is not None:
                for nested_result in nested_results:
                    value = getattr(nested_result, key)
                    cache_key = self.__get_lookup_cache_key(**{key: value})
                    local_cache[cache_key] = nested_result

        if not db_lookup_values:
            return final_results

        cache_writes = []

        db_results = {getattr(x, key): x for x in self.filter(**{key + "__in": db_lookup_values})}
        for cache_key, value in zip(db_lookup_cache_keys, db_lookup_values):
            db_result = db_results.get(value)
            if db_result is None:
                continue  # This model ultimately does not exist

            # Ensure we're pushing it into the cache
            cache_writes.append(db_result)
            if local_cache is not None:
                local_cache[cache_key] = db_result

            final_results.append(db_result)

        # XXX: Should use set_many here, but __post_save code is too complex
        for instance in cache_writes:
            self.__post_save(instance=instance)

        return final_results

    def create_or_update(self, **kwargs: Any) -> Tuple[Any, bool]:
        return create_or_update(self.model, **kwargs)

    def uncache_object(self, instance_id: int) -> None:
        pk_name = self.model._meta.pk.name
        cache_key = self.__get_lookup_cache_key(**{pk_name: instance_id})
        cache.delete(cache_key, version=self.cache_version)

    def post_save(self, instance: M, **kwargs: Any) -> None:
        """
        Triggered when a model bound to this manager is saved.
        """

    def post_delete(self, instance: M, **kwargs: Any) -> None:
        """
        Triggered when a model bound to this manager is deleted.
        """

    def get_queryset(self) -> BaseQuerySet:
        """
        Returns a new QuerySet object.  Subclasses can override this method to
        easily customize the behavior of the Manager.
        """
        if hasattr(self, "_hints"):
            return self._queryset_class(self.model, using=self._db, hints=self._hints)
        return self._queryset_class(self.model, using=self._db)
