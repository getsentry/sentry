from __future__ import absolute_import

from django.db import models

from sentry.db.models import sane_repr, DeletedEntry


class DeletedOrganization(DeletedEntry):
    name = models.CharField(max_length=64)
    slug = models.SlugField(unique=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_deletedorganization'

    __repr__ = sane_repr('date_deleted', 'organization_id', 'reason')
