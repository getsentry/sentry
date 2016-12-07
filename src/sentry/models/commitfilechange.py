from __future__ import absolute_import, print_function

from django.db import models

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)


class CommitFileChange(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    commit = FlexibleForeignKey('sentry.Commit')
    filename = models.CharField(max_length=255)
    type = models.CharField(max_length=1, choices=(
        ('A', 'Added'),
        ('D', 'Deleted'),
        ('M', 'Modified'),
    ))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_commitfilechange'
        unique_together = (
            ('commit', 'filename'),
        )

    __repr__ = sane_repr('commit_id', 'filename')
