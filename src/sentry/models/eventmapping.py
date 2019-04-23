"""
sentry.models.groupmeta
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (BoundedBigIntegerField, Model, sane_repr)


class EventMapping(Model):
    __core__ = False

    project_id = BoundedBigIntegerField()
    group_id = BoundedBigIntegerField()
    event_id = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventmapping'
        unique_together = (('project_id', 'event_id'), )

    __repr__ = sane_repr('project_id', 'group_id', 'event_id')

    # Implement ForeignKey-like accessors for backwards compat
    @property
    def group(self):
        from sentry.models import Group
        return self.group_id and Group.objects.get_from_cache(id=self.group_id)

    @group.setter
    def group(self, group):
        self.group_id = group.id

    @property
    def project(self):
        from sentry.models import Project
        return self.project_id and Project.objects.get_from_cache(id=self.project_id)

    @project.setter
    def project(self, project):
        self.project_id = project.id
