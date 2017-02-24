from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from sentry.db.models import (
    BoundedPositiveIntegerField, Model, sane_repr
)


class GroupCommitResolution(Model):
    """
    When a Group is referenced via a commit, it's association is stored here.
    """
    __core__ = False

    group_id = BoundedPositiveIntegerField()
    commit_id = BoundedPositiveIntegerField()
    datetime = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = 'sentry_groupcommitresolution'
        app_label = 'sentry'
        unique_together = (
            ('group_id', 'commit_id'),
        )

    __repr__ = sane_repr('group_id', 'commit_id')
