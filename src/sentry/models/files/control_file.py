from django.db import models

from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import control_silo_only_model
from sentry.models.files.abstractfile import AbstractFile
from sentry.models.files.control_fileblob import ControlFileBlob
from sentry.models.files.control_fileblobindex import ControlFileBlobIndex


@control_silo_only_model
class ControlFile(AbstractFile):
    blobs = models.ManyToManyField("sentry.ControlFileBlob", through="sentry.ControlFileBlobIndex")
    # <Legacy fields>
    # Remove in 8.1
    blob = FlexibleForeignKey("sentry.ControlFileBlob", null=True, related_name="legacy_blob")
    # </Legacy fields>

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlfile"

    FILE_BLOB_MODEL = ControlFileBlob
    FILE_BLOB_INDEX_MODEL = ControlFileBlobIndex
