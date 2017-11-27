from __future__ import absolute_import
from django.db import models
from sentry.db.models import (
    sane_repr, BoundedBigIntegerField
)
from sentry.models.deletedentry import DeletedEntry


class DeletedProject(DeletedEntry):
    slug = models.SlugField(null=True)
    name = models.CharField(max_length=200)

    organization_id = BoundedBigIntegerField(null=True, blank=True)
    organization_name = models.CharField(max_length=64)
    organization_slug = models.SlugField(null=True)

    team_id = BoundedBigIntegerField(null=True, blank=True)
    team_name = models.CharField(max_length=64)
    team_slug = models.SlugField(null=True)

    platform = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_deletedproject'

    __repr__ = sane_repr('date_deleted', 'slug', 'reason')
