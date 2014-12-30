"""
sentry.models.groupmeta
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class EventMapping(Model):
    project = FlexibleForeignKey('sentry.Project')
    group = FlexibleForeignKey('sentry.Group')
    event_id = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventmapping'
        unique_together = (('project', 'event_id'),)

    __repr__ = sane_repr('project_id', 'group_id', 'event_id')

    @property
    def team(self):
        return self.project.team
