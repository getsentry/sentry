from __future__ import absolute_import, print_function

import logging

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


logger = logging.getLogger(__name__)


class GroupHashTombstone(Model):
    __core__ = True

    project = FlexibleForeignKey('sentry.Project')
    hash = models.CharField(max_length=32)
    deleted_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_grouphashtombstone'
        unique_together = (('project', 'hash'), )
