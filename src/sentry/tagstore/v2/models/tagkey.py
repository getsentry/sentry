"""
sentry.tagstore.v2.models.tagkey
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import six

from django.db import models
from django.utils.translation import ugettext_lazy as _

from sentry.api.serializers import Serializer, register
from sentry.tagstore import TagKeyStatus
from sentry.tagstore.query import TagStoreManager
from sentry.constants import MAX_TAG_KEY_LENGTH
from sentry.db.models import (Model, BoundedPositiveIntegerField, BoundedBigIntegerField, sane_repr)
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text


class TagKey(Model):
    """
    Stores references to available filters keys.
    """
    __core__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    environment_id = BoundedBigIntegerField()
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    values_seen = BoundedPositiveIntegerField(default=0)
    status = BoundedPositiveIntegerField(
        choices=(
            (TagKeyStatus.VISIBLE, _('Visible')),
            (TagKeyStatus.PENDING_DELETION, _('Pending Deletion')),
            (TagKeyStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
        ),
        default=TagKeyStatus.VISIBLE
    )

    objects = TagStoreManager()

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', 'environment_id', 'key'), )

    __repr__ = sane_repr('project_id', 'environment_id', 'key')

    def get_label(self):
        from sentry import tagstore

        return tagstore.get_tag_key_label(self.key)

    def get_audit_log_data(self):
        return {
            'key': self.key,
        }

    @classmethod
    def get_cache_key(cls, project_id, environment_id, key):
        return 'tagkey:1:%s:%s:%s' % (project_id, environment_id, md5_text(key).hexdigest())

    @classmethod
    def get_or_create(cls, project_id, environment_id, key, **kwargs):
        cache_key = cls.get_cache_key(project_id, environment_id, key)

        rv = cache.get(cache_key)
        created = False
        if rv is None:
            rv, created = cls.objects.get_or_create(
                project_id=project_id,
                environment_id=environment_id,
                key=key,
                **kwargs
            )
            cache.set(cache_key, rv, 3600)

        return rv, created


@register(TagKey)
class TagKeySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        from sentry import tagstore

        return {
            'id': six.text_type(obj.id),
            'key': tagstore.get_standardized_key(obj.key),
            'name': tagstore.get_tag_key_label(obj.key),
            'uniqueValues': obj.values_seen,
        }
