from __future__ import absolute_import, print_function

from django.db import models

from sentry.db.models import BoundedPositiveIntegerField, Model, sane_repr


class CommitAuthor(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    name = models.CharField(max_length=128, null=True)
    email = models.EmailField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_commitauthor'
        unique_together = (('organization_id', 'email'),)

    __repr__ = sane_repr('organization_id', 'email', 'name')
