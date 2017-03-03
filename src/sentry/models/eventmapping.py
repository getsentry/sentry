"""
sentry.models.groupmeta
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField, Model, sane_repr
)


class EventMapping(Model):
    __core__ = False

    project_id = BoundedBigIntegerField()
    group_id = BoundedBigIntegerField()
    event_id = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventmapping'
        unique_together = (('project_id', 'event_id'),)

    __repr__ = sane_repr('project_id', 'group_id', 'event_id')

    @property
    def team(self):
        return self.project.team

    # Implement a ForeignKey-like accessor for backwards compat
    def _set_group(self, group):
        self.group_id = group.id
        self._group_cache = group

    def _get_group(self):
        from sentry.models import Group
        if not hasattr(self, '_group_cache'):
            self._group_cache = Group.objects.get(id=self.group_id)
        return self._group_cache

    group = property(_get_group, _set_group)

    # Implement a ForeignKey-like accessor for backwards compat
    def _set_project(self, project):
        self.project_id = project.id
        self._project_cache = project

    def _get_project(self):
        from sentry.models import Project
        if not hasattr(self, '_project_cache'):
            self._project_cache = Project.objects.get(id=self.project_id)
        return self._project_cache

    project = property(_get_project, _set_project)
