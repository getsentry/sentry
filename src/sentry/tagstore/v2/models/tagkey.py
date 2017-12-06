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
from sentry.constants import MAX_TAG_KEY_LENGTH
from sentry.db.models import (Model, BoundedPositiveIntegerField, sane_repr)


class TagKey(Model):
    """
    Stores references to available filters keys.
    """
    __core__ = False

    project_id = BoundedPositiveIntegerField(db_index=True)
    environment_id = BoundedPositiveIntegerField(null=True)
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

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', 'environment_id', 'key'), )
        # TODO: environment index(es)

    __repr__ = sane_repr('project_id', 'environment_id', 'key')

    def get_label(self):
        from sentry import tagstore

        return tagstore.get_tag_key_label(self.key)

    def get_audit_log_data(self):
        return {
            'key': self.key,
        }


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
