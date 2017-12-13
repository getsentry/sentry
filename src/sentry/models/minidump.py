"""
sentry.models.minidump
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import
from django.db import models
from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class MinidumpFile(Model):
    __core__ = False

    file = FlexibleForeignKey('sentry.File')
    event_id = models.CharField(max_length=36, unique=True)

    class Meta:
        db_table = 'sentry_minidumpfile'
        app_label = 'sentry'

    __repr__ = sane_repr('event_id')

    def delete(self, *args, **kwargs):
        super(MinidumpFile, self).delete(*args, **kwargs)
        self.file.delete()
