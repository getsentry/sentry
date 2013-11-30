"""
sentry.models.projectcountbyminute
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db import models

from sentry.db.models import (
    Model, BoundedPositiveIntegerField, BaseManager, sane_repr
)


class ProjectCountByMinute(Model):
    """
    Stores the total number of messages seen by a project at N minute
    intervals.

    e.g. if it happened at 08:34:55 the time would be normalized to 08:30:00
    """

    project = models.ForeignKey('sentry.Project', null=True)
    date = models.DateTimeField()  # normalized to HH:MM:00
    times_seen = BoundedPositiveIntegerField(default=0)
    time_spent_total = BoundedPositiveIntegerField(default=0)
    time_spent_count = BoundedPositiveIntegerField(default=0)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectcountbyminute'
        unique_together = (('project', 'date'),)

    __repr__ = sane_repr('project_id', 'date')
