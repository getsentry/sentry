from __future__ import absolute_import

from django.db import models

from sentry.db.models import sane_repr
from sentry.models.deletedentry import DeletedEntry


class DeletedOrganization(DeletedEntry):
    """
    This model tracks an intent to delete. If an org is marked pending_delete
    through the UI, a deletedorganization is created to log this deletion.

    This model does not account for aborted or failed deletions and is currently
    unable to log deletions that occur implicity (i.e. when the sole parent object
    is deleted, the child is also marked for deletion as well).
    """

    name = models.CharField(max_length=64, null=True)
    slug = models.CharField(max_length=50, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_deletedorganization"

    __repr__ = sane_repr("date_deleted", "slug", "reason")
