from __future__ import absolute_import

from django.db import models

from sentry.db.models import sane_repr
from sentry.models.deletedentry import DeletedEntry


class DeletedOrganization(DeletedEntry):
    name = models.CharField(max_length=64, null=True)
    slug = models.SlugField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_deletedorganization'

    __repr__ = sane_repr('date_deleted', 'slug', 'reason')
