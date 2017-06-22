"""
sentry.models.rawevent
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BaseManager, Model, NodeField, FlexibleForeignKey, sane_repr
)


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
        unique_together = (('project', 'event_id'),)

    def get_data(self):
        rv = dict(self.data.data)
        # Under some rare circumstances the project or event_id might not
        # be correct in the data.  We have seen this in the past, most
        # likely where processing failed so late that something pulled
        # the data from it.  This will then fail in insert_data_to_database
        # when reprocessing triggers.
        rv['project'] = self.project_id
        rv['event_id'] = self.event_id
        return rv

    __repr__ = sane_repr('project_id')
