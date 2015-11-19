from __future__ import absolute_import

from django.db import models
from sentry.db.models import Model, FlexibleForeignKey, sane_repr


class GroupSnooze(Model):
    __core__ = False

    group = FlexibleForeignKey('sentry.Group', unique=True)
    until = models.DateTimeField()

    class Meta:
        db_table = 'sentry_groupsnooze'
        app_label = 'sentry'

    __repr__ = sane_repr('group_id')
