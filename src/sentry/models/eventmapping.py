"""
sentry.models.groupmeta
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from functools32 import lru_cache

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

    @staticmethod
    @lru_cache(maxsize=100)
    def get_project(project_id):
        from sentry.models import Project
        return project_id and Project.objects.get(id=project_id)

    @staticmethod
    @lru_cache(maxsize=100)
    def get_group(group_id):
        from sentry.models import Group
        return group_id and Group.objects.get(id=group_id)

    # Implement a ForeignKey-like accessor for backwards compat
    @property
    def group(self):
        return self.get_group(self.group_id)

    @group.setter
    def group(self, group):
        self.group_id = group.id

    # Implement a ForeignKey-like accessor for backwards compat
    @property
    def project(self):
        return self.get_project(self.project_id)

    @project.setter
    def project(self, project):
        self.project_id = project.id
