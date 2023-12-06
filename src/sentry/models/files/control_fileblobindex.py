from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import control_silo_only_model
from sentry.models.files.abstractfileblobindex import AbstractFileBlobIndex


@control_silo_only_model
class ControlFileBlobIndex(AbstractFileBlobIndex):
    __relocation_scope__ = RelocationScope.Excluded

    file = FlexibleForeignKey("sentry.ControlFile")
    blob = FlexibleForeignKey("sentry.ControlFileBlob", on_delete=models.PROTECT)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlfileblobindex"
        unique_together = (("file", "blob", "offset"),)
