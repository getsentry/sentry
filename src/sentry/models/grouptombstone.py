from __future__ import absolute_import

import logging

from django.db import models

from sentry.constants import LOG_LEVELS, MAX_CULPRIT_LENGTH
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model


class GroupTombstone(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    level = BoundedPositiveIntegerField(
        choices=LOG_LEVELS.items(), default=logging.ERROR, blank=True,
        db_index=True)
    message = models.TextField()
    culprit = models.CharField(
        max_length=MAX_CULPRIT_LENGTH, blank=True, null=True,
    )
    type = models.TextField()
    actor_id = BoundedPositiveIntegerField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_grouptombstone'
