from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import region_silo_only_model
from sentry.models.files.abstractfileblobindex import AbstractFileBlobIndex


@region_silo_only_model
class FileBlobIndex(AbstractFileBlobIndex):
    __relocation_scope__ = RelocationScope.Excluded

    file = FlexibleForeignKey("sentry.File")
    blob = FlexibleForeignKey("sentry.FileBlob", on_delete=models.PROTECT)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_fileblobindex"
        unique_together = (("file", "blob", "offset"),)
