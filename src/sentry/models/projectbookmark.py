"""
sentry.models.groupbookmark
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField, FlexibleForeignKey, Model, BaseManager, sane_repr
)


class ProjectBookmark(Model):
    """
    Identifies a bookmark relationship between a user and an
    aggregated event (Group).
    """
    __core__ = True

    project_id = BoundedBigIntegerField(blank=True, null=True)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectbookmark'
        unique_together = (('project_id', 'user',))

    __repr__ = sane_repr('project_id', 'user_id')
