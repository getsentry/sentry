from django.db import models

from sentry.db.models.base import control_silo_only_model
from sentry.models.files.abstractfile import AbstractFile
from sentry.models.files.control_fileblob import ControlFileBlob
from sentry.models.files.control_fileblobindex import ControlFileBlobIndex
from sentry.tasks.files import delete_unreferenced_blobs_control


@control_silo_only_model
class ControlFile(AbstractFile):
    blobs = models.ManyToManyField("sentry.ControlFileBlob", through="sentry.ControlFileBlobIndex")
    # Looking for the "blob" FK or the path attribute? These are deprecated and unavailable in the control silo

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlfile"

    FILE_BLOB_MODEL = ControlFileBlob
    FILE_BLOB_INDEX_MODEL = ControlFileBlobIndex
    DELETE_UNREFERENCED_BLOB_TASK = delete_unreferenced_blobs_control
