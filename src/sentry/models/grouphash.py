"""
sentry.models.grouphash
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models

from sentry.db.models import FlexibleForeignKey, Model


class GroupHash(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    hash = models.CharField(max_length=32)
    group = FlexibleForeignKey('sentry.Group', null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_grouphash'
        unique_together = (('project', 'hash'),)
