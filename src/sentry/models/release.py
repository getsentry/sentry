"""
sentry.models.release
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from jsonfield import JSONField

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    version = models.CharField(max_length=64)
    # ref might be the branch name being released
    ref = models.CharField(max_length=64, null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    date_added = models.DateTimeField(default=timezone.now)
    date_started = models.DateTimeField(null=True, blank=True)
    date_released = models.DateTimeField(null=True, blank=True)
    # arbitrary data recorded with the release
    data = JSONField(default={})

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_release'
        unique_together = (('project', 'version'),)

    __repr__ = sane_repr('project_id', 'version')
