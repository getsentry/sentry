from __future__ import absolute_import
from django.db import models
from django.utils import timezone

from sentry.db.models import (FlexibleForeignKey, Model, sane_repr)


class ReleaseProjectEnvironment(Model):
    __core__ = False

    release = FlexibleForeignKey('sentry.Release')
    project = FlexibleForeignKey('sentry.Project')
    environment = FlexibleForeignKey('sentry.Environment')
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_releaseprojectenvironment'
        unique_together = (('project', 'release', 'environment'), )

    __repr__ = sane_repr('project', 'release', 'environment')
