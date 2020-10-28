from __future__ import absolute_import, print_function

import logging
import six
import threading
import weakref

from contextlib import contextmanager

from django.conf import settings
from django.db import router
from django.db.models import Model
from django.db.models.manager import Manager, QuerySet
from django.db.models.signals import post_save, post_delete, post_init, class_prepared
from django.core.signals import request_finished
from django.utils.encoding import smart_text
from celery.signals import task_postrun

from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

from .query import create_or_update
from sentry.utils.compat import zip

__all__ = ("BaseManager", "OptionManager")

logger = logging.getLogger("sentry")


_local_cache = threading.local()
_local_cache_generation = 0
_local_cache_enabled = False


def __prep_value(model, key, value):
    if isinstance(value, Model):
        value = value.pk
    else:
        value = six.text_type(value)
    return value


def __prep_key(model, key):
    if key == "pk":
        return model._meta.pk.name
    return key


def make_key(model, prefix, kwargs):
    kwargs_bits = []
    for k, v in sorted(six.iteritems(kwargs)):
        k = __prep_key(model, k)
        v = smart_text(__prep_value(model, k, v))
        kwargs_bits.append("%s=%s" % (k, v))
    kwargs_bits = ":".join(kwargs_bits)

    return "%s:%s:%s" % (prefix, model.__name__, md5_text(kwargs_bits).hexdigest())


class BaseQuerySet(QuerySet):
    # XXX(dcramer): we prefer values_list, but we cant disable values as Django uses it
    # internally
    # def values(self, *args, **kwargs):
    #     raise NotImplementedError('Use ``values_list`` instead [performance].')

    def defer(self, *args, **kwargs):
        raise NotImplementedError("Use ``values_list`` instead [performance].")

    def only(self, *args, **kwargs):
        # In rare cases Django can use this if a field is unexpectedly deferred. This
        # mostly can happen if a field is added to a model, and then an old pickle is
        # passed to a process running the new code. So if you see this error after a
        # deploy of a model with a new field, it'll likely fix itself post-deploy.
        raise NotImplementedError("Use ``values_list`` instead [performance].")


class BaseManager(Manager):
    lookup_handlers = {"iexact": lambda x: x.upper()}
    use_for_related_fields = True

    _queryset_class = BaseQuerySet

    def __init__(self, *args, **kwargs):
        #: Model fields for which we should build up a cache to be used with
        #: Model.objects.get_from_cache(fieldname=value)`.
        #:
        #: Note that each field by its own needs to be a potential primary key
        #: (uniquely identify a row), so for example organization slug is ok,
        #: project slug is not.
        self.cache_fields = kwargs.pop("cache_fields", [])
        self.cache_ttl = kwargs.pop("cache_ttl", 60 * 5)
        self._cache_version = kwargs.pop("cache_version", None)
        self.__local_cache = threading.local()
        super(BaseManager, self).__init__(*args, **kwargs)

    @staticmethod
    @contextmanager
    def local_cache():
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

    def _get_local_cache(self):
        if not _local_cache_enabled:
            return

        gen = _local_cache_generation
        cache_gen = getattr(_local_cache, "generation", None)

        if cache_gen != gen or not hasattr(_local_cache, "cache"):
            _local_cache.cache = {}
            _local_cache.generation = gen

        return _local_cache.cache

    def _get_cache(self):
        if not hasattr(self.__local_cache, "value"):
            self.__local_cache.value = weakref.WeakKeyDictionary()
        return self.__local_cache.value

    def _set_cache(self, value):
        self.__local_cache.value = value

    @property
    def cache_version(self):
        if self._cache_version is None:
            self._cache_version = md5_text(
                "&".join(sorted(f.attname for f in self.model._meta.fields))
            ).hexdigest()[:3]
        return self._cache_version

    __cache = property(_get_cache, _set_cache)

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop("_BaseManager__cache", None)
        d.pop("_BaseManager__local_cache", None)
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__local_cache = weakref.WeakKeyDictionary()

    def __class_prepared(self, sender, **kwargs):
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

    def __cache_state(self, instance):
        """
        Updates the tracked state of an instance.
        """
        if instance.pk:
            self.__cache[instance] = {
                f: self.__value_for_field(instance, f) for f in self.cache_fields
            }

    def __post_init(self, instance, **kwargs):
        """
        Stores the initial state of an instance.
        """
        self.__cache_state(instance)

    def __post_save(self, instance, **kwargs):
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

    def __post_delete(self, instance, **kwargs):
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

    def __get_lookup_cache_key(self, **kwargs):
        return make_key(self.model, "modelcache", kwargs)

    def __value_for_field(self, instance, key):
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

    def contribute_to_class(self, model, name):
        super(BaseManager, self).contribute_to_class(model, name)
        class_prepared.connect(self.__class_prepared, sender=model)

    def get_from_cache(self, **kwargs):
        """
        Wrapper around QuerySet.get which supports caching of the
        intermediate value.  Callee is responsible for making sure
        the cache key is cleared on save.
        """
        if not self.cache_fields or len(kwargs) > 1:
            raise ValueError("We cannot cache this query. Just hit the database.")

        key, value = next(six.iteritems(kwargs))
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
                result = self.get(**kwargs)
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
                return self.get(**kwargs)

            if key == pk_name and int(value) != retval.pk:
                if settings.DEBUG:
                    raise ValueError("Unexpected value returned from cache")
                logger.error("Cache response returned invalid value %r", retval)
                return self.get(**kwargs)

            retval._state.db = router.db_for_read(self.model, **kwargs)

            return retval
        else:
            raise ValueError("We cannot cache this query. Just hit the database.")

    def get_many_from_cache(self, values, key="pk"):
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

    def create_or_update(self, **kwargs):
        return create_or_update(self.model, **kwargs)

    def uncache_object(self, instance_id):
        pk_name = self.model._meta.pk.name
        cache_key = self.__get_lookup_cache_key(**{pk_name: instance_id})
        cache.delete(cache_key, version=self.cache_version)

    def post_save(self, instance, **kwargs):
        """
        Triggered when a model bound to this manager is saved.
        """

    def post_delete(self, instance, **kwargs):
        """
        Triggered when a model bound to this manager is deleted.
        """

    def get_queryset(self):
        """
        Returns a new QuerySet object.  Subclasses can override this method to
        easily customize the behavior of the Manager.
        """
        if hasattr(self, "_hints"):
            return self._queryset_class(self.model, using=self._db, hints=self._hints)
        return self._queryset_class(self.model, using=self._db)


class OptionManager(BaseManager):
    @property
    def _option_cache(self):
        if not hasattr(_local_cache, "option_cache"):
            _local_cache.option_cache = {}
        return _local_cache.option_cache

    def clear_local_cache(self, **kwargs):
        self._option_cache.clear()

    def contribute_to_class(self, model, name):
        super(OptionManager, self).contribute_to_class(model, name)
        task_postrun.connect(self.clear_local_cache)
        request_finished.connect(self.clear_local_cache)

    def _make_key(self, instance_id):
        assert instance_id
        return u"%s:%s" % (self.model._meta.db_table, instance_id)
