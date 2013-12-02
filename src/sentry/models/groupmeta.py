"""
sentry.models.groupmeta
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db import models

from sentry.db.models import Model, sane_repr
from sentry.manager import InstanceMetaManager


class GroupMeta(Model):
    """
    Arbitrary key/value store for Groups.

    Generally useful for things like storing metadata
    provided by plugins.
    """
    group = models.ForeignKey('sentry.Group')
    key = models.CharField(max_length=64)
    value = models.TextField()

    objects = InstanceMetaManager('group')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupmeta'
        unique_together = (('group', 'key'),)

    __repr__ = sane_repr('group_id', 'key', 'value')
