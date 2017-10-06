"""
sentry.models.rawevent
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (BaseManager, Model, NodeField, FlexibleForeignKey, sane_repr)


class RawEvent(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    event_id = models.CharField(max_length=32, null=True)
    datetime = models.DateTimeField(default=timezone.now)
    data = NodeField(
        blank=True,
        null=True,
        ref_func=lambda x: x.project_id or x.project.id,
        ref_version=1,
    )

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_rawevent'
        unique_together = (('project', 'event_id'), )

    __repr__ = sane_repr('project_id')
