from __future__ import absolute_import

from django.db import models

from sentry.db.models import sane_repr, BoundedBigIntegerField
from sentry.models.deletedentry import DeletedEntry


class DeletedTeam(DeletedEntry):
    name = models.CharField(max_length=64, null=True)
    slug = models.SlugField(null=True)

    organization_id = BoundedBigIntegerField(null=True)
    organization_name = models.CharField(max_length=64, null=True)
    organization_slug = models.SlugField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_deletedteam'

    __repr__ = sane_repr('date_deleted', 'slug', 'reason')
