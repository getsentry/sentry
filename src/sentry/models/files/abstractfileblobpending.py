from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model


class AbstractFileBlobPending(Model):
    """
    A filestore path that has been handed to the storage backend but has no
    blob row yet.

    The row is created before the bytes are written and deleted once the blob
    row exists. A row that outlives its write marks a failed upload, and
    `sentry cleanup` removes the path it points to.
    """

    __relocation_scope__ = RelocationScope.Excluded

    path = models.TextField(unique=True)
    created = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        abstract = True
