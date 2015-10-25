"""
sentry.db.models.manager
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import logging
import six
import threading
import weakref

from django.conf import settings
from django.db import router
from django.db.models import Manager, Model
from django.db.models.signals import (
    post_save, post_delete, post_init, class_prepared)
from django.utils.encoding import smart_str
from hashlib import md5

from sentry.utils.cache import cache

from .query import create_or_update

__all__ = ('BaseManager',)

logger = logging.getLogger('sentry')


class ImmutableDict(dict):
    def __setitem__(self, key, value):
        raise TypeError

    def __delitem__(self, key):
        raise TypeError

UNSAVED = ImmutableDict()


def __prep_value(model, key, value):
    if isinstance(value, Model):
        value = value.pk
    else:
        value = six.text_type(value)
    return value


def __prep_key(model, key):
    if key == 'pk':
        return model._meta.pk.name
    return key


def make_key(model, prefix, kwargs):
    kwargs_bits = []
    for k, v in sorted(kwargs.iteritems()):
        k = __prep_key(model, k)
        v = smart_str(__prep_value(model, k, v))
        kwargs_bits.append('%s=%s' % (k, v))
    kwargs_bits = ':'.join(kwargs_bits)

    return '%s:%s:%s' % (prefix, model.__name__, md5(kwargs_bits).hexdigest())


class BaseManager(Manager):
    lookup_handlers = {
        'iexact': lambda x: x.upper(),
    }
    use_for_related_fields = True

    def __init__(self, *args, **kwargs):
        self.cache_fields = kwargs.pop('cache_fields', [])
        self.cache_ttl = kwargs.pop('cache_ttl', 60 * 5)
        self.cache_version = kwargs.pop('cache_version', None)
        self.__local_cache = threading.local()
        super(BaseManager, self).__init__(*args, **kwargs)

    def _get_cache(self):
        if not hasattr(self.__local_cache, 'value'):
            self.__local_cache.value = weakref.WeakKeyDictionary()
        return self.__local_cache.value

    def _set_cache(self, value):
        self.__local_cache.value = value

    def _generate_cache_version(self):
        return md5(
            '&'.join(sorted(f.attname for f in self.model._meta.fields))
        ).hexdigest()[:3]

    __cache = property(_get_cache, _set_cache)

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_BaseManager__cache', None)
        d.pop('_BaseManager__local_cache', None)
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

        if not self.cache_version:
            self.cache_version = self._generate_cache_version()

        post_init.connect(self.__post_init, sender=sender, weak=False)
        post_save.connect(self.__post_save, sender=sender, weak=False)
        post_delete.connect(self.__post_delete, sender=sender, weak=False)

    def __cache_state(self, instance):
        """
        Updates the tracked state of an instance.
        """
        if instance.pk:
            self.__cache[instance] = {
                f: self.__value_for_field(instance, f)
                for f in self.cache_fields
            }
        else:
            self.__cache[instance] = UNSAVED

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
        pk_names = ('pk', pk_name)
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
                        key=self.__get_lookup_cache_key(**{key: value}),
                        version=self.cache_version,
                    )

        self.__cache_state(instance)

    def __post_delete(self, instance, **kwargs):
        """
        Drops instance from all cache storages.
        """
        pk_name = instance._meta.pk.name
        for key in self.cache_fields:
            if key in ('pk', pk_name):
                continue
            # remove pointers
            value = self.__value_for_field(instance, key)
            cache.delete(
                key=self.__get_lookup_cache_key(**{key: value}),
                version=self.cache_version,
            )
        # remove actual object
        cache.delete(
            key=self.__get_lookup_cache_key(**{pk_name: instance.pk}),
            version=self.cache_version,
        )

    def __get_lookup_cache_key(self, **kwargs):
        return make_key(self.model, 'modelcache', kwargs)

    def __value_for_field(self, instance, key):
        """
        Return the cacheable value for a field.

        ForeignKey's will cache via the primary key rather than using an
        instance ref. This is needed due to the way lifecycle of models works
        as otherwise we end up doing wasteful queries.
        """
        if key == 'pk':
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
            return self.get(**kwargs)

        key, value = kwargs.items()[0]
        pk_name = self.model._meta.pk.name
        if key == 'pk':
            key = pk_name

        # We store everything by key references (vs instances)
        if isinstance(value, Model):
            value = value.pk

        # Kill __exact since it's the default behavior
        if key.endswith('__exact'):
            key = key.split('__exact', 1)[0]

        if key in self.cache_fields or key == pk_name:
            cache_key = self.__get_lookup_cache_key(**{key: value})

            retval = cache.get(cache_key, version=self.cache_version)
            if retval is None:
                result = self.get(**kwargs)
                # Ensure we're pushing it into the cache
                self.__post_save(instance=result)
                return result

            # If we didn't look up by pk we need to hit the reffed
            # key
            if key != pk_name:
                return self.get_from_cache(**{pk_name: retval})

            if type(retval) != self.model:
                if settings.DEBUG:
                    raise ValueError('Unexpected value type returned from cache')
                logger.error('Cache response returned invalid value %r', retval)
                return self.get(**kwargs)

            if key == pk_name and int(value) != retval.pk:
                if settings.DEBUG:
                    raise ValueError('Unexpected value returned from cache')
                logger.error('Cache response returned invalid value %r', retval)
                return self.get(**kwargs)

            retval._state.db = router.db_for_read(self.model, **kwargs)

            return retval
        else:
            return self.get(**kwargs)

    def create_or_update(self, **kwargs):
        return create_or_update(self.model, **kwargs)

    def bind_nodes(self, object_list, *node_names):
        from sentry.app import nodestore

        object_node_list = []
        for name in node_names:
            object_node_list.extend((
                (i, getattr(i, name))
                for i in object_list
                if getattr(i, name).id
            ))

        node_ids = [n.id for _, n in object_node_list]
        if not node_ids:
            return

        node_results = nodestore.get_multi(node_ids)

        for item, node in object_node_list:
            data = node_results.get(node.id) or {}
            node.bind_data(data, ref=node.get_ref(item))

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
