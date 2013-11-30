"""
sentry.models.tagkey
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db import models

from sentry.constants import MAX_TAG_KEY_LENGTH
from sentry.db.models import Model, BoundedPositiveIntegerField, sane_repr
from sentry.manager import TagKeyManager


class TagKey(Model):
    """
    Stores references to available filters keys.
    """
    project = models.ForeignKey('sentry.Project')
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    values_seen = BoundedPositiveIntegerField(default=0)
    label = models.CharField(max_length=64, null=True)

    objects = TagKeyManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_filterkey'
        unique_together = (('project', 'key'),)

    __repr__ = sane_repr('project_id', 'key')

    def get_label(self):
        return self.label or self.key.replace('_', ' ').title()
