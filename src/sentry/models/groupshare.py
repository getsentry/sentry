"""
sentry.models.groupshare
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from uuid import uuid4

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, BaseManager, sane_repr


class GroupShare(Model):
    """
    A Group that was shared publicly.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    group = FlexibleForeignKey('sentry.Group', unique=True)
    uuid = models.CharField(max_length=32, unique=True, default=lambda: uuid4().hex)
    # Tracking the user that initiated the share.
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupshare'

    __repr__ = sane_repr('project_id', 'group_id', 'uuid')
