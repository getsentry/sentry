"""
sentry.models.groupassignee
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import Model, sane_repr


class GroupAssignee(Model):
    """
    Identifies an assignment relationship between a user and an
    aggregated event (Group).
    """
    project = models.ForeignKey('sentry.Project', related_name="assignee_set")
    group = models.ForeignKey('sentry.Group', related_name="assignee_set", unique=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="sentry_assignee_set")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupasignee'

    __repr__ = sane_repr('group_id', 'user_id')
