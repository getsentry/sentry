"""
sentry.models.grouptagkey
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models

from sentry.constants import MAX_TAG_KEY_LENGTH
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, BaseManager, FlexibleForeignKey,
    sane_repr
)


class GroupTagKey(Model):
    """
    Stores a unique tag key name for a group.

    An example key might be "url" or "server_name".
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    group = FlexibleForeignKey('sentry.Group')
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    values_seen = BoundedPositiveIntegerField(default=0)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_grouptagkey'
        unique_together = (('project', 'group', 'key'),)

    __repr__ = sane_repr('project_id', 'group_id', 'key')
