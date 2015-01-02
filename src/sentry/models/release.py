"""
sentry.models.release
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.
    """
    project = FlexibleForeignKey('sentry.Project')
    version = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_release'
        unique_together = (('project', 'version'),)

    __repr__ = sane_repr('project_id', 'version')
