"""
sentry.models.tagkey
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import re

from django.db import models
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MAX_TAG_KEY_LENGTH, TAG_LABELS
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, FlexibleForeignKey, sane_repr
)
from sentry.db.models.manager import BaseManager
from sentry.utils.cache import cache

# Valid pattern for tag key names
TAG_KEY_RE = re.compile(r'^[a-zA-Z0-9_\.:-]+$')

# These tags are special and are used in pairing with `sentry:{}`
# they should not be allowed to be set via data ingest due to abiguity
INTERNAL_TAG_KEYS = frozenset(('release', 'user', 'filename', 'function'))


# TODO(dcramer): pull in enum library
class TagKeyStatus(object):
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class TagKeyManager(BaseManager):
    def _get_cache_key(self, project_id):
        return 'filterkey:all:%s' % project_id

    def all_keys(self, project):
        # TODO: cache invalidation via post_save/post_delete signals much like BaseManager
        key = self._get_cache_key(project.id)
        result = cache.get(key)
        if result is None:
            result = list(self.filter(
                project=project,
                status=TagKeyStatus.VISIBLE,
            ).order_by(
                '-values_seen'
            ).values_list('key', flat=True)[:20])
            cache.set(key, result, 60)
        return result


class TagKey(Model):
    """
    Stores references to available filters keys.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    values_seen = BoundedPositiveIntegerField(default=0)
    label = models.CharField(max_length=64, null=True)
    status = BoundedPositiveIntegerField(choices=(
        (TagKeyStatus.VISIBLE, _('Visible')),
        (TagKeyStatus.PENDING_DELETION, _('Pending Deletion')),
        (TagKeyStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
    ), default=TagKeyStatus.VISIBLE)

    objects = TagKeyManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_filterkey'
        unique_together = (('project', 'key'),)

    __repr__ = sane_repr('project_id', 'key')

    @classmethod
    def is_valid_key(self, key):
        return TAG_KEY_RE.match(key)

    @classmethod
    def is_reserved_key(self, key):
        return key in INTERNAL_TAG_KEYS

    @classmethod
    def get_standardized_key(cls, key):
        if key.startswith('sentry:'):
            return key.split('sentry:', 1)[-1]
        return key

    def get_label(self):
        return self.label \
            or TAG_LABELS.get(self.key) \
            or self.key.replace('_', ' ').title()

    def get_audit_log_data(self):
        return {
            'key': self.key,
        }
