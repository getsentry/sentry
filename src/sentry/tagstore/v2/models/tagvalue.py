"""
sentry.tagstore.v2.models.tagvalue
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import six

from django.db import models, router, connections
from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.constants import MAX_TAG_VALUE_LENGTH
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, BoundedBigIntegerField, GzippedDictField,
    FlexibleForeignKey, sane_repr
)
from sentry.tagstore.query import TagStoreManager
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text


class TagValue(Model):
    """
    Stores references to available filters.
    """
    __core__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    _key = FlexibleForeignKey('tagstore.TagKey', db_column='key_id')
    value = models.CharField(max_length=MAX_TAG_VALUE_LENGTH)
    data = GzippedDictField(blank=True, null=True)
    times_seen = BoundedPositiveIntegerField(default=0)
    last_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)

    objects = TagStoreManager()

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', '_key', 'value'), )
        index_together = (('project_id', '_key', 'last_seen'), )

    __repr__ = sane_repr('project_id', '_key_id', 'value')

    def delete(self):
        using = router.db_for_read(TagValue)
        cursor = connections[using].cursor()
        cursor.execute(
            """
            DELETE FROM tagstore_tagvalue
            WHERE project_id = %s
              AND id = %s
        """, [self.project_id, self.id]
        )

    @property
    def key(self):
        if hasattr(self, '_set_key'):
            return self._set_key

        if hasattr(self, '__key_cache'):
            return self._key.key

        # fallback
        from sentry.tagstore.v2.models import TagKey

        tk = TagKey.objects.filter(
            project_id=self.project_id,
            id=self._key_id,
        ).values_list('key', flat=True).get()

        # cache for future calls
        self.key = tk

        return tk

    @key.setter
    def key(self, key):
        self._set_key = key

    def get_label(self):
        from sentry import tagstore

        return tagstore.get_tag_value_label(self.key, self.value)

    @classmethod
    def get_cache_key(cls, project_id, _key_id, value):
        return 'tagvalue:1:%s:%s:%s' % (project_id, _key_id, md5_text(value).hexdigest())

    @classmethod
    def get_or_create(cls, project_id, _key_id, value, **kwargs):
        cache_key = cls.get_cache_key(project_id, _key_id, value)

        rv = cache.get(cache_key)
        created = False
        if rv is None:
            rv, created = cls.objects.get_or_create(
                project_id=project_id,
                _key_id=_key_id,
                value=value,
                **kwargs
            )
            cache.set(cache_key, rv, 3600)

        return rv, created

    @classmethod
    def get_or_create_bulk(cls, project_id, tags):
        # Attempt to create a bunch of models in one big batch with as few
        # queries and cache calls as possible.
        # In best case, this is all done in 1 cache get.
        # If we miss cache hit here, we have to fall back to old behavior.
        key_to_model = {tag: None for tag in tags}
        tags_by_key_id = {tag[0].id: tag for tag in tags}
        remaining_keys = set(tags)

        # First attempt to hit from cache, which in theory is the hot case
        cache_key_to_key = {cls.get_cache_key(project_id, tk.id, v): (tk, v) for tk, v in tags}
        cache_key_to_models = cache.get_many(cache_key_to_key.keys())
        for model in cache_key_to_models.values():
            key_to_model[tags_by_key_id[model._key_id]] = model
            remaining_keys.remove(tags_by_key_id[model._key_id])

        if not remaining_keys:
            # 100% cache hit on all items, good work team
            return key_to_model

        # Fall back to just doing it manually
        # Further optimizations start to become not so great.
        # For some reason, when trying to do a bulk SELECT with all of the
        # key value pairs in big OR ends up using the wrong index and ultimating
        # generating a significantly less efficient query. The only alternative is to
        # splice this up a bit and do all of the SELECTs, then do a bulk INSERT for remaining
        for key in remaining_keys:
            key_to_model[key] = cls.get_or_create(project_id, key[0].id, key[1])[0]

        return key_to_model


@register(TagValue)
class TagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        from sentry import tagstore

        result = {}
        for item in item_list:
            result[item] = {
                'name': tagstore.get_tag_value_label(item.key, item.value),
            }
        return result

    def serialize(self, obj, attrs, user):
        from sentry import tagstore

        return {
            'id': six.text_type(obj.id),
            'key': tagstore.get_standardized_key(obj.key),
            'name': attrs['name'],
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }
